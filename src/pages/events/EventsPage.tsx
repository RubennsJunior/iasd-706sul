import { useMemo, useState } from 'react'
import { Ban, CalendarCheck, CalendarClock, CalendarDays, CalendarRange, Plus, SearchX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EventCard } from '../../components/events/EventCard'
import { Button } from '../../components/ui/Button'
import { EmptyState, Fab, FilterMenu, SearchBar } from '../../components/ui/Misc'
import { SegmentedTabs } from '../../components/ui/Tabs'
import { useAuth } from '../../contexts/AuthContext'
import { useEvents, useMemberNames } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import { eventPhase, matchesEventFilter } from '../../services'
import type { EventFilter } from '../../services'
import { compareDateTime } from '../../utils/date'
import { EVENT_STATUS_OPTIONS } from '../../utils/labels'
import { matchesQuery } from '../../utils/misc'

const TABS = [
  { key: 'todos' as const, label: 'Todos', icon: CalendarDays },
  { key: 'proximos' as const, label: 'Próximos', icon: CalendarClock },
  { key: 'mes' as const, label: 'Este Mês', icon: CalendarRange },
  { key: 'realizados' as const, label: 'Realizados', icon: CalendarCheck },
  { key: 'cancelados' as const, label: 'Cancelados', icon: Ban },
]

export function EventsPage() {
  const { can } = useAuth()
  const { items: events } = useEvents()
  const { nameOf } = useMemberNames()
  const navigate = useNavigate()

  const [tab, setTab] = useState<EventFilter>('todos')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const responsibleOptions = useMemo(() => {
    const ids = [...new Set(events.map((e) => e.responsibleId).filter(Boolean) as string[])]
    return ids.map((id) => ({ value: id, label: nameOf(id) }))
  }, [events, nameOf])

  const visible = useMemo(() => {
    const filtered = events.filter(
      (e) =>
        matchesEventFilter(e, tab) &&
        matchesQuery(query, e.title, e.location, e.description, nameOf(e.responsibleId)) &&
        (!filters.status || eventPhase(e) === filters.status || e.status === filters.status) &&
        (!filters.responsible || e.responsibleId === filters.responsible),
    )
    // Em ordem cronológica, com os já realizados por último (do mais recente ao mais antigo).
    const finished = (e: (typeof events)[number]) => eventPhase(e) === 'realizado'
    return filtered.sort((a, b) => {
      if (finished(a) !== finished(b)) return finished(a) ? 1 : -1
      return (finished(a) ? -1 : 1) * compareDateTime(a, b)
    })
  }, [events, tab, query, filters, nameOf])

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, events.filter((e) => matchesEventFilter(e, t.key)).length])),
    [events],
  )

  const canCreate = can('eventos', 'create')

  return (
    <Page title="Eventos" subtitle="Confira e participe dos nossos eventos" icon={CalendarDays}>
      <div className="space-y-4">
        <SegmentedTabs<EventFilter>
          value={tab}
          onChange={setTab}
          items={TABS.map((t) => ({ ...t, count: counts[t.key] }))}
        />
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar eventos…">
          <FilterMenu
            filters={[
              { key: 'status', label: 'Situação', options: EVENT_STATUS_OPTIONS },
              { key: 'responsible', label: 'Responsável', options: responsibleOptions },
            ]}
            values={filters}
            onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
          />
          {canCreate && (
            <div className="hidden lg:block">
              <Button icon={Plus} onClick={() => navigate('/eventos/novo')}>
                Novo Evento
              </Button>
            </div>
          )}
        </SearchBar>

        {visible.length === 0 ? (
          <EmptyState
            icon={query || filters.status || filters.responsible ? SearchX : CalendarDays}
            title="Nenhum evento encontrado"
            description={canCreate ? 'Ajuste os filtros ou cadastre um novo evento.' : 'Ajuste os filtros para ver outros eventos.'}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {visible.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      {canCreate && <Fab label="Novo Evento" onClick={() => navigate('/eventos/novo')} />}
    </Page>
  )
}
