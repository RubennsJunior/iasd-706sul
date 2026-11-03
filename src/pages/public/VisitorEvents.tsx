import { useMemo, useState } from 'react'
import { CalendarDays, MapPin, SearchX } from 'lucide-react'
import { StatusBadge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { DateChip } from '../../components/ui/DateChip'
import { EmptyState, SearchBar } from '../../components/ui/Misc'
import { useEvents } from '../../hooks/useData'
import { eventPhase } from '../../services'
import { compareDateTime, formatMonthYear, formatTime, monthKey, todayISO } from '../../utils/date'
import { groupBy, matchesQuery } from '../../utils/misc'

/** Agenda para o visitante: só título, dia, horário, local e situação — sem responsáveis nem participantes. */
export function VisitorEvents() {
  const { items: events } = useEvents()
  const [query, setQuery] = useState('')
  const today = todayISO()

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.date >= today && eventPhase(e, today) !== 'realizado')
        .filter((e) => matchesQuery(query, e.title, e.location))
        .sort(compareDateTime),
    [events, query, today],
  )
  const byMonth = useMemo(() => groupBy(upcoming, (e) => monthKey(e.date)), [upcoming])

  return (
    <div className="space-y-4">
      <SearchBar value={query} onChange={setQuery} placeholder="Buscar evento…" />

      {upcoming.length === 0 ? (
        <EmptyState
          icon={query ? SearchX : CalendarDays}
          title={query ? 'Nenhum evento encontrado' : 'Nenhum evento programado'}
          description={query ? 'Tente outra busca.' : 'Quando houver novos eventos, eles aparecem aqui.'}
        />
      ) : (
        Object.entries(byMonth).map(([month, items]) => (
          <section key={month} aria-labelledby={`mes-${month}`}>
            <h2 id={`mes-${month}`} className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-navy-800">
              {formatMonthYear(month)}
            </h2>
            <ul className="space-y-2.5">
              {items.map((event) => (
                <li key={event.id}>
                  <Card className="flex items-center gap-3.5 p-3.5">
                    <DateChip date={event.date} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[17px] font-semibold leading-tight text-navy-900">{event.title}</h3>
                      <p className="text-sm text-ink">
                        {formatTime(event.time)}
                        {event.location && (
                          <>
                            {' • '}
                            <MapPin className="-mt-0.5 inline size-3.5 text-navy-800" /> {event.location}
                          </>
                        )}
                      </p>
                    </div>
                    <StatusBadge kind="event" value={eventPhase(event, today)} />
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
