import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import type { Entity, ID } from '../models'
import { FIREBASE_TENANT, getDb } from '../lib/firebase'
import { explainCloudError, reportRepoState, reportWriteError } from '../lib/cloudStatus'
import { onSessionChange, whenSessionKnown } from '../lib/cloudSession'
import { uid } from '../utils/misc'
import { DATA_VERSION, STORAGE_NAMESPACE, createLocalRepository, storage } from './localRepository'
import type { ResettableRepository } from './repository'

/** Sem nenhuma resposta da nuvem por este tempo, o app segue com os dados locais. */
const READY_TIMEOUT_MS = 10_000
/** Quanto tempo um envio que exige confirmação espera pela resposta do servidor. */
const CONFIRM_TIMEOUT_MS = 15_000
/** Limite do Firestore é 500 operações por lote. */
const BATCH_SIZE = 400

export interface FirestoreRepositoryOptions<T> {
  /** Ajusta os dados antes de irem para a nuvem (ex.: proteger senhas). */
  prepare?(data: Partial<T>): Promise<Partial<T>> | Partial<T>
}

export interface CloudRepository<T extends Entity> extends ResettableRepository<T> {
  /** Grava os dados de exemplo na nuvem (primeira execução). */
  writeSeed(): Promise<void>
}

const now = () => new Date().toISOString()

/**
 * A nuvem responde? O documento da igreja é de leitura pública; se nem ele pode ser lido, as regras estão
 * bloqueando tudo (ou o banco não existe) e o app segue em modo local. Se pode, "sem permissão" numa coleção
 * significa só que o perfil de quem está logado não enxerga aquela coleção.
 */
let probing: Promise<boolean> | undefined
const cloudAccessible = () =>
  (probing ??= getDocFromServer(doc(getDb(), 'igrejas', FIREBASE_TENANT))
    .then(
      () => true,
      () => false,
    )
    .finally(() => {
      probing = undefined // várias coleções perguntam ao mesmo tempo; cada rodada faz uma só leitura
    }))

/**
 * Repositório sincronizado com o Firestore (`igrejas/<tenant>/<coleção>`).
 *
 * - Lê em tempo real (`onSnapshot`): o que uma pessoa altera aparece nos outros aparelhos na hora.
 * - Grava sem esperar o servidor: a tela já mostra a mudança e o Firestore envia assim que houver
 *   internet (o cache em disco guarda o que ficou pendente).
 * - Se a nuvem estiver inacessível desde o início (regras bloqueando, banco inexistente, sem rede),
 *   a coleção passa a funcionar só no aparelho, como o modo local, e o aviso aparece no app.
 */
export function createFirestoreRepository<T extends Entity>(
  name: string,
  seed: () => T[],
  idPrefix = name.slice(0, 3),
  options: FirestoreRepositoryOptions<T> = {},
): CloudRepository<T> {
  const local = createLocalRepository<T>(name, seed, idPrefix)
  /** Marca (por aparelho) de que esta coleção já recebeu uma resposta confirmada do servidor. */
  const syncedKey = `${STORAGE_NAMESPACE}:synced:${FIREBASE_TENANT}:${name}`
  const listeners = new Set<() => void>()
  const seedOrder = new Map(seed().map((item, index) => [item.id, index]))

  let mode: 'pending' | 'cloud' | 'local' = 'pending'
  let fellBackByTimeout = false
  let localWrites = false
  let confirmed = false
  let started = false
  let stop: Unsubscribe | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let server = new Map<ID, T>()
  /** Gravações locais ainda não vistas pelo servidor; valem por cima dos dados recebidos. */
  const overlay = new Map<ID, { value: T | null; version: number; acked: boolean }>()
  let version = 0
  let current: T[] = []
  let markReady!: () => void
  let ready!: Promise<void>
  const newReady = () => {
    ready = new Promise<void>((resolve) => (markReady = resolve))
  }
  newReady()

  const emit = () => listeners.forEach((listener) => listener())
  local.subscribe(emit)

  const order = (a: T, b: T) => {
    const ia = seedOrder.get(a.id)
    const ib = seedOrder.get(b.id)
    if (ia !== undefined && ib !== undefined) return ia - ib
    if (ia !== undefined || ib !== undefined) return ia !== undefined ? -1 : 1
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id)
  }

  const rebuild = () => {
    const merged = new Map(server)
    for (const [id, op] of overlay) {
      if (op.value === null) merged.delete(id)
      else merged.set(id, op.value)
    }
    current = [...merged.values()].sort(order)
  }

  const docRef = (id: ID) => doc(getDb(), 'igrejas', FIREBASE_TENANT, name, id)

  const fallBack = (reason: unknown) => {
    if (mode === 'local') return
    clearTimeout(timer)
    fellBackByTimeout = reason === 'timeout'
    // Em caso de demora o ouvinte continua: se a nuvem responder a tempo de nada ter sido gravado, voltamos a ela.
    if (!fellBackByTimeout) {
      stop?.()
      stop = undefined
    }
    mode = 'local'
    reportRepoState(name, { state: 'local', reason: explainCloudError(reason) })
    markReady()
    emit()
  }

  /** Perfil sem acesso de leitura a esta coleção: ela aparece vazia (e as gravações são decididas pelas regras). */
  const restrictOrFallBack = async (error: unknown) => {
    clearTimeout(timer)
    if (!(await cloudAccessible())) return mode === 'pending' ? fallBack(error) : undefined
    if (mode !== 'pending') return
    mode = 'cloud'
    confirmed = true
    server = new Map()
    reportRepoState(name, { state: 'online' })
    rebuild()
    markReady()
    emit()
  }

  const start = () => {
    if (started) return
    started = true
    // espera saber quem está logado: as regras dependem disso
    whenSessionKnown(attach)
  }

  const attach = () => {
    timer = setTimeout(() => fallBack('timeout'), READY_TIMEOUT_MS)
    try {
      stop = onSnapshot(
        collection(getDb(), 'igrejas', FIREBASE_TENANT, name),
        (snapshot) => {
          const fromServer = !snapshot.metadata.fromCache
          if (fromServer) storage.set(syncedKey, '1')
          // Cache vazio é ambíguo: pode ser "coleção sem nada" ou "nunca sincronizou" (e o servidor ainda vai
          // responder, talvez recusando). Só vale como resposta se esta coleção já foi sincronizada antes.
          if (!fromServer && snapshot.empty && mode !== 'cloud' && storage.get(syncedKey) !== '1') return
          clearTimeout(timer)
          // Se a nuvem demorou e ainda não houve gravação local, vale mais voltar para a nuvem.
          if (mode === 'local' && !(fellBackByTimeout && !localWrites)) return
          mode = 'cloud'
          confirmed ||= fromServer
          for (const [id, op] of overlay) if (op.acked) overlay.delete(id)
          server = new Map(snapshot.docs.map((d) => [d.id, { ...d.data(), id: d.id } as T]))
          reportRepoState(name, { state: confirmed ? 'online' : 'cache' })
          rebuild()
          markReady()
          emit()
        },
        (error) => {
          if (mode === 'cloud') reportRepoState(name, { state: 'cache', reason: explainCloudError(error) })
          else if (error.code === 'permission-denied') void restrictOrFallBack(error)
          else fallBack(error)
        },
      )
    } catch (error) {
      fallBack(error)
    }
  }

  // Entrou, saiu ou trocou de conta: o que as regras liberam muda, então a coleção é lida de novo.
  onSessionChange(() => {
    if (!started) return
    stop?.()
    stop = undefined
    clearTimeout(timer)
    mode = 'pending'
    started = false
    fellBackByTimeout = false
    localWrites = false
    confirmed = false
    server = new Map()
    overlay.clear()
    current = []
    markReady() // quem já esperava pela leitura anterior segue (com a lista vazia) em vez de ficar preso
    newReady()
    reportRepoState(name, { state: 'connecting' })
    emit()
    if (listeners.size > 0) start()
  })

  /**
   * Aplica a mudança na tela já e envia ao Firestore em seguida. Devolve o resultado do envio para quem quiser esperar
   * pela confirmação do servidor; quem não espera não precisa tratar o erro (ele já é avisado nas telas).
   */
  const commit = (id: ID, value: T | null, send: () => Promise<unknown>, report = true): Promise<void> => {
    const mine = ++version
    overlay.set(id, { value, version: mine, acked: false })
    rebuild()
    emit()
    const sent = send().then(
      () => {
        const op = overlay.get(id)
        if (op?.version === mine) op.acked = true
      },
      (error) => {
        if (overlay.get(id)?.version === mine) {
          overlay.delete(id)
          rebuild()
          emit()
        }
        if (report) reportWriteError(error)
        throw error
      },
    )
    sent.catch(() => undefined)
    return sent
  }

  /** Espera o servidor responder ao envio; se demorar demais, avisa sem desfazer (o envio segue na fila do Firestore). */
  const awaitServer = (sent: Promise<void>) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Object.assign(new Error('Sem resposta da nuvem.'), { code: 'timeout' })), CONFIRM_TIMEOUT_MS)
      sent.then(resolve, reject).finally(() => clearTimeout(timer))
    })

  const prepare = async <D extends Partial<T>>(data: D): Promise<D> => ((await options.prepare?.(data)) ?? data) as D

  /** Troca todo o conteúdo da coleção, em lotes. Exige conexão confirmada, senão o lote ficaria preso na fila. */
  const replaceAll = async (items: T[]) => {
    if (!confirmed) throw new Error('Sem conexão com a nuvem. Conecte-se à internet para concluir esta operação.')
    const keep = new Set(items.map((item) => item.id))
    const prepared = await Promise.all(items.map((item) => prepare(item)))
    const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [
      ...current.filter((item) => !keep.has(item.id)).map((item) => (b: ReturnType<typeof writeBatch>) => b.delete(docRef(item.id))),
      ...prepared.map((item) => (b: ReturnType<typeof writeBatch>) => b.set(docRef(item.id), item)),
    ]
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const batch = writeBatch(getDb())
      ops.slice(i, i + BATCH_SIZE).forEach((op) => op(batch))
      await batch.commit()
    }
  }

  const isLocal = () => mode === 'local'

  return {
    async list() {
      start()
      await ready
      return isLocal() ? local.list() : [...current]
    },
    async get(id) {
      start()
      await ready
      return isLocal() ? local.get(id) : current.find((item) => item.id === id)
    },
    async create(data, createOptions) {
      start()
      await ready
      if (isLocal()) {
        // um envio que precisa chegar ao servidor nunca fica só neste aparelho (a secretaria não o veria)
        if (createOptions?.confirm) {
          throw Object.assign(new Error('Sem conexão com a nuvem. Verifique a internet e tente novamente.'), { code: 'unavailable' })
        }
        localWrites = true
        return local.create(data)
      }
      const id = data.id ?? uid(idPrefix)
      if (current.some((item) => item.id === id)) throw new Error('Já existe um registro com este código.')
      const stamp = now()
      const item = { ...(await prepare(data as Partial<T>)), id, createdAt: stamp, updatedAt: stamp } as T
      const sent = commit(id, item, () => setDoc(docRef(id), item), !createOptions?.confirm)
      if (createOptions?.confirm) await awaitServer(sent)
      return item
    },
    async update(id, patch) {
      start()
      await ready
      if (isLocal()) {
        localWrites = true
        return local.update(id, patch)
      }
      const existing = current.find((item) => item.id === id)
      if (!existing) throw new Error('Registro não encontrado.')
      const changes = { ...(await prepare(patch as Partial<T>)), updatedAt: now() }
      // sem as chaves apagadas, a tela vê o mesmo que o servidor vai devolver
      const merged = Object.fromEntries(Object.entries({ ...existing, ...changes, id }).filter(([, value]) => value !== undefined)) as unknown as T
      // campo definido como undefined significa "apagar o campo"
      const fields = Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value === undefined ? deleteField() : value]))
      commit(id, merged, () =>
        updateDoc(docRef(id), fields).catch((error: { code?: string }) =>
          error?.code === 'not-found' ? setDoc(docRef(id), merged) : Promise.reject(error),
        ),
      )
      return merged
    },
    async remove(id) {
      start()
      await ready
      if (isLocal()) {
        localWrites = true
        return local.remove(id)
      }
      commit(id, null, () => deleteDoc(docRef(id)))
    },
    subscribe(listener) {
      start()
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    peek() {
      start()
      if (mode === 'local') return local.peek?.()
      return mode === 'cloud' ? [...current] : undefined
    },
    async reset() {
      start()
      await ready
      if (isLocal()) return local.reset()
      await replaceAll(seed())
    },
    /** Apaga todos os documentos direto do servidor (sem gravar exemplo), em lotes. */
    async clear() {
      start()
      await ready
      if (isLocal()) return local.clear()
      // Lê do servidor: o cache local pode estar desatualizado depois de uma limpeza feita em outro aparelho.
      const snapshot = await getDocsFromServer(collection(getDb(), 'igrejas', FIREBASE_TENANT, name))
      for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(getDb())
        for (const item of snapshot.docs.slice(i, i + BATCH_SIZE)) batch.delete(item.ref)
        await batch.commit()
      }
      overlay.clear()
      server = new Map()
      rebuild()
      emit()
    },
    dump: () => (isLocal() ? local.dump() : [...current]),
    async load(items) {
      start()
      await ready
      if (isLocal()) return local.load(items)
      await replaceAll(items)
    },
    async writeSeed() {
      const items = await Promise.all(seed().map((item) => prepare(item)))
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = writeBatch(getDb())
        items.slice(i, i + BATCH_SIZE).forEach((item) => batch.set(docRef(item.id), item))
        await batch.commit()
      }
    },
  }
}

/**
 * Primeira execução: se a igreja ainda não tem dados na nuvem, grava os dados de exemplo.
 * O documento `igrejas/<tenant>` serve de marca — depois dele, apagar registros não recria nada.
 */
export async function bootstrapCloud(repos: { writeSeed(): Promise<void> }[]) {
  const marker = doc(getDb(), 'igrejas', FIREBASE_TENANT)
  try {
    if ((await getDocFromServer(marker)).exists()) return
    await Promise.all(repos.map((repo) => repo.writeSeed()))
    await setDoc(marker, { seededAt: now(), version: DATA_VERSION })
  } catch {
    // sem acesso à nuvem: cada coleção já cuida do modo local
  }
}
