import { useState } from 'react'
import { Lock, SearchX, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, FilterMenu, SearchBar } from '../../components/ui/Misc'
import { Select } from '../../components/forms/Select'
import { useAuth } from '../../contexts/AuthContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { useMemberNames, useRoles, useUsers } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import type { AppUser } from '../../models'
import { MODULES } from '../../models'
import { usersService } from '../../services'
import { effectivePermissions } from '../../models/permissions'
import { matchesQuery } from '../../utils/misc'

export function PermissionsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const { items: users } = useUsers()
  const { items: roles } = useRoles()
  const { nameOf } = useMemberNames()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const canEdit = can('permissoes', 'edit')
  const role = (id: string) => roles.find((r) => r.id === id)

  const visible = users
    .filter(
      (u) =>
        (!filters.role || u.roleId === filters.role) &&
        matchesQuery(query, u.name, u.email, role(u.roleId)?.name, nameOf(u.memberId)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const changeRole = async (user: AppUser, roleId: string) => {
    try {
      await usersService.update(user.id, { roleId })
      toast.success(`${user.name} agora tem o perfil “${role(roleId)?.name}”.`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const roleSelect = (user: AppUser) =>
    canEdit ? (
      <Select
        aria-label={`Perfil de ${user.name}`}
        value={user.roleId}
        onChange={(roleId) => void changeRole(user, roleId)}
        options={roles.map((r) => ({ value: r.id, label: r.name }))}
      />
    ) : (
      <span className="text-sm font-medium text-ink">{role(user.roleId)?.name}</span>
    )

  return (
    <Page title="Permissões de Usuários" subtitle="Defina as permissões dos usuários" icon={Lock}>
      <div className="space-y-4">
        <Card className="flex flex-wrap items-center gap-3 bg-royal-50 p-4 shadow-none">
          <ShieldCheck className="size-6 shrink-0 text-royal-600" />
          <p className="min-w-0 flex-1 text-sm text-ink">
            Cada usuário recebe as permissões do perfil escolhido. Para alterar o que um perfil pode fazer, edite o perfil.
          </p>
          {can('perfis') && (
            <Link to="/perfis">
              <Button size="sm" variant="outline">
                Editar perfis
              </Button>
            </Link>
          )}
        </Card>

        <SearchBar value={query} onChange={setQuery} placeholder="Buscar usuário…">
          <FilterMenu
            filters={[{ key: 'role', label: 'Perfil', options: roles.map((r) => ({ value: r.id, label: r.name })) }]}
            values={filters}
            onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
          />
        </SearchBar>

        {visible.length === 0 ? (
          <EmptyState icon={SearchX} title="Nenhum usuário encontrado" />
        ) : (
          <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {visible.map((user) => {
              const matrix = effectivePermissions(user, role(user.roleId))
              const modules = matrix ? MODULES.filter((m) => matrix[m].view || matrix[m].manage).length : 0
              return (
                <li key={user.id}>
                  <Card className="space-y-3 p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-navy-900">{user.name}</p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                      </div>
                      <StatusBadge kind="user" value={user.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">{roleSelect(user)}</div>
                      <Link to={`/usuarios/${encodeURIComponent(user.id)}/editar?aba=permissao`}>
                        <Button size="sm" variant="outline" icon={SlidersHorizontal}>
                          Permissões
                        </Button>
                      </Link>
                    </div>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      Acesso a {modules} de {MODULES.length} módulos
                      {user.customPermissions && <Badge tone="gold">Personalizado</Badge>}
                    </p>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Page>
  )
}
