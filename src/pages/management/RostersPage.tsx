import { useMemo, useState } from 'react'
import {
  CalendarCheck,
  CalendarClock,
  Check,
  History,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Select } from '../../components/forms/Select'
import { Avatar } from '../../components/ui/Avatar'
import { StatusBadge } from '../../components/ui/Badge'
import { Button, IconButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, Fab, FilterMenu, ProgressBar, SearchBar } from '../../components/ui/Misc'
import { SegmentedTabs } from '../../components/ui/Tabs'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { useMemberNames, useScopedRosters, useTeams } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import type { AssignmentStatus, Roster } from '../../models'
import { rosterProgress, rostersService } from '../../services'
import { compareDateTime, dayMonth, formatTime, todayISO, weekdayShort } from '../../utils/date'
import { ASSIGNMENT_STATUS_OPTIONS } from '../../utils/labels'
import { matchesQuery } from '../../utils/misc'

type Tab = 'minhas' | 'todas' | 'passadas'

export function RostersPage() {
  const { can, member } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { items: rosters } = useScopedRosters()
  const { items: teams } = useTeams()
  const { nameOf } = useMemberNames()
  const today = todayISO()

  const canCreate = can('escalas', 'create')
  const canEdit = can('escalas', 'edit')
  const canDelete = can('escalas', 'delete')

  const requested = params.get('aba')
  const tab: Tab = requested === 'todas' || requested === 'passadas' || requested === 'minhas' ? requested : canCreate ? 'todas' : 'minhas'
  const setTab = (next: Tab) => setParams({ aba: next }, { replace: true })

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const mine = (r: Roster) => Boolean(member && r.assignments.some((a) => a.memberId === member.id))
  const counts = useMemo(
    () => ({
      minhas: rosters.filter((r) => r.date >= today && mine(r)).length,
      todas: rosters.filter((r) => r.date >= today).length,
      passadas: rosters.filter((r) => r.date < today).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rosters, today, member],
  )

  const visible = rosters
    .filter((r) => {
      if (tab === 'minhas' && !(r.date >= today && mine(r))) return false
      if (tab === 'todas' && r.date < today) return false
      if (tab === 'passadas' && r.date >= today) return false
      if (filters.team && r.teamId !== filters.team) return false
      return matchesQuery(query, r.title, r.location, teams.find((t) => t.id === r.teamId)?.name, ...r.assignments.map((a) => nameOf(a.memberId)))
    })
    .sort((a, b) => (tab === 'passadas' ? -1 : 1) * compareDateTime(a, b))

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const respond = (roster: Roster, memberId: string, status: AssignmentStatus) =>
    run(
      () => rostersService.respond(roster.id, memberId, status),
      status === 'confirmado' ? 'Presença confirmada. Obrigado!' : status === 'recusado' ? 'Resposta registrada. A liderança foi avisada.' : 'Situação atualizada.',
    )

  const remove = async (roster: Roster) => {
    const ok = await confirm({
      title: 'Excluir escala?',
      message: (
        <>
          A escala <strong className="text-navy-900">{roster.title}</strong> será excluída para todos os integrantes.
        </>
      ),
    })
    if (ok) await run(() => rostersService.remove(roster.id), 'Escala excluída.')
  }

  return (
    <Page title="Escalas" subtitle="Gerencie as escalas de serviço" icon={CalendarCheck}>
      <div className="space-y-4">
        <SegmentedTabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { key: 'minhas', label: 'Minhas Escalas', icon: UserCheck, count: counts.minhas },
            { key: 'todas', label: 'Próximas', icon: CalendarClock, count: counts.todas },
            { key: 'passadas', label: 'Anteriores', icon: History, count: counts.passadas },
          ]}
        />
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar escalas ou pessoas…">
          <FilterMenu
            filters={[{ key: 'team', label: 'Equipe', options: teams.map((t) => ({ value: t.id, label: t.name })) }]}
            values={filters}
            onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
          />
          {canCreate && (
            <div className="hidden lg:block">
              <Button icon={Plus} onClick={() => navigate('/escalas/nova')}>
                Nova Escala
              </Button>
            </div>
          )}
        </SearchBar>

        {visible.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={tab === 'minhas' ? 'Você não tem escalas próximas' : 'Nenhuma escala encontrada'}
            description={tab === 'minhas' ? 'Quando a liderança escalar você, ela aparece aqui para confirmar.' : 'Ajuste a busca ou os filtros.'}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {visible.map((roster) => {
              const progress = rosterProgress(roster)
              const team = teams.find((t) => t.id === roster.teamId)
              const mySlot = roster.assignments.find((a) => a.memberId === member?.id)
              const past = roster.date < today
              return (
                <li key={roster.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex size-[60px] shrink-0 flex-col items-center justify-center rounded-xl bg-navy-900 text-white">
                        <span className="text-xs">{weekdayShort(roster.date)}</span>
                        <span className="text-[15px] font-semibold leading-tight">{dayMonth(roster.date)}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold leading-tight text-navy-900">{roster.title}</h3>
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
                          <Users className="size-3.5" /> {team?.name ?? 'Equipe removida'}
                        </p>
                      </div>
                      {(canEdit || canDelete) && !past && (
                        <div className="flex shrink-0">
                          {canEdit && <IconButton icon={Pencil} label="Editar escala" onClick={() => navigate(`/escalas/${roster.id}/editar`)} />}
                          {canDelete && <IconButton icon={Trash2} label="Excluir escala" tone="danger" onClick={() => remove(roster)} />}
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs text-muted">
                        <span>
                          {progress.confirmed} de {progress.total} confirmados
                        </span>
                        {progress.declined > 0 && <span className="text-red-600">{progress.declined} recusou</span>}
                      </div>
                      <ProgressBar value={progress.total ? (progress.confirmed / progress.total) * 100 : 0} tone={progress.complete ? 'success' : 'royal'} />
                    </div>

                    {mySlot && !past && (
                      <div className="mt-3 rounded-2xl bg-royal-50 px-3 py-2.5">
                        <p className="text-sm text-ink">
                          Sua função: <strong className="text-navy-900">{mySlot.role}</strong>
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {mySlot.status !== 'confirmado' && (
                            <Button size="sm" icon={Check} onClick={() => respond(roster, member!.id, 'confirmado')}>
                              Confirmar
                            </Button>
                          )}
                          {mySlot.status !== 'recusado' && (
                            <Button size="sm" variant="outline" icon={X} onClick={() => respond(roster, member!.id, 'recusado')}>
                              Não posso
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    <ul className="mt-3 divide-y divide-line">
                      {roster.assignments.map((a) => (
                        <li key={a.memberId} className="flex items-center gap-3 py-2">
                          <Avatar name={nameOf(a.memberId)} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block wrap-anywhere text-sm font-medium text-ink">
                              {nameOf(a.memberId)}
                              {a.memberId === member?.id && <span className="ml-1.5 text-xs font-semibold text-royal-600">(você)</span>}
                            </span>
                            <span className="block text-xs text-muted">{a.role}</span>
                          </span>
                          {canEdit && !past ? (
                            <Select
                              variant="pill"
                              aria-label={`Situação de ${nameOf(a.memberId)}`}
                              value={a.status}
                              onChange={(status) => respond(roster, a.memberId, status as AssignmentStatus)}
                              options={ASSIGNMENT_STATUS_OPTIONS}
                            />
                          ) : (
                            <StatusBadge kind="assignment" value={a.status} />
                          )}
                        </li>
                      ))}
                    </ul>
                    {roster.notes && <p className="mt-2 rounded-xl bg-gold-100/60 px-3 py-2 text-xs text-ink">{roster.notes}</p>}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {canCreate && <Fab label="Nova Escala" onClick={() => navigate('/escalas/nova')} />}
    </Page>
  )
}
