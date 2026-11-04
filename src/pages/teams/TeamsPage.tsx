import { useMemo, useState } from 'react'
import { ChevronRight, Crown, Info, Plus, SearchX, Star, UserRound, Users, UsersRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusBadge } from '../../components/ui/Badge'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { EmptyState, Fab, FilterMenu, SearchBar } from '../../components/ui/Misc'
import { SegmentedTabs } from '../../components/ui/Tabs'
import { TeamEmblem } from '../../components/ui/TeamEmblem'
import { useAuth } from '../../contexts/AuthContext'
import { useDepartments, useMemberNames, useScopedTeams } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import { ACTIVE_STATUS_OPTIONS } from '../../utils/labels'
import { matchesQuery, pluralize } from '../../utils/misc'

type Tab = 'todas' | 'minhas' | 'lideranca' | 'nova'

export function TeamsPage() {
  const { can, member, scope } = useAuth()
  const { items: teams } = useScopedTeams()
  const { items: departments } = useDepartments()
  const { nameOf } = useMemberNames()
  const [tab, setTab] = useState<Tab>('todas')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const navigate = useNavigate()

  // equipe nova: quem vê a igreja toda, ou quem tem um departamento (dentro dele)
  const canCreate = can('equipes', 'create') && (scope.all || scope.reach === 'departamento')

  const visible = useMemo(
    () =>
      teams.filter((t) => {
        if (tab === 'minhas' && !(member && t.memberIds.includes(member.id))) return false
        if (tab === 'lideranca' && !(member && t.leaderId === member.id)) return false
        if (filters.department && t.departmentId !== filters.department) return false
        if (filters.status && t.status !== filters.status) return false
        return matchesQuery(query, t.name, t.description, nameOf(t.leaderId))
      }),
    [teams, tab, member, query, filters, nameOf],
  )

  const tabs = [
    { key: 'todas' as const, label: 'Todas', icon: Users },
    { key: 'minhas' as const, label: 'Minhas Equipes', icon: Star },
    { key: 'lideranca' as const, label: 'Liderança', icon: Crown },
    ...(canCreate ? [{ key: 'nova' as const, label: 'Nova Equipe', icon: Plus }] : []),
  ]

  return (
    <Page title="Equipes" subtitle="Nossos ministérios e equipes" icon={UsersRound}>
      <div className="space-y-4">
        <SegmentedTabs
          items={tabs}
          value={tab}
          onChange={(key) => (key === 'nova' ? navigate('/equipes/nova') : setTab(key))}
        />
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar equipes…">
          <FilterMenu
            filters={[
              {
                key: 'department',
                label: 'Departamento',
                options: departments.map((d) => ({ value: d.id, label: d.name })),
              },
              { key: 'status', label: 'Situação', options: ACTIVE_STATUS_OPTIONS },
            ]}
            values={filters}
            onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
          />
          {canCreate && (
            <div className="hidden lg:block">
              <Button icon={Plus} onClick={() => navigate('/equipes/nova')}>
                Nova Equipe
              </Button>
            </div>
          )}
        </SearchBar>

        {visible.length === 0 ? (
          <EmptyState
            icon={query ? SearchX : UsersRound}
            title={tab === 'minhas' ? 'Você ainda não participa de equipes' : 'Nenhuma equipe encontrada'}
            description={tab === 'lideranca' ? 'Você não lidera nenhuma equipe no momento.' : 'Ajuste a busca ou os filtros.'}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {visible.map((team) => {
              return (
                <li key={team.id}>
                  <Link
                    to={`/equipes/${team.id}`}
                    className="flex items-center gap-4 rounded-3xl bg-white p-3.5 shadow-card transition-shadow hover:shadow-float"
                  >
                    <TeamEmblem team={team} />
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-lg font-semibold leading-tight text-navy-900">{team.name}</span>
                        <StatusBadge kind="active" value={team.status} />
                      </span>
                      <span className="block wrap-anywhere text-sm text-ink">{team.description}</span>
                      <span className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 text-[13px] text-ink">
                        <span className="inline-flex items-center gap-1.5">
                          <UsersRound className="size-4 text-navy-800" />
                          {pluralize(team.memberIds.length, 'Membro')}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <UserRound className="size-4 shrink-0 text-navy-800" />
                          <span className="wrap-anywhere">Líder: {nameOf(team.leaderId)}</span>
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-royal-600" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <Banner
          icon={<Info className="size-7 shrink-0 text-royal-600" />}
          title={`Total de equipes: ${teams.length}`}
          description="Juntos no propósito de servir a Deus!"
          actions={
            can('relatorios') && (
              <Link to="/relatorios">
                <Button size="sm">Ver Relatório</Button>
              </Link>
            )
          }
        />
      </div>

      {canCreate && <Fab label="Nova Equipe" onClick={() => navigate('/equipes/nova')} />}
    </Page>
  )
}
