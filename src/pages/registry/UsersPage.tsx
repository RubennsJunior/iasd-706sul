import { UserCog } from 'lucide-react'
import { CrudPage } from '../../components/crud/CrudPage'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { useAuth } from '../../contexts/AuthContext'
import { useRoles } from '../../hooks/useData'
import type { AppUser } from '../../models'
import { usersService } from '../../services'
import { formatDate } from '../../utils/date'
import { USER_STATUS_OPTIONS } from '../../utils/labels'
import { UserFormPage } from './UserFormPage'

const lastAccess = (user: AppUser) => (user.lastLoginAt ? formatDate(user.lastLoginAt.slice(0, 10)) : 'Nunca acessou')

export function UsersPage() {
  const { user: current } = useAuth()
  const { items: roles } = useRoles()
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? '—'

  return (
    <CrudPage<AppUser>
      module="usuarios"
      basePath="/usuarios"
      title="Cadastro de Usuários"
      subtitle="Adicione ou edite usuários do aplicativo"
      icon={UserCog}
      service={usersService}
      entityLabel="Usuário"
      formPage={({ item, backTo }) => <UserFormPage item={item} backTo={backTo} />}
      searchText={(u) => [u.name, u.email, u.phone, roleName(u.roleId)]}
      sortBy={(a, b) => a.name.localeCompare(b.name, 'pt-BR')}
      canDelete={(u) => u.id !== current?.id}
      filters={[
        {
          key: 'role',
          label: 'Perfil',
          options: roles.map((r) => ({ value: r.id, label: r.name })),
          predicate: (u, value) => u.roleId === value,
        },
        {
          key: 'status',
          label: 'Situação',
          options: USER_STATUS_OPTIONS,
          predicate: (u, value) => u.status === value,
        },
      ]}
      columns={[
        {
          header: 'Usuário',
          sortValue: (u) => u.name,
          cell: (u) => (
            <div className="flex items-center gap-3">
              <Avatar name={u.name} size="sm" />
              <div className="min-w-0">
                <p className="wrap-anywhere font-medium text-navy-900">{u.name}</p>
                <p className="wrap-anywhere text-xs text-muted">{u.email}</p>
              </div>
            </div>
          ),
        },
        {
          header: 'Perfil',
          sortValue: (u) => roleName(u.roleId),
          cell: (u) => (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <Badge tone="info">{roleName(u.roleId)}</Badge>
              {u.customPermissions && <Badge tone="gold">Personalizado</Badge>}
            </span>
          ),
        },
        { header: 'Telefone', cell: (u) => u.phone || '—' },
        { header: 'Último acesso', sortValue: (u) => u.lastLoginAt ?? '', cell: lastAccess },
        { header: 'Situação', sortValue: (u) => u.status, cell: (u) => <StatusBadge kind="user" value={u.status} /> },
      ]}
      card={(u) => ({
        leading: <Avatar name={u.name} />,
        title: u.name,
        subtitle: u.email,
        badge: <StatusBadge kind="user" value={u.status} />,
        meta: `${roleName(u.roleId)}${u.customPermissions ? ' (personalizado)' : ''} • Último acesso: ${lastAccess(u)}`,
      })}
    />
  )
}
