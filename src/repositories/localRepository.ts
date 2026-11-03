import type { Entity, ID } from '../models'
import { uid } from '../utils/misc'
import type { ResettableRepository } from './repository'

export const STORAGE_NAMESPACE = 'igreja-sda'
export const DATA_VERSION = '1'

const memoryFallback = new Map<string, string>()

export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return memoryFallback.get(key) ?? null
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      memoryFallback.set(key, value)
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      memoryFallback.delete(key)
    }
  },
  keys(): string[] {
    try {
      return Object.keys(window.localStorage)
    } catch {
      return [...memoryFallback.keys()]
    }
  },
}

/** Descarta dados gravados por uma versão incompatível do esquema. */
export function ensureDataVersion() {
  const versionKey = `${STORAGE_NAMESPACE}:version`
  if (storage.get(versionKey) === DATA_VERSION) return
  for (const key of storage.keys()) {
    if (key.startsWith(`${STORAGE_NAMESPACE}:`)) storage.remove(key)
  }
  storage.set(versionKey, DATA_VERSION)
}

export function createLocalRepository<T extends Entity>(
  name: string,
  seed: () => T[],
  idPrefix = name.slice(0, 3),
): ResettableRepository<T> {
  const key = `${STORAGE_NAMESPACE}:${name}`
  const listeners = new Set<() => void>()
  let cache: T[] | null = null

  const read = (): T[] => {
    if (cache) return cache
    const raw = storage.get(key)
    if (raw) {
      try {
        cache = JSON.parse(raw) as T[]
        return cache
      } catch {
        // dados corrompidos: volta para os dados de exemplo
      }
    }
    cache = seed()
    storage.set(key, JSON.stringify(cache))
    return cache
  }

  const write = (items: T[]) => {
    cache = items
    storage.set(key, JSON.stringify(items))
    emit()
  }

  const emit = () => listeners.forEach((listener) => listener())

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === key || event.key === null) {
        cache = null
        emit()
      }
    })
  }

  const now = () => new Date().toISOString()

  return {
    async list() {
      return [...read()]
    },
    async get(id: ID) {
      return read().find((item) => item.id === id)
    },
    async create(data) {
      const items = read()
      const id = data.id ?? uid(idPrefix)
      if (items.some((item) => item.id === id)) throw new Error('Já existe um registro com este código.')
      const created = { ...data, id, createdAt: now(), updatedAt: now() } as T
      write([...items, created])
      return created
    },
    async update(id, patch) {
      const items = read()
      const index = items.findIndex((item) => item.id === id)
      if (index < 0) throw new Error('Registro não encontrado.')
      const updated = { ...items[index], ...patch, id, updatedAt: now() } as T
      write(items.map((item, i) => (i === index ? updated : item)))
      return updated
    },
    async remove(id) {
      write(read().filter((item) => item.id !== id))
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    peek: () => [...read()],
    reset() {
      cache = null
      storage.remove(key)
      emit()
    },
    dump: () => [...read()],
    load(items) {
      write(items)
    },
  }
}
