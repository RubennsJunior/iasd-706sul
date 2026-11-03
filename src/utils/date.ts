const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTHS_LONG = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

/** Próxima ocorrência do dia da semana (0 = domingo) a partir de `from`, incluindo o próprio dia. */
export function nextWeekday(weekday: number, from: string = todayISO()): string {
  const date = parseISODate(from)
  const diff = (weekday - date.getDay() + 7) % 7
  return addDays(from, diff)
}

export function diffInDays(a: string, b: string): number {
  const ms = parseISODate(a).getTime() - parseISODate(b).getTime()
  return Math.round(ms / 86_400_000)
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[parseISODate(iso).getDay()]
}

export function weekdayLong(iso: string): string {
  return WEEKDAYS_LONG[parseISODate(iso).getDay()]
}

/** "08/11" */
export function dayMonth(iso: string): string {
  if (!iso) return ''
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

/** "08/11/2026" */
export function formatDate(iso: string): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

/** "Sáb, 08 de Nov" */
export function formatDateShort(iso: string): string {
  if (!iso) return '—'
  const date = parseISODate(iso)
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${pad(date.getDate())} de ${MONTHS_SHORT[date.getMonth()]}`
}

/** "Sábado, 08 de Nov" */
export function formatDateMedium(iso: string): string {
  if (!iso) return '—'
  const date = parseISODate(iso)
  return `${WEEKDAYS_LONG[date.getDay()]}, ${pad(date.getDate())} de ${MONTHS_SHORT[date.getMonth()]}`
}

/** "Sábado, 08 de Novembro de 2026" */
export function formatDateLong(iso: string): string {
  if (!iso) return '—'
  const date = parseISODate(iso)
  return `${WEEKDAYS_LONG[date.getDay()]}, ${pad(date.getDate())} de ${MONTHS_LONG[date.getMonth()]} de ${date.getFullYear()}`
}

/** "08 Nov" */
export function formatDayMonthName(iso: string): string {
  const date = parseISODate(iso)
  return `${pad(date.getDate())} ${MONTHS_SHORT[date.getMonth()]}`
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function formatMonthYear(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return `${MONTHS_LONG[month - 1]} de ${year}`
}

/** "19h" ou "19h30" */
export function formatTime(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  return minutes && minutes !== '00' ? `${Number(hours)}h${minutes}` : `${Number(hours)}h`
}

export function formatDateTime(iso: string, time: string): string {
  return `${formatDateShort(iso)} • ${formatTime(time)}`
}

export function compareDateTime(
  a: { date: string; time?: string },
  b: { date: string; time?: string },
): number {
  return `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`)
}

export function isPast(date: string, today: string = todayISO()): boolean {
  return date < today
}

export function ageFrom(birthISO: string, today: string = todayISO()): number | null {
  if (!birthISO) return null
  const birth = parseISODate(birthISO)
  const now = parseISODate(today)
  let age = now.getFullYear() - birth.getFullYear()
  const hadBirthday =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate())
  if (!hadBirthday) age -= 1
  return age
}

export function weekRange(from: string = todayISO()): { start: string; end: string } {
  const date = parseISODate(from)
  const start = addDays(from, -date.getDay())
  return { start, end: addDays(start, 6) }
}

export function timeAgo(isoTimestamp: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(isoTimestamp).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`
  return formatDate(isoTimestamp.slice(0, 10))
}
