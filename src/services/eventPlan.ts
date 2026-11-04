import type { ChurchEvent, EventAction, EventDynamic, EventLiturgyItem, EventScheduleItem, ID } from '../models'

/**
 * Plano do evento: cronograma (horários), liturgia (ordem), dinâmicas e ações que as pessoas escolhem.
 * Tudo aqui é função pura — as telas e o serviço de eventos só montam e gravam o resultado.
 */

export interface EventPlan {
  schedule: EventScheduleItem[]
  liturgy: EventLiturgyItem[]
  dynamics: EventDynamic[]
  actions: EventAction[]
}

export const emptyPlan = (): EventPlan => ({ schedule: [], liturgy: [], dynamics: [], actions: [] })

/** Plano de um evento; eventos gravados antes destes campos existirem têm tudo vazio. */
export const planOf = (event?: Pick<ChurchEvent, 'schedule' | 'liturgy' | 'dynamics' | 'actions'>): EventPlan => ({
  schedule: event?.schedule ?? [],
  liturgy: event?.liturgy ?? [],
  dynamics: event?.dynamics ?? [],
  actions: event?.actions ?? [],
})

export const planCount = (plan: EventPlan) => plan.schedule.length + plan.liturgy.length + plan.dynamics.length + plan.actions.length

/** Troca o item de lugar com o vizinho (`delta` -1 sobe, +1 desce); fora dos limites não muda nada. */
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

const text = (value: string | undefined) => (value ?? '').trim()
const orUndefined = (value: string | undefined) => text(value) || undefined

const positive = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
}

/** Tira linhas em branco, apara os textos e põe o cronograma em ordem de horário. */
export function cleanPlan(plan: EventPlan): EventPlan {
  return {
    schedule: plan.schedule
      .filter((item) => text(item.title))
      .map((item) => ({ id: item.id, time: item.time, title: text(item.title), responsibleId: item.responsibleId || undefined, notes: orUndefined(item.notes) }))
      .sort((a, b) => a.time.localeCompare(b.time)),
    liturgy: plan.liturgy
      .filter((item) => text(item.title))
      .map((item) => ({ id: item.id, kind: item.kind, title: text(item.title), details: orUndefined(item.details), responsibleId: item.responsibleId || undefined })),
    dynamics: plan.dynamics
      .filter((item) => text(item.title))
      .map((item) => ({
        id: item.id,
        title: text(item.title),
        description: orUndefined(item.description),
        minutes: positive(item.minutes),
        materials: orUndefined(item.materials),
        responsibleId: item.responsibleId || undefined,
      })),
    actions: plan.actions
      .filter((item) => text(item.title))
      .map((item) => ({
        id: item.id,
        title: text(item.title),
        description: orUndefined(item.description),
        slots: positive(item.slots),
        memberIds: [...new Set(item.memberIds ?? [])],
      })),
  }
}

/** Mensagens de erro por campo do formulário (chaves iguais aos nomes dos campos). */
export function validatePlan(plan: EventPlan): Record<string, string> {
  const errors: Record<string, string> = {}
  if (plan.schedule.some((item) => text(item.title) && !item.time)) errors.schedule = 'Informe o horário de cada item do cronograma.'
  if (plan.dynamics.some((item) => text(item.title) && String(item.minutes ?? '').trim() !== '' && !positive(item.minutes))) {
    errors.dynamics = 'A duração da dinâmica deve ser um número de minutos maior que zero.'
  }
  const badSlots = plan.actions.find((item) => text(item.title) && String(item.slots ?? '').trim() !== '' && !positive(item.slots))
  if (badSlots) errors.actions = 'O número de vagas deve ser maior que zero (ou deixe em branco para não limitar).'
  const tooMany = plan.actions.find((item) => text(item.title) && positive(item.slots) !== undefined && item.memberIds.length > (positive(item.slots) as number))
  if (!errors.actions && tooMany) errors.actions = `“${text(tooMany.title)}” já tem mais pessoas do que vagas. Aumente as vagas ou tire alguém pela página do evento.`
  return errors
}

export interface ActionState {
  taken: number
  /** Vagas que sobram; `undefined` quando a ação não tem limite. */
  left?: number
  full: boolean
  mine: boolean
}

export function actionState(action: EventAction, memberId?: ID): ActionState {
  const taken = action.memberIds.length
  const left = action.slots === undefined ? undefined : Math.max(0, action.slots - taken)
  return { taken, left, full: left === 0, mine: Boolean(memberId && action.memberIds.includes(memberId)) }
}

/** Evento que ainda aceita escolhas de ação: não foi cancelado nem já passou/foi realizado. */
export const acceptsActions = (event: Pick<ChurchEvent, 'status' | 'date'>, today: string) =>
  event.status !== 'cancelado' && event.status !== 'realizado' && event.date >= today

/** Resultado de escolher ou largar uma ação (função pura; o serviço grava). */
export function applyActionChoice(actions: EventAction[], actionId: ID, memberId: ID, take: boolean): EventAction[] {
  const action = actions.find((a) => a.id === actionId)
  if (!action) throw new Error('Esta ação não existe mais neste evento.')
  const has = action.memberIds.includes(memberId)
  if (take) {
    if (has) throw new Error('Esta pessoa já escolheu esta ação.')
    if (action.slots !== undefined && action.memberIds.length >= action.slots) {
      throw new Error('Todas as vagas desta ação já foram preenchidas.')
    }
    return actions.map((a) => (a.id === actionId ? { ...a, memberIds: [...a.memberIds, memberId] } : a))
  }
  if (!has) return actions
  return actions.map((a) => (a.id === actionId ? { ...a, memberIds: a.memberIds.filter((m) => m !== memberId) } : a))
}
