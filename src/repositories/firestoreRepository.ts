import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocFromServer,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import type { Entity, ID } from '../models'
import { FIREBASE_TENANT, getDb } from '../lib/firebase'
import { explainCloudError, reportRepoState, reportWriteError } from '../lib/cloudStatus'
import { uid } from '../utils/misc'
import { DATA_VERSION, createLocalRepository } from './localRepository'
import type { ResettableRepository } from './repository'

/** Sem nenhuma resposta da nuvem por este tempo, o app segue com os dados locais. */
const READY_TIMEOUT_MS = 10_000
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
  const ready = new Promise<void>((resolve) => (markReady = resolve))

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

  const start = () => {
    if (started) return
    started = true
    timer = setTimeout(() => fallBack('timeout'), READY_TIMEOUT_MS)
    try {
      stop = onSnapshot(
        collection(getDb(), 'igrejas', FIREBASE_TENANT, name),
        (snapshot) => {
          clearTimeout(timer)
          // Se a nuvem demorou e ainda não houve gravação local, vale mais voltar para a nuvem.
          if (mode === 'local' && !(fellBackByTimeout && !localWrites)) return
          mode = 'cloud'
          confirmed ||= !snapshot.metadata.fromCache
          for (const [id, op] of overlay) if (op.acked) overlay.delete(id)
          server = new Map(snapshot.docs.map((d) => [d.id, { ...d.data(), id: d.id } as T]))
          reportRepoState(name, { state: confirmed ? 'online' : 'cache' })
          rebuild()
          markReady()
          emit()
        },
        (error) => {
          if (mode === 'cloud') reportRepoState(name, { state: 'cache', reason: explainCloudError(error) })
          else fallBack(error)
        },
      )
    } catch (error) {
      fallBack(error)
    }
  }

  /** Aplica a mudança na tela já e envia ao Firestore em seguida. */
  const commit = (id: ID, value: T | null, send: () => Promise<unknown>) => {
    const mine = ++version
    overlay.set(id, { value, version: mine, acked: false })
    rebuild()
    emit()
    send().then(
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
        reportWriteError(error)
      },
    )
  }

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
    async create(data) {
      start()
      await ready
      if (isLocal()) {
        localWrites = true
        return local.create(data)
      }
      const id = data.id ?? uid(idPrefix)
      if (current.some((item) => item.id === id)) throw new Error('Já existe um registro com este código.')
      const stamp = now()
      const item = { ...(await prepare(data as Partial<T>)), id, createdAt: stamp, updatedAt: stamp } as T
      commit(id, item, () => setDoc(docRef(id), item))
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
