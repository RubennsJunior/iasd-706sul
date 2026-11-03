import { useMemo, useState } from 'react'
import { CalendarCheck, Crown, Pencil, Trash2, UserPlus, UsersRound, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/Misc'
import { teamIcon } from '../../components/ui/icons'
import { Select } from '../../components/forms/Select'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { useDepartments, useLeaders, useMemberNames, usePositions, useRosters, useScopedTeams } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import { teamsService } from '../../services'
import { formatDate, formatDateShort, formatTime, todayISO } from '../../utils/date'
import { pluralize } from '../../utils/misc'

export function TeamDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { items: teams, loading } = useScopedTeams()
  const { items: departments } = useDepartments()
  const { items: leaders } = useLeaders()
  const { items: positions } = usePositions()
  const { items: rosters } = useRosters()
  const { members, byId, nameOf } = useMemberNames()
  const [newMember, setNewMember] = useState('')

  const team = teams.find((t) => t.id === id)
  const upcoming = useMemo(
    () =>
      rosters
        .filter((r) => r.teamId === id && r.date >= todayISO())
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    [rosters, id],
  )

  if (!team) {
    return (
      <Page title="Equipe" subtitle="Detalhes da equipe" icon={UsersRound} back="/equipes">
        {!loading && (
          <EmptyState
            icon={UsersRound}
            title="Equipe não encontrada"
            action={
              <Link to="/equipes">
                <Button>Ver equipes</Button>
              </Link>
            }
          />
        )}
      </Page>
    )
  }

  const Icon = teamIcon(team.icon)
  const canEdit = can('equipes', 'edit')
  const department = departments.find((d) => d.id === team.departmentId)
  const teamLeaders = leaders.filter((l) => l.scope === 'equipe' && l.scopeId === team.id)
  const available = members.filter((m) => m.status !== 'inativo' && !team.memberIds.includes(m.id))

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const removeMember = async (memberId: string) => {
    const ok = await confirm({
      title: 'Remover integrante?',
      message: `${nameOf(memberId)} deixará de fazer parte de ${team.name}.`,
      confirmLabel: 'Remover',
    })
    if (ok) await run(() => teamsService.removeMember(team.id, memberId), 'Integrante removido.')
  }

  const removeTeam = async () => {
    const ok = await confirm({
      title: 'Excluir equipe?',
      message: (
        <>
          A equipe <strong className="text-navy-900">{team.name}</strong> será excluída. Esta ação não pode ser
          desfeita.
        </>
      ),
    })
    if (!ok) return
    try {
      await teamsService.remove(team.id)
      toast.success('Equipe excluída.')
      navigate('/equipes', { replace: true })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Page title={team.name} subtitle={team.description} icon={UsersRound} back="/equipes">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              <span className="relative grid size-20 shrink-0 place-items-center rounded-full bg-navy-900 text-white ring-4 ring-royal-50">
                <Icon className="size-9" strokeWidth={1.6} />
                <span className="absolute inset-x-4 bottom-2 h-0.5 rounded-full bg-gold-500" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-navy-900">{team.name}</h2>
                  <StatusBadge kind="active" value={team.status} />
                </div>
                <p className="text-ink">{team.description || 'Sem descrição.'}</p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Link to={`/equipes/${team.id}/editar`}>
                    <Button size="sm" variant="outline" icon={Pencil}>
                      Editar
                    </Button>
                  </Link>
                  {can('equipes', 'delete') && (
                    <Button size="sm" variant="outline" icon={Trash2} className="text-red-600" onClick={removeTeam}>
                      Excluir
                    </Button>
                  )}
                </div>
              )}
            </div>
            <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-4">
              {[
                ['Integrantes', pluralize(team.memberIds.length, 'membro')],
                ['Líder responsável', nameOf(team.leaderId)],
                ['Departamento', department?.name ?? '—'],
                ['Criada em', formatDate(team.foundedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <section>
            <SectionHeader title="Integrantes" icon={UsersRound} />
            <Card className="p-2">
              {canEdit && (
                <form
                  className="flex gap-2 border-b border-line p-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!newMember) return
                    void run(() => teamsService.addMember(team.id, newMember), 'Integrante adicionado.')
                    setNewMember('')
                  }}
                >
                  <Select
                    aria-label="Adicionar integrante"
                    value={newMember}
                    onChange={setNewMember}
                    options={available.map((m) => ({ value: m.id, label: m.fullName }))}
                    placeholder="Adicionar integrante…"
                  />
                  <Button type="submit" icon={UserPlus} disabled={!newMember}>
                    Adicionar
                  </Button>
                </form>
              )}
              {team.memberIds.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Esta equipe ainda não tem integrantes.</p>
              ) : (
                <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
                  {team.memberIds.map((memberId) => {
                    const person = byId.get(memberId)
                    return (
                      <li key={memberId} className="flex items-center gap-3 px-3 py-2.5">
                        <Avatar name={person?.fullName ?? '?'} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{person?.fullName ?? '—'}</span>
                          {person?.phone && <span className="block text-xs text-muted">{person.phone}</span>}
                        </span>
                        {team.leaderId === memberId && (
                          <Badge tone="gold" icon={Crown}>
                            Líder
                          </Badge>
                        )}
                        {canEdit && team.leaderId !== memberId && (
                          <button
                            type="button"
                            aria-label={`Remover ${person?.fullName}`}
                            onClick={() => removeMember(memberId)}
                            className="grid size-8 place-items-center rounded-full text-red-600 hover:bg-red-50"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </section>
        </div>

        <aside className="space-y-4">
          <section>
            <SectionHeader title="Liderança" icon={Crown} />
            <Card className="divide-y divide-line">
              {teamLeaders.length === 0 ? (
                <p className="p-4 text-sm text-muted">Nenhuma liderança cadastrada.</p>
              ) : (
                teamLeaders.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={nameOf(l.memberId)} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{nameOf(l.memberId)}</p>
                      <p className="text-xs text-muted">{positions.find((p) => p.id === l.positionId)?.name}</p>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </section>

          <section>
            <SectionHeader title="Próximas escalas" icon={CalendarCheck} to="/escalas" linkLabel="Ver escalas" />
            {upcoming.length === 0 ? (
              <Card className="p-4 text-sm text-muted">Nenhuma escala futura para esta equipe.</Card>
            ) : (
              <ul className="space-y-2.5">
                {upcoming.slice(0, 4).map((r) => {
                  const confirmed = r.assignments.filter((a) => a.status === 'confirmado').length
                  return (
                    <li key={r.id} className="rounded-2xl bg-white p-4 shadow-card">
                      <p className="font-semibold text-navy-900">{r.title}</p>
                      <p className="text-sm text-muted">
                        {formatDateShort(r.date)} • {formatTime(r.time)}
                      </p>
                      <p className="mt-1 text-xs text-ink">
                        {confirmed} de {r.assignments.length} confirmados
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

    </Page>
  )
}
