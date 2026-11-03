import { BadgeCheck } from 'lucide-react'
import { CrudPage } from '../../components/crud/CrudPage'
import type { FieldDef } from '../../components/forms/types'
import { useAuth } from '../../contexts/AuthContext'
import { useLeaders, useRoles } from '../../hooks/useData'
import type { Position } from '../../models'
import { positionsService } from '../../services'
import { pluralize } from '../../utils/misc'

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Nome do cargo ou função', type: 'text', required: true, span: 2 },
  { name: 'description', label: 'Descrição', type: 'textarea', rows: 3 },
]

export function PositionsPage() {
  const { items: leaders } = useLeaders()
  const { items: roles } = useRoles()
  const { can } = useAuth()
  const uses = (id: string) => leaders.filter((l) => l.positionId === id).length
  // perfis de acesso cuja abrangência considera este cargo ou função (só quem pode ver os perfis enxerga a lista)
  const canSeeRoles = can('perfis', 'view')
  const rolesOf = (id: string) => roles.filter((r) => (r.reach ?? 'todos') !== 'todos' && r.reachPositionIds?.includes(id))

  return (
    <CrudPage<Position>
      module="cargos"
      basePath="/cargos"
      title="Cargos e Funções"
      subtitle="Defina os cargos e funções"
      icon={BadgeCheck}
      service={positionsService}
      entityLabel="Cargo"
      fields={FIELDS}
      defaultValues={{ name: '', description: '' }}
      searchText={(p) => [p.name, p.description]}
      sortBy={(a, b) => a.name.localeCompare(b.name, 'pt-BR')}
      fromForm={(values) => ({ name: String(values.name).trim(), description: String(values.description ?? '').trim() })}
      columns={[
        { header: 'Cargo', sortValue: (p) => p.name, cell: (p) => <span className="font-medium text-navy-900">{p.name}</span> },
        { header: 'Descrição', cell: (p) => p.description || '—' },
        { header: 'Em uso', sortValue: (p) => uses(p.id), cell: (p) => pluralize(uses(p.id), 'liderança') },
        ...(canSeeRoles
          ? [
              {
                header: 'Define acesso em',
                sortValue: (p: Position) => rolesOf(p.id).length,
                cell: (p: Position) => (rolesOf(p.id).length ? rolesOf(p.id).map((r) => r.name).join(', ') : '—'),
              },
            ]
          : []),
      ]}
      card={(p) => ({
        title: p.name,
        subtitle: p.description || 'Sem descrição',
        meta: `Em uso: ${pluralize(uses(p.id), 'liderança')}${canSeeRoles && rolesOf(p.id).length ? ` • Define acesso em: ${rolesOf(p.id).map((r) => r.name).join(', ')}` : ''}`,
      })}
    />
  )
}
