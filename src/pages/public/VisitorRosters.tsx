import { useMemo, useState } from 'react'
import { CalendarCheck, CheckCircle2, Info, MapPin, Search, Users } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { DateChip } from '../../components/ui/DateChip'
import { EmptyState, FilterMenu, SearchBar } from '../../components/ui/Misc'
import { useMemberNames, useRosters, useTeams } from '../../hooks/useData'
import type { Roster } from '../../models'
import { searchRostersByName } from '../../services'
import { compareDateTime, formatTime, todayISO } from '../../utils/date'
import { cn, matchesQuery } from '../../utils/misc'

function RosterCard({ roster, teamName, nameOf, query }: { roster: Roster; teamName: string; nameOf(id: string): string; query: string }) {
  const searching = query.trim().length >= 3
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <DateChip date={roster.date} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold leading-tight text-navy-900">{roster.title}</h3>
          <p className="text-sm text-ink">
            {formatTime(roster.time)}
            {roster.location && (
              <>
                {' • '}
                <MapPin className="-mt-0.5 inline size-3.5 text-navy-800" /> {roster.location}
              </>
            )}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Users className="size-3.5" /> {teamName}
          </p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {roster.assignments.map((slot) => {
          const name = nameOf(slot.memberId)
          const mine = searching && matchesQuery(query, name)
          return (
            <li
              key={slot.memberId}
              className={cn('flex items-center justify-between gap-3 py-2 text-sm', mine && '-mx-2 rounded-lg bg-gold-100 px-2 font-semibold')}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-ink">
                {mine && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />}
                <span className="truncate">{name}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{slot.role}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** Escalas para o visitante: busca pelo nome para ver onde está escalado e lista das próximas escalas por equipe. */
export function VisitorRosters() {
  const { items: rosters } = useRosters()
  const { items: teams } = useTeams()
  const { nameOf } = useMemberNames()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const today = todayISO()

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? 'Equipe'
  const upcoming = useMemo(
    () =>
      rosters
        .filter((r) => r.date >= today && (!filters.team || r.teamId === filters.team))
        .sort(compareDateTime),
    [rosters, filters.team, today],
  )
  const mine = useMemo(() => searchRostersByName(upcoming, nameOf, query, today), [upcoming, nameOf, query, today])
  const typed = query.trim().length

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl bg-royal-100/70 px-4 py-3 text-sm text-ink">
        <Info className="mt-0.5 size-5 shrink-0 text-royal-600" />
        <p>Digite seu nome para ver em quais escalas você aparece. Se não encontrar, fale com a liderança da sua equipe.</p>
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder="Digite o seu nome…">
        <FilterMenu
          filters={[{ key: 'team', label: 'Equipe', options: teams.map((t) => ({ value: t.id, label: t.name })) }]}
          values={filters}
          onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
        />
      </SearchBar>

      {typed > 0 && typed < 3 && <p className="px-1 text-sm text-muted">Digite pelo menos 3 letras para buscar.</p>}

      {typed >= 3 && (
        <section aria-live="polite" className="space-y-3">
          {mine.length > 0 ? (
            <>
              <h2 className="flex items-center gap-2 px-1 text-base font-semibold text-navy-900">
                <CheckCircle2 className="size-5 text-emerald-600" />
                Encontramos {mine.length} {mine.length === 1 ? 'escala' : 'escalas'} com esse nome
              </h2>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {mine.map(({ roster }) => (
                  <li key={roster.id}>
                    <RosterCard roster={roster} teamName={teamName(roster.teamId)} nameOf={nameOf} query={query} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={Search}
              title="Não encontramos esse nome nas próximas escalas"
              description="Confira a grafia ou veja a lista completa abaixo."
            />
          )}
        </section>
      )}

      <section aria-label="Próximas escalas" className="space-y-3">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-navy-800">Próximas escalas das equipes</h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Nenhuma escala programada" description="Quando as equipes forem escaladas, elas aparecem aqui." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {upcoming.map((roster) => (
              <li key={roster.id}>
                <RosterCard roster={roster} teamName={teamName(roster.teamId)} nameOf={nameOf} query={query} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
