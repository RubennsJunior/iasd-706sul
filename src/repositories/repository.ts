import type { Entity, ID, NewEntity } from '../models'

/**
 * Contrato de acesso a dados. Há duas implementações: localStorage (LocalRepository) e Firestore
 * (FirestoreRepository, com sincronização entre aparelhos). A escolha é feita em `repositories/index.ts`
 * — serviços e telas não mudam.
 */
export interface Repository<T extends Entity> {
  list(): Promise<T[]>
  get(id: ID): Promise<T | undefined>
  create(data: NewEntity<T> & Partial<Pick<T, 'id'>>): Promise<T>
  update(id: ID, patch: Partial<NewEntity<T>>): Promise<T>
  remove(id: ID): Promise<void>
  /** Notifica alterações (inclusive de outras abas e aparelhos) para as telas recarregarem. */
  subscribe(listener: () => void): () => void
  /** Leitura síncrona, usada para evitar um quadro vazio no primeiro render; `undefined` enquanto os dados ainda não chegaram. */
  peek?(): T[] | undefined
}

export interface ResettableRepository<T extends Entity> extends Repository<T> {
  reset(): void | Promise<void>
  dump(): T[]
  load(items: T[]): void | Promise<void>
}
