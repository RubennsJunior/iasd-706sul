import type {
  AssignmentStatus,
  ChurchEvent,
  EventStatus,
  ID,
  ParticipantStatus,
  Roster,
  WorshipService,
} from '../models'
import { repos } from '../repositories'
import { addDays, compareDateTime, diffInDays, monthKey, todayISO } from '../utils/date'
import { matchesQuery } from '../utils/misc'
import { createCrudService } from './crud'
import { assertScope } from './scope'
import { notify } from './system'

/* Eventos */

export type EventPhase = 'em-breve' | EventStatus

/** Situação exibida: eventos passados contam como realizados, e os próximos 7 dias como "em breve". */
export function eventPhase(event: ChurchEvent, today: string = todayISO()): EventPhase {
  if (event.status === 'cancelado') return 'cancelado'
  if (event.status === 'realizado' || event.date < today) return 'realizado'
  if (event.status === 'planejado' && diffInDays(event.date, today) <= 7) return 'em-breve'
  return event.status
}

export type EventFilter = 'todos' | 'proximos' | 'mes' | 'realizados' | 'cancelados'

export function matchesEventFilter(
  event: ChurchEvent,
  filter: EventFilter,
  today: string = todayISO(),
): boolean {
  const phase = eventPhase(event, today)
  switch (filter) {
    case 'proximos':
      return phase !== 'cancelado' && phase !== 'realizado'
    case 'mes':
      return monthKey(event.date) === monthKey(today)
    case 'realizados':
      return phase === 'realizado'
    case 'cancelados':
      return phase === 'cancelado'
    default:
      return true
  }
}

export const eventsService = {
  ...createCrudService<ChurchEvent>(repos.events, {
    label: 'Evento',
    activityKind: 'evento',
    nameOf: (e) => e.title,
    async afterSave(event, previous) {
      if (previous && previous.status !== 'cancelado' && event.status === 'cancelado') {
        await notify('evento', `${event.title} cancelado`, 'A diretoria cancelou este evento. Veja os detalhes na agenda.')
      }
    },
    async beforeRemove(event) {
      for (const roster of await repos.rosters.list()) {
        if (roster.linked === `evento:${event.id}`) {
          await repos.rosters.update(roster.id, { linked: undefined })
        }
      }
    },
  }),

  async addParticipant(eventId: ID, memberId: ID, status: ParticipantStatus = 'inscrito') {
    const event = await repos.events.get(eventId)
    if (!event) throw new Error('Evento não encontrado.')
    if (event.participants.some((p) => p.memberId === memberId)) {
      throw new Error('Este membro já participa do evento.')
    }
    return repos.events.update(eventId, { participants: [...event.participants, { memberId, status }] })
  },

  async setParticipantStatus(eventId: ID, memberId: ID, status: ParticipantStatus) {
    const event = await repos.events.get(eventId)
    if (!event) throw new Error('Evento não encontrado.')
    return repos.events.update(eventId, {
      participants: event.participants.map((p) => (p.memberId === memberId ? { ...p, status } : p)),
    })
  },

  async removeParticipant(eventId: ID, memberId: ID) {
    const event = await repos.events.get(eventId)
    if (!event) throw new Error('Evento não encontrado.')
    return repos.events.update(eventId, {
      participants: event.participants.filter((p) => p.memberId !== memberId),
    })
  },
}

/* Cultos e programações */

export const worshipService = createCrudService<WorshipService>(repos.services, {
  label: 'Culto',
  activityKind: 'culto',
  nameOf: (s) => s.title,
  async beforeRemove(service) {
    for (const roster of await repos.rosters.list()) {
      if (roster.linked === `culto:${service.id}`) {
        await repos.rosters.update(roster.id, { linked: undefined })
      }
    }
  },
})

/* Escalas */

export type RosterDraft = Pick<Roster, 'date' | 'time' | 'assignments'> & { id?: ID }

/**
 * Procura problemas na escala: membro repetido ou já escalado no mesmo dia e horário em outra escala.
 * Escalas recusadas não contam como conflito.
 */
export function findRosterConflicts(
  draft: RosterDraft,
  others: Roster[],
  nameOf: (memberId: ID) => string,
): string[] {
  const problems: string[] = []
  const seen = new Set<ID>()
  for (const slot of draft.assignments) {
    if (seen.has(slot.memberId)) {
      problems.push(`${nameOf(slot.memberId)} aparece mais de uma vez nesta escala.`)
    }
    seen.add(slot.memberId)
  }
  for (const other of others) {
    if (other.id === draft.id || other.date !== draft.date || other.time !== draft.time) continue
    for (const slot of draft.assignments) {
      const clash = other.assignments.find(
        (a) => a.memberId === slot.memberId && a.status !== 'recusado',
      )
      if (clash && slot.status !== 'recusado') {
        problems.push(`${nameOf(slot.memberId)} já está em “${other.title}” no mesmo horário.`)
      }
    }
  }
  return problems
}

export const rostersService = {
  ...createCrudService<Roster>(repos.rosters, {
    label: 'Escala',
    feminine: true,
    activityKind: 'escala',
    nameOf: (r) => r.title,
    authorize: (action, item, existing) => {
      if (existing) assertScope('roster', existing)
      if (action !== 'remove') assertScope('roster', item, { isNew: !existing })
    },
    async validate(data, existing) {
      if (!data.assignments || data.assignments.length === 0) {
        throw new Error('Inclua ao menos um integrante na escala.')
      }
      const members = await repos.members.list()
      const nameOf = (id: ID) => members.find((m) => m.id === id)?.fullName ?? 'Membro'
      const others = await repos.rosters.list()
      const problems = findRosterConflicts(
        {
          id: existing?.id,
          date: data.date ?? '',
          time: data.time ?? '',
          assignments: data.assignments,
        },
        others,
        nameOf,
      )
      if (problems.length > 0) throw new Error(problems[0])
    },
    async afterSave(roster, previous) {
      if (previous) return
      const team = await repos.teams.get(roster.teamId)
      await notify('escala', `Nova escala: ${roster.title}`, `${team?.name ?? 'Equipe'} tem uma nova escala. Confirme sua presença.`)
    },
  }),

  async respond(rosterId: ID, memberId: ID, status: AssignmentStatus) {
    const roster = await repos.rosters.get(rosterId)
    if (!roster) throw new Error('Escala não encontrada.')
    if (!roster.assignments.some((a) => a.memberId === memberId)) {
      throw new Error('Você não está nesta escala.')
    }
    return repos.rosters.update(rosterId, {
      assignments: roster.assignments.map((a) => (a.memberId === memberId ? { ...a, status } : a)),
    })
  },
}

export function rosterProgress(roster: Roster) {
  const total = roster.assignments.length
  const confirmed = roster.assignments.filter((a) => a.status === 'confirmado').length
  const declined = roster.assignments.filter((a) => a.status === 'recusado').length
  return {
    total,
    confirmed,
    declined,
    pending: total - confirmed - declined,
    complete: total > 0 && confirmed === total,
  }
}

export function upcomingRostersFor(rosters: Roster[], memberId: ID, today: string = todayISO()) {
  return rosters
    .filter((r) => r.date >= today && r.assignments.some((a) => a.memberId === memberId))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
}

/** Escalas futuras em que aparece alguém com o nome buscado (mínimo de 3 letras). */
export function searchRostersByName(
  rosters: Roster[],
  nameOf: (memberId: ID) => string,
  query: string,
  today: string = todayISO(),
) {
  if (query.trim().length < 3) return []
  return rosters
    .filter((roster) => roster.date >= today)
    .map((roster) => ({
      roster,
      slots: roster.assignments.filter((slot) => matchesQuery(query, nameOf(slot.memberId))),
    }))
    .filter((match) => match.slots.length > 0)
    .sort((a, b) => compareDateTime(a.roster, b.roster))
}

export function weekAhead(today: string = todayISO()) {
  return { start: today, end: addDays(today, 6) }
}
