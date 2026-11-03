import type { ChurchEvent, Member, Roster, Team } from '../models'
import { diffInDays, parseISODate, toISODate, todayISO } from '../utils/date'
import { eventPhase } from './agenda'

export function countBy<T>(items: T[], keyOf: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {}
  for (const item of items) {
    const key = keyOf(item)
    result[key] = (result[key] ?? 0) + 1
  }
  return result
}

export function membersByStatus(members: Member[]) {
  return countBy(members, (m) => m.status)
}

export function teamsBySize(teams: Team[]) {
  return [...teams]
    .map((team) => ({ id: team.id, name: team.name, members: team.memberIds.length }))
    .sort((a, b) => b.members - a.members)
}

export function eventsByPhase(events: ChurchEvent[], today: string = todayISO()) {
  return countBy(events, (e) => eventPhase(e, today))
}

export function rosterResponses(rosters: Roster[], today: string = todayISO()) {
  const slots = rosters.filter((r) => r.date >= today).flatMap((r) => r.assignments)
  const counts = countBy(slots, (a) => a.status)
  const total = slots.length
  return {
    total,
    confirmado: counts.confirmado ?? 0,
    pendente: counts.pendente ?? 0,
    recusado: counts.recusado ?? 0,
    rate: total === 0 ? 0 : Math.round(((counts.confirmado ?? 0) / total) * 100),
  }
}

export function attendanceRate(events: ChurchEvent[], today: string = todayISO()) {
  const finished = events.filter((e) => eventPhase(e, today) === 'realizado')
  const slots = finished.flatMap((e) => e.participants)
  const present = slots.filter((p) => p.status === 'presente').length
  const absent = slots.filter((p) => p.status === 'ausente').length
  const counted = present + absent
  return { present, absent, rate: counted === 0 ? 0 : Math.round((present / counted) * 100) }
}

/** Aniversariantes dos próximos `days` dias, do mais próximo ao mais distante. */
export function upcomingBirthdays(members: Member[], days = 30, today: string = todayISO()) {
  const year = parseISODate(today).getFullYear()
  return members
    .filter((m) => m.birthDate && m.status !== 'inativo')
    .map((member) => {
      const birth = parseISODate(member.birthDate)
      let next = toISODate(new Date(year, birth.getMonth(), birth.getDate()))
      if (next < today) next = toISODate(new Date(year + 1, birth.getMonth(), birth.getDate()))
      return { member, date: next, inDays: diffInDays(next, today) }
    })
    .filter((row) => row.inDays <= days)
    .sort((a, b) => a.inDays - b.inDays)
}
