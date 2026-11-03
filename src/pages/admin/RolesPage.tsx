import { useMemo } from 'react'
import { ShieldCheck } from 'lucide-react'
import { CrudPage } from '../../components/crud/CrudPage'
import type { FieldDef } from '../../components/forms/types'
import { PermissionMatrixEditor } from '../../components/admin/PermissionMatrixEditor'
import { Badge } from '../../components/ui/Badge'
import { usePositions, useUsers } from '../../hooks/useData'
import { MODULES } from '../../models'
import type { PermissionMatrix, Role, RoleReach } from '../../models'
import { ADMIN_ROLE, buildMatrix, normalizeMatrix } from '../../models/permissions'
import { REACH_OPTIONS, reachLabel, rolesService } from '../../services'
import { pluralize } from '../../utils/misc'

const modulesWithAccess = (role: Role) => {
  const matrix = normalizeMatrix(role.permissions)
  return MODULES.filter((m) => matrix[m].view || matrix[m].manage).length
}

const reachHint = (reach: RoleReach) => REACH_OPTIONS.find((o) => o.value === reach)?.hint

const buildFields = (positionOptions: { value: string; label: string }[]): FieldDef[] => [
  { name: 'name', label: 'Nome do perfil', type: 'text', required: true, span: 2, section: 'Perfil' },
  { name: 'description', label: 'Descrição', type: 'textarea', rows: 2, section: 'Perfil' },
  {
    name: 'reach',
    label: 'Abrangência (em quais dados vale)',
    type: 'select',
    section: 'Abrangência',
    span: 2,
    required: true,
    options: REACH_OPTIONS.map(({ value, label }) => ({ value, label })),
    hint: 'Departamentos, equipes, cargos e funções definem o que cada pessoa enxerga: a abrangência escolhida aqui usa esse cadastro para limitar equipes, escalas, líderes e departamentos.',
    showIf: (values) => values.id !== ADMIN_ROLE && !values.system,
  },
  {
    name: 'reachPositionIds',
    label: 'Cargos e funções que contam',
    type: 'multiselect',
    section: 'Abrangência',
    span: 2,
    options: positionOptions,
    hint: 'Opcional. Vazio: vale qualquer ligação (liderar ou integrar). Escolhendo cargos ou funções, só conta quem exerce um deles na equipe ou no departamento.',
    showIf: (values) => !values.system && (values.reach ?? 'todos') !== 'todos',
  },
  {
    name: 'reachInfo',
    label: 'Como funciona',
    type: 'custom',
    section: 'Abrangência',
    span: 2,
    showIf: (values) => !values.system && (values.reach ?? 'todos') !== 'todos',
    render: ({ values }) => (
      <p className="rounded-xl bg-royal-50 px-3 py-2.5 text-sm text-ink">
        {reachHint((values.reach ?? 'todos') as RoleReach)} A pessoa precisa estar vinculada a um membro cadastrado. As permissões abaixo
        continuam valendo, mas só dentro dessa abrangência.
      </p>
    ),
  },
  {
    name: 'permissions',
    label: 'Permissões do perfil',
    type: 'custom',
    section: 'Permissões',
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
  const { items: positions } = usePositions()
  const userCount = (id: string) => users.filter((u) => u.roleId === id).length
  const fields = useMemo(
    () => buildFields(positions.map((p) => ({ value: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))),
    [positions],
  )
  const positionNames = (role: Role) =>
    (role.reachPositionIds ?? [])
      .map((id) => positions.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(', ')
  const reachText = (role: Role) => {
    const base = reachLabel(role.reach)
    const names = (role.reach ?? 'todos') === 'todos' ? '' : positionNames(role)
    return names ? `${base} • ${names}` : base
  }

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
      fields={fields}
      toForm={(r) => ({ ...r, reach: r.reach ?? 'todos', reachPositionIds: r.reachPositionIds ?? [] })}
      defaultValues={{ name: '', description: '', reach: 'todos', reachPositionIds: [], permissions: buildMatrix({ eventos: ['view'], equipes: ['view'], liturgia: ['view'] }) }}
      searchText={(r) => [r.name, r.description]}
      fromForm={(values, editing) => {
        const reach: RoleReach = editing?.system ? 'todos' : ((values.reach as RoleReach) ?? 'todos')
        return {
          name: String(values.name).trim(),
          description: String(values.description ?? '').trim(),
          permissions: editing?.system ? normalizeMatrix(editing.permissions) : normalizeMatrix(values.permissions as PermissionMatrix),
          system: editing?.system,
          reach,
          // cargos e funções só fazem sentido quando o perfil é limitado a departamento ou equipe
          reachPositionIds: reach === 'todos' ? [] : ((values.reachPositionIds as string[]) ?? []),
        }
      }}
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
        {
          header: 'Abrangência',
          sortValue: (r) => reachLabel(r.reach),
          cell: (r) => (
            <div>
              <Badge tone={(r.reach ?? 'todos') === 'todos' ? 'neutral' : 'info'}>{reachLabel(r.reach)}</Badge>
              {(r.reach ?? 'todos') !== 'todos' && positionNames(r) && <p className="mt-0.5 text-xs text-muted">{positionNames(r)}</p>}
            </div>
          ),
        },
      ]}
      card={(r) => ({
        title: r.name,
        subtitle: r.description,
        badge: r.system ? <Badge tone="gold">Sistema</Badge> : undefined,
        meta: `${pluralize(userCount(r.id), 'usuário')} • ${modulesWithAccess(r)} de ${MODULES.length} módulos • ${reachText(r)}`,
      })}
    />
  )
}
