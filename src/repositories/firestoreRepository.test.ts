import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Firestore de mentira, em memória: guarda documentos, avisa quem escuta e registra as chamadas. */
const fake = vi.hoisted(() => {
  type Data = Record<string, unknown>
  const DELETE = { __delete: true }
  const store = new Map<string, Data>()
  const subs = new Set<{ col: string; next(snapshot: unknown): void; error(error: unknown): void }>()
  const calls: { op: string; path: string; data?: unknown }[] = []
  const state = { fromCache: false, neverAnswer: false, failListen: undefined as string | undefined, failWrite: undefined as string | undefined, writeDelay: false, rootDenied: false }
  const pendingAcks: (() => void)[] = []

  const docsOf = (col: string) =>
    [...store.entries()]
      .filter(([path]) => path.startsWith(`${col}/`) && !path.slice(col.length + 1).includes('/'))
      .map(([path, data]) => ({ id: path.split('/').pop() as string, data: () => data }))
  const snapshot = (col: string, docs = docsOf(col)) => ({ docs, empty: docs.length === 0, metadata: { fromCache: state.fromCache } })
  const notify = () => subs.forEach((s) => s.next(snapshot(s.col)))
  const ref = (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })
  const apply = (path: string, data: Data, merge: boolean) => {
    const base = merge ? { ...(store.get(path) ?? {}) } : {}
    for (const [key, value] of Object.entries(data)) {
      if (value === DELETE) delete base[key]
      else base[key] = value
    }
    store.set(path, base)
  }
  /** Grava na hora (como o cache local do SDK) e confirma depois, quando `writeDelay` não segura a resposta. */
  const write = (op: string, path: string, run: () => void, data?: unknown) => {
    calls.push({ op, path, data })
    if (state.failWrite) return Promise.reject({ code: state.failWrite })
    run()
    notify()
    if (state.writeDelay) return new Promise<void>((resolve) => pendingAcks.push(resolve))
    return Promise.resolve()
  }

  const api = {
    collection: ref,
    doc: ref,
    deleteField: () => DELETE,
    onSnapshot: (col: { path: string }, next: (s: unknown) => void, error: (e: unknown) => void) => {
      const sub = { col: col.path, next, error }
      subs.add(sub)
      if (!state.neverAnswer) {
        Promise.resolve().then(() => {
          if (!subs.has(sub)) return
          if (state.failListen) error({ code: state.failListen })
          else next(snapshot(col.path))
        })
      }
      return () => subs.delete(sub)
    },
    setDoc: (r: { path: string }, data: Data) => write('set', r.path, () => apply(r.path, data, false), data),
    updateDoc: (r: { path: string }, data: Data) =>
      store.has(r.path)
        ? write('update', r.path, () => apply(r.path, data, true), data)
        : Promise.reject({ code: 'not-found' }),
    deleteDoc: (r: { path: string }) => write('delete', r.path, () => store.delete(r.path)),
    getDocFromServer: (r: { path: string }) => (state.rootDenied ? Promise.reject({ code: 'permission-denied' }) : Promise.resolve({ exists: () => store.has(r.path) })),
    writeBatch: () => {
      const ops: (() => void)[] = []
      return {
        set: (r: { path: string }, data: Data) => ops.push(() => (calls.push({ op: 'batch-set', path: r.path, data }), apply(r.path, data, false))),
        delete: (r: { path: string }) => ops.push(() => (calls.push({ op: 'batch-delete', path: r.path }), store.delete(r.path))),
        commit: () => {
          ops.forEach((op) => op())
          notify()
          return Promise.resolve()
        },
      }
    },
  }

  return {
    api,
    store,
    subs,
    calls,
    state,
    pendingAcks,
    /** Mostra aos ouvintes uma foto antiga da coleção, como acontece quando um aviso atrasa. */
    emitRaw: (col: string, docs: { id: string; data: () => Data }[]) => subs.forEach((s) => s.col === col && s.next(snapshot(col, docs))),
    notify,
    reset: () => {
      store.clear()
      subs.clear()
      calls.length = 0
      pendingAcks.length = 0
      Object.assign(state, { fromCache: false, neverAnswer: false, failListen: undefined, failWrite: undefined, writeDelay: false, rootDenied: false })
    },
  }
})

vi.mock('firebase/firestore', () => fake.api)
vi.mock('../lib/firebase', () => ({ FIREBASE_TENANT: 'teste', cloudEnabled: true, getDb: () => ({}) }))
// sessão já conhecida e sem trocas de conta durante os testes
vi.mock('../lib/cloudSession', () => ({ whenSessionKnown: (run: () => void) => run(), onSessionChange: () => () => {} }))

import { getCloudStatus } from '../lib/cloudStatus'
import { bootstrapCloud, createFirestoreRepository } from './firestoreRepository'

interface Item {
  id: string
  name: string
  note?: string
  createdAt?: string
  updatedAt?: string
}

const seed = (): Item[] => [
  { id: 'i-1', name: 'Primeiro' },
  { id: 'i-2', name: 'Segundo' },
]
const PATH = (name: string, id?: string) => `igrejas/teste/${name}${id ? `/${id}` : ''}`
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
let counter = 0
const fresh = () => {
  const name = `itens${++counter}` // nome novo a cada teste: o repositório local de reserva usa localStorage
  return { name, repo: createFirestoreRepository<Item>(name, seed, 'it') }
}
const seedCloud = (name: string) => seed().forEach((item) => fake.store.set(PATH(name, item.id), { ...item }))

beforeEach(() => {
  fake.reset()
  localStorage.clear()
})

describe('repositório Firestore', () => {
  it('só entrega dados depois da primeira resposta da nuvem e mantém a ordem dos exemplos', async () => {
    const { name, repo } = fresh()
    fake.store.set(PATH(name, 'i-2'), { name: 'Segundo' })
    fake.store.set(PATH(name, 'i-1'), { name: 'Primeiro' })
    fake.store.set(PATH(name, 'novo'), { name: 'Criado depois', createdAt: '2030-01-01' })
    expect(repo.peek?.()).toBeUndefined()
    expect((await repo.list()).map((i) => i.id)).toEqual(['i-1', 'i-2', 'novo'])
    expect(repo.peek?.()?.length).toBe(3)
    expect(getCloudStatus().state).toBe('online')
  })

  it('criar, editar e excluir aparecem na hora e seguem para o Firestore', async () => {
    const { name, repo } = fresh()
    seedCloud(name)
    await repo.list()
    const changes = vi.fn()
    repo.subscribe(changes)

    const created = await repo.create({ name: 'Terceiro' })
    expect(created.id).toMatch(/^it/)
    expect(created.createdAt).toBeTruthy()
    expect(repo.peek?.()?.map((i) => i.name)).toEqual(['Primeiro', 'Segundo', 'Terceiro'])
    expect(fake.calls.at(-1)).toMatchObject({ op: 'set', path: PATH(name, created.id) })

    await repo.update('i-1', { note: 'oi' })
    expect((await repo.get('i-1'))?.note).toBe('oi')
    expect(fake.calls.at(-1)).toMatchObject({ op: 'update', path: PATH(name, 'i-1') })

    await repo.remove('i-2')
    expect(await repo.get('i-2')).toBeUndefined()
    expect(fake.store.has(PATH(name, 'i-2'))).toBe(false)
    expect(changes).toHaveBeenCalled()
  })

  it('campo definido como undefined é apagado do documento', async () => {
    const { name, repo } = fresh()
    seedCloud(name)
    await repo.update('i-1', { note: 'temporário' })
    await repo.update('i-1', { note: undefined })
    expect(fake.store.get(PATH(name, 'i-1'))).not.toHaveProperty('note')
    expect(await repo.get('i-1')).not.toHaveProperty('note')
  })

  it('recusa código repetido e registro inexistente', async () => {
    const { name, repo } = fresh()
    seedCloud(name)
    await expect(repo.create({ id: 'i-1', name: 'Repetido' })).rejects.toThrow(/código/)
    await expect(repo.update('nao-existe', { name: 'x' })).rejects.toThrow(/não encontrado/)
  })

  it('uma foto antiga da nuvem não desfaz uma gravação que ainda não foi confirmada', async () => {
    const { name, repo } = fresh()
    seedCloud(name)
    await repo.list()
    fake.state.writeDelay = true
    await repo.update('i-1', { name: 'Editado' })
    // chega um aviso atrasado, de antes da edição
    fake.emitRaw(name ? PATH(name) : '', [
      { id: 'i-1', data: () => ({ name: 'Primeiro' }) },
      { id: 'i-2', data: () => ({ name: 'Segundo' }) },
    ])
    expect((await repo.get('i-1'))?.name).toBe('Editado')
  })

  it('mudanças feitas em outro aparelho chegam às telas', async () => {
    const { name, repo } = fresh()
    seedCloud(name)
    await repo.list()
    const changes = vi.fn()
    repo.subscribe(changes)
    fake.store.set(PATH(name, 'remoto'), { name: 'Vindo de outro aparelho' })
    fake.notify()
    expect(changes).toHaveBeenCalled()
    expect((await repo.get('remoto'))?.name).toBe('Vindo de outro aparelho')
  })

  it('gravação recusada pelo servidor volta ao valor anterior e avisa', async () => {
    const { name, repo } = fresh()
    seedCloud(name)
    await repo.list()
    const warned = vi.fn()
    window.addEventListener('cloud:write-error', warned)
    fake.state.failWrite = 'permission-denied'
    await repo.update('i-1', { name: 'Não vai passar' })
    await tick()
    expect((await repo.get('i-1'))?.name).toBe('Primeiro')
    expect(warned).toHaveBeenCalledTimes(1)
    window.removeEventListener('cloud:write-error', warned)
  })

  it('regras bloqueando tudo (nem o documento da igreja abre): funciona só no aparelho com os dados de exemplo', async () => {
    const { repo } = fresh()
    fake.state.failListen = 'permission-denied'
    fake.state.rootDenied = true
    const list = await repo.list()
    expect(list.map((i) => i.id)).toEqual(['i-1', 'i-2'])
    const created = await repo.create({ name: 'Só local' })
    expect((await repo.get(created.id))?.name).toBe('Só local')
    expect(fake.calls).toHaveLength(0)
    expect(getCloudStatus()).toMatchObject({ state: 'local' })
    expect(getCloudStatus().reason).toMatch(/regras/i)
  })

  it('cache vazio de uma coleção nunca sincronizada não vale como resposta (o servidor ainda pode recusar)', async () => {
    const { repo } = fresh()
    fake.state.fromCache = true // o Firestore entrega primeiro o cache em disco, vazio
    fake.state.failListen = undefined
    fake.state.rootDenied = true // as regras bloqueiam tudo: nem o documento da igreja pode ser lido
    let settled = false
    const pending = repo.list().then((items) => ((settled = true), items))
    await tick()
    expect(settled).toBe(false)
    expect(repo.peek?.()).toBeUndefined()
    // depois o servidor recusa: a coleção segue no aparelho, com os dados de exemplo
    fake.subs.forEach((s) => s.error({ code: 'permission-denied' }))
    expect((await pending).map((i) => i.id)).toEqual(['i-1', 'i-2'])
    expect(getCloudStatus().state).toBe('local')
  })

  it('cache vazio vale quando a coleção já foi sincronizada antes (abrir offline)', async () => {
    const { name, repo } = fresh()
    localStorage.setItem(`igreja-sda:synced:teste:${name}`, '1')
    fake.state.fromCache = true
    expect(await repo.list()).toEqual([])
    expect(repo.peek?.()).toEqual([])
  })

  it('perfil sem permissão de leitura: a coleção aparece vazia e o app NÃO cai no modo local', async () => {
    const { name, repo } = fresh()
    fake.state.failListen = 'permission-denied' // o documento da igreja continua legível
    expect(await repo.list()).toEqual([])
    expect(repo.peek?.()).toEqual([])
    // a gravação segue para o servidor, que decide pelas regras
    const created = await repo.create({ name: 'Pedido público' })
    expect(fake.calls.at(-1)).toMatchObject({ op: 'set', path: PATH(name, created.id) })
  })

  it('sem resposta por 10 segundos, segue com os dados locais', async () => {
    vi.useFakeTimers()
    try {
      const { repo } = fresh()
      fake.state.neverAnswer = true
      const pending = repo.list()
      await vi.advanceTimersByTimeAsync(10_000)
      expect((await pending).length).toBe(2)
      expect(getCloudStatus().state).toBe('local')
    } finally {
      vi.useRealTimers()
    }
  })

  it('restaurar e importar exigem conexão confirmada com o servidor', async () => {
    const { name, repo } = fresh()
    seedCloud(name)
    fake.state.fromCache = true
    await repo.list()
    await expect(repo.reset()).rejects.toThrow(/conexão/i)
    fake.state.fromCache = false
    fake.notify()
    await tick()
    fake.store.set(PATH(name, 'extra'), { name: 'Extra' })
    fake.notify()
    await repo.reset()
    expect([...fake.store.keys()].filter((k) => k.startsWith(PATH(name) + '/')).sort()).toEqual([PATH(name, 'i-1'), PATH(name, 'i-2')])
  })

  describe('envio com confirmação do servidor (cadastro público)', () => {
    it('só conclui depois que o servidor confirma', async () => {
      const { name, repo } = fresh()
      seedCloud(name)
      await repo.list()
      fake.state.writeDelay = true
      let done = false
      const sending = repo.create({ id: 'req-a', name: 'Pedido' }, { confirm: true }).then((item) => ((done = true), item))
      await tick()
      expect(done).toBe(false)
      fake.pendingAcks.forEach((ack) => ack())
      expect((await sending).id).toBe('req-a')
      expect(fake.store.has(PATH(name, 'req-a'))).toBe(true)
    })

    it('se o servidor recusa, lança o erro dele, desfaz na tela e não mostra o aviso geral de falha', async () => {
      const { name, repo } = fresh()
      seedCloud(name)
      await repo.list()
      const warned = vi.fn()
      window.addEventListener('cloud:write-error', warned)
      fake.state.failWrite = 'permission-denied'
      await expect(repo.create({ id: 'req-b', name: 'Pedido' }, { confirm: true })).rejects.toMatchObject({ code: 'permission-denied' })
      await tick()
      expect(await repo.get('req-b')).toBeUndefined()
      expect(warned).not.toHaveBeenCalled()
      window.removeEventListener('cloud:write-error', warned)
    })

    it('uma gravação comum recusada continua avisando', async () => {
      const { name, repo } = fresh()
      seedCloud(name)
      await repo.list()
      const warned = vi.fn()
      window.addEventListener('cloud:write-error', warned)
      fake.state.failWrite = 'permission-denied'
      await repo.create({ name: 'Comum' })
      await tick()
      expect(warned).toHaveBeenCalledTimes(1)
      window.removeEventListener('cloud:write-error', warned)
    })

    it('sem conexão com a nuvem nunca guarda só no aparelho', async () => {
      const { repo } = fresh()
      fake.state.failListen = 'permission-denied'
      fake.state.rootDenied = true
      await expect(repo.create({ id: 'req-c', name: 'Pedido' }, { confirm: true })).rejects.toMatchObject({ code: 'unavailable' })
      expect(fake.calls).toHaveLength(0)
      expect(await repo.get('req-c')).toBeUndefined()
    })

    it('um registro velho no cache local não barra o reenvio: quem decide é o servidor', async () => {
      const { name, repo } = fresh()
      seedCloud(name)
      fake.store.set(PATH(name, 'req-d'), { name: 'Enviado antes (visto no cache)' })
      await repo.list()
      // comum: o aplicativo recusa o código repetido sem falar com o servidor
      await expect(repo.create({ id: 'req-d', name: 'Outra vez' })).rejects.toThrow(/código/)
      fake.calls.length = 0
      // confirmado: segue para o servidor, que aceita ou recusa pelas regras
      await expect(repo.create({ id: 'req-d', name: 'Reenvio' }, { confirm: true })).resolves.toMatchObject({ id: 'req-d' })
      expect(fake.calls.at(-1)).toMatchObject({ op: 'set', path: PATH(name, 'req-d') })
    })

    it('sem resposta do servidor por 15 segundos, avisa com o código "timeout"', async () => {
      const { name, repo } = fresh()
      seedCloud(name)
      await repo.list()
      vi.useFakeTimers()
      try {
        fake.state.writeDelay = true
        const sending = repo.create({ id: 'req-e', name: 'Pedido' }, { confirm: true })
        const outcome = expect(sending).rejects.toMatchObject({ code: 'timeout' })
        await vi.advanceTimersByTimeAsync(15_000)
        await outcome
      } finally {
        vi.useRealTimers()
      }
    })
  })

  it('aplica a preparação dos dados (ex.: senha protegida) ao criar e editar', async () => {
    const name = `prep${++counter}`
    const repo = createFirestoreRepository<Item>(name, seed, 'it', {
      prepare: (data) => (data.note ? { ...data, note: `#${data.note}` } : data),
    })
    await repo.list()
    const created = await repo.create({ name: 'A', note: 'x' })
    expect(fake.store.get(PATH(name, created.id))).toMatchObject({ note: '#x' })
    await repo.update(created.id, { note: 'y' })
    expect(fake.store.get(PATH(name, created.id))).toMatchObject({ note: '#y' })
  })
})

describe('primeira execução na nuvem', () => {
  it('grava os dados de exemplo uma única vez', async () => {
    const { name, repo } = fresh()
    await bootstrapCloud([repo])
    expect([...fake.store.keys()]).toContain(PATH(name, 'i-1'))
    expect(fake.store.has('igrejas/teste')).toBe(true)

    fake.store.delete(PATH(name, 'i-1'))
    await bootstrapCloud([repo])
    expect(fake.store.has(PATH(name, 'i-1'))).toBe(false)
  })
})
