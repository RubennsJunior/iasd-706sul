import { useMemo } from 'react'
import { Church } from 'lucide-react'
import { CrudPage } from '../../components/crud/CrudPage'
import type { FieldDef } from '../../components/forms/types'
import { StatusBadge } from '../../components/ui/Badge'
import { useMemberNames, useTeams } from '../../hooks/useData'
import type { Department } from '../../models'
import { departmentsService } from '../../services'
import { ACTIVE_STATUS_OPTIONS } from '../../utils/labels'
import { pluralize } from '../../utils/misc'

export function DepartmentsPage() {
  const { members, nameOf } = useMemberNames()
  const { items: teams } = useTeams()
  const teamsOf = (id: string) => teams.filter((t) => t.departmentId === id)

  const fields = useMemo<FieldDef[]>(
    () => [
      { name: 'name', label: 'Nome do departamento', type: 'text', required: true, span: 2 },
      { name: 'description', label: 'Descrição', type: 'textarea', rows: 3 },
      {
        name: 'leaderId',
        label: 'Responsável',
        type: 'select',
        emptyOption: 'Sem responsável',
        options: members.filter((m) => m.status !== 'inativo').map((m) => ({ value: m.id, label: m.fullName })),
      },
      { name: 'status', label: 'Situação', type: 'select', required: true, options: ACTIVE_STATUS_OPTIONS },
    ],
    [members],
  )

  return (
    <CrudPage<Department>
      module="departamentos"
      basePath="/departamentos"
      title="Departamentos"
      subtitle="Gerencie os departamentos"
      icon={Church}
      service={departmentsService}
      entityLabel="Departamento"
      fields={fields}
      defaultValues={{ name: '', description: '', leaderId: '', status: 'ativa' }}
      searchText={(d) => [d.name, d.description, nameOf(d.leaderId)]}
      sortBy={(a, b) => a.name.localeCompare(b.name, 'pt-BR')}
      toForm={(d) => ({ ...d, leaderId: d.leaderId ?? '' })}
      fromForm={(values) => ({
        name: String(values.name).trim(),
        description: String(values.description ?? '').trim(),
        leaderId: values.leaderId || undefined,
        status: values.status,
      })}
      filters={[
        { key: 'status', label: 'Situação', options: ACTIVE_STATUS_OPTIONS, predicate: (d, value) => d.status === value },
      ]}
      columns={[
        { header: 'Departamento', sortValue: (d) => d.name, cell: (d) => <span className="font-medium text-navy-900">{d.name}</span> },
        { header: 'Responsável', sortValue: (d) => nameOf(d.leaderId), cell: (d) => nameOf(d.leaderId) },
        { header: 'Equipes', sortValue: (d) => teamsOf(d.id).length, cell: (d) => pluralize(teamsOf(d.id).length, 'equipe') },
        { header: 'Situação', sortValue: (d) => d.status, cell: (d) => <StatusBadge kind="active" value={d.status} /> },
      ]}
      card={(d) => ({
        title: d.name,
        subtitle: d.description || 'Sem descrição',
        badge: <StatusBadge kind="active" value={d.status} />,
        meta: `Responsável: ${nameOf(d.leaderId)} • ${pluralize(teamsOf(d.id).length, 'equipe')}`,
      })}
    />
  )
}
