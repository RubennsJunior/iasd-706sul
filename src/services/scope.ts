import type { AppUser, Department, ID, LeaderAssignment, Member, ModuleKey, Role, RoleReach, Roster, Team } from '../models'
import { ADMIN_ROLE } from '../models/permissions'

/**
 * Abrangência do perfil de acesso: além de "o que" o perfil pode fazer (a matriz de permissões), define "em quais dados".
 * A estrutura da igreja decide de onde vem o escopo de cada pessoa: líderes (cargo ou função em uma equipe ou departamento),
 * equipes (integrantes) e departamentos (líder).
 */
export const REACH_OPTIONS: { value: RoleReach; label: string; hint: string }[] = [
  { value: 'todos', label: 'Toda a igreja', hint: 'As permissões valem para todos os dados (comportamento padrão).' },
  { value: 'departamento', label: 'Só o(s) departamento(s) do usuário', hint: 'Vale para o departamento que a pessoa lidera e para as equipes dele.' },
  { value: 'equipe', label: 'Só a(s) equipe(s) do usuário', hint: 'Vale para as equipes em que a pessoa é líder ou integrante.' },
]

export const reachLabel = (reach?: RoleReach) => REACH_OPTIONS.find((o) => o.value === (reach ?? 'todos'))?.label ?? 'Toda a igreja'

/** Módulos que têm ligação com equipe ou departamento e, por isso, respeitam a abrangência do perfil. */
export const SCOPED_MODULES: readonly ModuleKey[] = ['equipes', 'escalas', 'lideres', 'departamentos']

export type ScopeKind = 'team' | 'roster' | 'department' | 'leader'
export const KIND_OF_MODULE: Partial<Record<ModuleKey, ScopeKind>> = {
  equipes: 'team',
  escalas: 'roster',
  departamentos: 'department',
  lideres: 'leader',
}

export interface Scope {
  reach: RoleReach
  /** Sem restrição: vê e altera tudo o que a matriz de permissões permitir. */
  all: boolean
  /** Equipes liberadas. */
  teamIds: ReadonlySet<ID>
  /** Departamentos liberados. */
  departmentIds: ReadonlySet<ID>
}

export const ALL_SCOPE: Scope = { reach: 'todos', all: true, teamIds: new Set(), departmentIds: new Set() }

export interface Structure {
  teams: Team[]
  departments: Department[]
  leaders: LeaderAssignment[]
}

/**
 * Escopo de uma pessoa. O Administrador Geral e perfis de abrangência "toda a igreja" não têm restrição. Nos demais,
 * só entram as equipes e departamentos em que o membro do usuário tem ligação; se o perfil escolheu cargos e funções,
 * só contam as lideranças com esses cargos (sem escolher nenhum, vale qualquer ligação: liderança ou integrante).
 */
export function resolveScope(
  user: Pick<AppUser, 'roleId'> | null | undefined,
  role: Pick<Role, 'id' | 'reach' | 'reachPositionIds'> | null | undefined,
  member: Pick<Member, 'id'> | null | undefined,
  structure: Structure,
): Scope {
  if (user?.roleId === ADMIN_ROLE || role?.id === ADMIN_ROLE) return ALL_SCOPE
  const reach = role?.reach ?? 'todos'
  if (reach === 'todos') return ALL_SCOPE
  if (!member) return { reach, all: false, teamIds: new Set(), departmentIds: new Set() }

  const positions = role?.reachPositionIds ?? []
  const anyPosition = positions.length === 0
  const ownTeams = new Set<ID>()
  const ownDepartments = new Set<ID>()
  for (const leader of structure.leaders) {
    if (leader.memberId !== member.id || !(anyPosition || positions.includes(leader.positionId))) continue
    ;(leader.scope === 'equipe' ? ownTeams : ownDepartments).add(leader.scopeId)
  }
  if (anyPosition) {
    for (const team of structure.teams) if (team.leaderId === member.id || team.memberIds.includes(member.id)) ownTeams.add(team.id)
    for (const department of structure.departments) if (department.leaderId === member.id) ownDepartments.add(department.id)
    // quem está numa equipe também pertence ao departamento dela
    for (const team of structure.teams) if (ownTeams.has(team.id) && team.departmentId) ownDepartments.add(team.departmentId)
  }

  if (reach === 'equipe') {
    const departmentIds = new Set<ID>()
    for (const team of structure.teams) if (ownTeams.has(team.id) && team.departmentId) departmentIds.add(team.departmentId)
    return { reach, all: false, teamIds: ownTeams, departmentIds }
  }
  const teamIds = new Set(ownTeams)
  for (const team of structure.teams) if (team.departmentId && ownDepartments.has(team.departmentId)) teamIds.add(team.id)
  return { reach, all: false, teamIds, departmentIds: ownDepartments }
}

type Item = Partial<Team> & Partial<Roster> & Partial<Department> & Partial<LeaderAssignment>

/** O item está dentro do escopo? (equipe, escala, departamento ou liderança já existentes) */
export function scopeAllows(scope: Scope, kind: ScopeKind, item: Item): boolean {
  if (scope.all) return true
  switch (kind) {
    case 'team':
      return Boolean(item.id && scope.teamIds.has(item.id))
    case 'roster':
      return Boolean(item.teamId && scope.teamIds.has(item.teamId))
    case 'department':
      return Boolean(item.id && scope.departmentIds.has(item.id))
    case 'leader':
      return item.scope === 'equipe'
        ? Boolean(item.scopeId && scope.teamIds.has(item.scopeId))
        : scope.reach === 'departamento' && Boolean(item.scopeId && scope.departmentIds.has(item.scopeId))
  }
}

/** Pode criar algo novo assim? Equipe só no próprio departamento; departamento novo só quem vê a igreja toda. */
export function scopeAllowsNew(scope: Scope, kind: ScopeKind, data: Item): boolean {
  if (scope.all) return true
  if (kind === 'team') return scope.reach === 'departamento' && Boolean(data.departmentId && scope.departmentIds.has(data.departmentId))
  if (kind === 'department') return false
  return scopeAllows(scope, kind, data)
}

const BLOCKED: Record<ScopeKind, string> = {
  team: 'equipes',
  roster: 'escalas',
  department: 'departamentos',
  leader: 'lideranças',
}

/** Para as telas: "este item entra na minha abrangência?" (módulos sem ligação com equipe ou departamento: sempre sim). */
export const scopeChecker = (scope: Scope) => (module: ModuleKey, item: Item): boolean => {
  const kind = KIND_OF_MODULE[module]
  return !kind || scopeAllows(scope, kind, item)
}

/** Escopo da pessoa logada, para as travas dos serviços (como `setActor`, o app informa quando o login muda). */
let current: Scope = ALL_SCOPE
export const setScope = (scope: Scope) => {
  current = scope
}
export const getScope = () => current

/** Lança um erro amigável se o seu perfil não alcança este item. */
export function assertScope(kind: ScopeKind, item: Item, options: { isNew?: boolean } = {}) {
  const scope = current
  const ok = options.isNew ? scopeAllowsNew(scope, kind, item) : scopeAllows(scope, kind, item)
  if (ok) return
  const where = scope.reach === 'departamento' ? 'do(s) seu(s) departamento(s)' : 'da(s) sua(s) equipe(s)'
  throw new Error(
    options.isNew && kind === 'department'
      ? 'Seu perfil não pode criar departamentos.'
      : options.isNew && kind === 'team'
        ? 'Seu perfil só pode criar equipes dentro do seu departamento.'
        : `Seu perfil só pode alterar ${BLOCKED[kind]} ${where}.`,
  )
}
