import type { Entity, NewEntity } from '../models'
import type { Repository } from '../repositories/repository'
import { logActivity } from './activity'

export interface CrudService<T extends Entity> {
  repo: Repository<T>
  label: string
  nameOf(item: T): string
  list(): Promise<T[]>
  get(id: string): Promise<T | undefined>
  create(data: NewEntity<T>): Promise<T>
  update(id: string, patch: Partial<NewEntity<T>>): Promise<T>
  remove(id: string): Promise<void>
}

export interface CrudOptions<T extends Entity> {
  label: string
  feminine?: boolean
  activityKind: string
  nameOf(item: T): string
  /** Regras de negócio antes de salvar; lance Error com uma mensagem amigável. */
  validate?(data: Partial<NewEntity<T>>, existing?: T): Promise<void> | void
  /** Verificações e limpezas antes de excluir. */
  beforeRemove?(item: T): Promise<void> | void
  afterSave?(item: T, previous?: T): Promise<void> | void
  afterRemove?(item: T): Promise<void> | void
  /** Não registra no feed de atividades recentes. */
  silent?: boolean
  /** Trava de abrangência do perfil: lance Error (mensagem amigável) se quem está logado não alcança o item. */
  authorize?(action: 'create' | 'update' | 'remove', item: Partial<T>, existing?: T): void
}

export function createCrudService<T extends Entity>(
  repo: Repository<T>,
  options: CrudOptions<T>,
): CrudService<T> {
  const { label, activityKind, nameOf } = options
  const suffix = options.feminine ? 'a' : 'o'
  const note = async (item: T, action: string) => {
    if (!options.silent) await logActivity(`${label} “${nameOf(item)}” ${action}`, activityKind)
  }

  return {
    repo,
    label,
    nameOf,
    list: () => repo.list(),
    get: (id) => repo.get(id),
    async create(data) {
      options.authorize?.('create', data as Partial<T>)
      await options.validate?.(data)
      const created = await repo.create(data)
      await options.afterSave?.(created)
      await note(created, `cadastrad${suffix}`)
      return created
    },
    async update(id, patch) {
      const existing = await repo.get(id)
      if (!existing) throw new Error(`${label} não encontrad${suffix}.`)
      options.authorize?.('update', { ...existing, ...patch }, existing)
      await options.validate?.({ ...existing, ...patch }, existing)
      const updated = await repo.update(id, patch)
      await options.afterSave?.(updated, existing)
      await note(updated, `atualizad${suffix}`)
      return updated
    },
    async remove(id) {
      const existing = await repo.get(id)
      if (!existing) return
      options.authorize?.('remove', existing, existing)
      await options.beforeRemove?.(existing)
      await repo.remove(id)
      await options.afterRemove?.(existing)
      await note(existing, `excluíd${suffix}`)
    },
  }
}
