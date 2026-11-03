import { useMemo } from 'react'
import { UserCheck } from 'lucide-react'
import { CrudPage } from '../../components/crud/CrudPage'
import type { FieldDef } from '../../components/forms/types'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { useDepartments, useMemberNames, usePositions, useTeams } from '../../hooks/useData'
import type { LeaderAssignment, LeaderScope } from '../../models'
import { leadersService } from '../../services'
import { formatDate, todayISO } from '../../utils/date'

const SCOPE_OPTIONS = [
  { value: 'equipe', label: 'Equipe' },
  { value: 'departamento', label: 'Departamento' },
]

export function LeadersPage() {
  const { members, nameOf } = useMemberNames()
  const { items: positions } = usePositions()
  const { items: teams } = useTeams()
  const { items: departments } = useDepartments()

  const scopeName = (scope: LeaderScope, id: string) =>
    (scope === 'equipe' ? teams : departments).find((x) => x.id === id)?.name ?? '—'
  const positionName = (id: string) => positions.find((p) => p.id === id)?.name ?? '—'

  const fields = useMemo<FieldDef[]>(
    () => [
      {
        name: 'memberId',
        label: 'Membro',
        type: 'select',
        required: true,
        span: 2,
        options: members.filter((m) => m.status !== 'inativo').map((m) => ({ value: m.id, label: m.fullName })),
        hint: 'Escolha um membro já cadastrado.',
      },
      {
        name: 'positionId',
        label: 'Cargo ou função',
        type: 'select',
        required: true,
        options: positions.map((p) => ({ value: p.id, label: p.name })),
      },
      { name: 'since', label: 'Desde', type: 'date', required: true },
      { name: 'scope', label: 'Vincular a', type: 'select', required: true, options: SCOPE_OPTIONS },
      {
        name: 'scopeId',
        label: 'Equipe ou departamento',
        type: 'select',
        required: true,
        optionsFor: (values) =>
          (values.scope === 'departamento' ? departments : teams).map((x) => ({ value: x.id, label: x.name })),
        validate: (value, values) => {
          const list = values.scope === 'departamento' ? departments : teams
          return list.some((x) => x.id === value) ? undefined : 'Selecione um item da lista.'
        },
      },
    ],
    [members, positions, teams, departments],
  )

  return (
    <CrudPage<LeaderAssignment>
      module="lideres"
      basePath="/lideres"
      title="Líderes"
      subtitle="Gerencie os líderes da igreja"
      icon={UserCheck}
      service={leadersService}
      entityLabel="Liderança"
      feminine
      newLabel="Nova Liderança"
      fields={fields}
      defaultValues={{ memberId: '', positionId: 'pos-lider', since: todayISO(), scope: 'equipe', scopeId: '' }}
      searchText={(l) => [nameOf(l.memberId), positionName(l.positionId), scopeName(l.scope, l.scopeId)]}
      sortBy={(a, b) => nameOf(a.memberId).localeCompare(nameOf(b.memberId), 'pt-BR')}
      fromForm={(values) => ({
        memberId: values.memberId,
        positionId: values.positionId,
        since: values.since,
        scope: values.scope,
        scopeId: values.scopeId,
      })}
      deleteWarning={(l) =>
        l.positionId === 'pos-lider' || l.positionId === 'pos-diretor'
          ? 'Este é o responsável principal; a equipe ou o departamento ficará sem líder definido.'
          : undefined
      }
      filters={[
        { key: 'scope', label: 'Vínculo', options: SCOPE_OPTIONS, predicate: (l, value) => l.scope === value },
        {
          key: 'position',
          label: 'Cargo',
          options: positions.map((p) => ({ value: p.id, label: p.name })),
          predicate: (l, value) => l.positionId === value,
        },
      ]}
      columns={[
        {
          header: 'Líder',
          sortValue: (l) => nameOf(l.memberId),
          cell: (l) => (
            <div className="flex items-center gap-3">
              <Avatar name={nameOf(l.memberId)} size="sm" />
              <span className="font-medium text-navy-900">{nameOf(l.memberId)}</span>
            </div>
          ),
        },
        { header: 'Cargo', sortValue: (l) => positionName(l.positionId), cell: (l) => <Badge tone="gold">{positionName(l.positionId)}</Badge> },
        {
          header: 'Vínculo',
          sortValue: (l) => scopeName(l.scope, l.scopeId),
          cell: (l) => (
            <span>
              <span className="text-muted">{l.scope === 'equipe' ? 'Equipe: ' : 'Departamento: '}</span>
              {scopeName(l.scope, l.scopeId)}
            </span>
          ),
        },
        { header: 'Desde', sortValue: (l) => l.since, cell: (l) => formatDate(l.since) },
      ]}
      card={(l) => ({
        leading: <Avatar name={nameOf(l.memberId)} />,
        title: nameOf(l.memberId),
        subtitle: `${positionName(l.positionId)} • ${scopeName(l.scope, l.scopeId)}`,
        badge: <Badge tone="gold">{l.scope === 'equipe' ? 'Equipe' : 'Departamento'}</Badge>,
        meta: `Desde ${formatDate(l.since)}`,
      })}
    />
  )
}
