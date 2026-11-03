import { ShieldCheck } from 'lucide-react'
import { CrudPage } from '../../components/crud/CrudPage'
import type { FieldDef } from '../../components/forms/types'
import { PermissionMatrixEditor } from '../../components/admin/PermissionMatrixEditor'
import { Badge } from '../../components/ui/Badge'
import { useUsers } from '../../hooks/useData'
import { MODULES } from '../../models'
import type { PermissionMatrix, Role } from '../../models'
import { buildMatrix, normalizeMatrix } from '../../models/permissions'
import { rolesService } from '../../services'
import { pluralize } from '../../utils/misc'

const modulesWithAccess = (role: Role) => {
  const matrix = normalizeMatrix(role.permissions)
  return MODULES.filter((m) => matrix[m].view || matrix[m].manage).length
}

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Nome do perfil', type: 'text', required: true, span: 2 },
  { name: 'description', label: 'Descrição', type: 'textarea', rows: 2 },
  {
    name: 'permissions',
    label: 'Permissões do perfil',
    type: 'custom',
    span: 2,
    render: ({ value, onChange, values }) => (
      <PermissionMatrixEditor
        value={value as PermissionMatrix}
        onChange={onChange}
        readOnly={Boolean(values.system)}
      />
    ),
  },
]

export function RolesPage() {
  const { items: users } = useUsers()
  const userCount = (id: string) => users.filter((u) => u.roleId === id).length

  return (
    <CrudPage<Role>
      module="perfis"
      basePath="/perfis"
      title="Perfis de Acesso"
      subtitle="Gerencie os perfis de acesso"
      icon={ShieldCheck}
      service={rolesService}
      entityLabel="Perfil"
      newLabel="Novo Perfil"
      fields={FIELDS}
      defaultValues={{ name: '', description: '', permissions: buildMatrix({ eventos: ['view'], equipes: ['view'], liturgia: ['view'] }) }}
      searchText={(r) => [r.name, r.description]}
      fromForm={(values, editing) => ({
        name: String(values.name).trim(),
        description: String(values.description ?? '').trim(),
        permissions: editing?.system ? normalizeMatrix(editing.permissions) : normalizeMatrix(values.permissions as PermissionMatrix),
        system: editing?.system,
      })}
      canDelete={(r) => !r.system}
      deleteWarning={(r) => (userCount(r.id) > 0 ? `${pluralize(userCount(r.id), 'usuário')} usa este perfil.` : undefined)}
      columns={[
        {
          header: 'Perfil',
          sortValue: (r) => r.name,
          cell: (r) => (
            <div>
              <p className="font-medium text-navy-900">
                {r.name} {r.system && <Badge tone="gold">Sistema</Badge>}
              </p>
              <p className="text-xs text-muted">{r.description}</p>
            </div>
          ),
        },
        { header: 'Usuários', sortValue: (r) => userCount(r.id), cell: (r) => userCount(r.id) },
        {
          header: 'Módulos com acesso',
          sortValue: modulesWithAccess,
          cell: (r) => `${modulesWithAccess(r)} de ${MODULES.length}`,
        },
      ]}
      card={(r) => ({
        title: r.name,
        subtitle: r.description,
        badge: r.system ? <Badge tone="gold">Sistema</Badge> : undefined,
        meta: `${pluralize(userCount(r.id), 'usuário')} • ${modulesWithAccess(r)} de ${MODULES.length} módulos`,
      })}
    />
  )
}
