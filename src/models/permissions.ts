import { ACTIONS, MODULES } from './index'
import type { ActionKey, ModuleKey, PermissionMatrix, PermissionSet } from './index'

export const MODULE_LABELS: Record<ModuleKey, string> = {
  eventos: 'Eventos',
  equipes: 'Equipes e Ministérios',
  liturgia: 'Liturgia',
  membros: 'Membros',
  usuarios: 'Usuários',
  lideres: 'Líderes',
  cargos: 'Cargos e Funções',
  departamentos: 'Departamentos',
  patrimonio: 'Patrimônio',
  escalas: 'Escalas',
  cultos: 'Cultos e Programações',
  participantes: 'Participantes',
  perfis: 'Perfis de Acesso',
  permissoes: 'Permissões personalizadas do usuário',
  notificacoes: 'Notificações',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações',
}

export const ACTION_LABELS: Record<ActionKey, string> = {
  view: 'Visualizar',
  create: 'Cadastrar',
  edit: 'Editar',
  delete: 'Excluir',
  manage: 'Gerenciar',
}

export function permissionSet(...allowed: ActionKey[]): PermissionSet {
  const set = {} as PermissionSet
  for (const action of ACTIONS) set[action] = allowed.includes(action)
  return set
}

export function buildMatrix(
  rules: Partial<Record<ModuleKey, ActionKey[]>>,
): PermissionMatrix {
  const matrix = {} as PermissionMatrix
  for (const module of MODULES) matrix[module] = permissionSet(...(rules[module] ?? []))
  return matrix
}

export function fullMatrix(): PermissionMatrix {
  return buildMatrix(Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]])))
}

/** Perfil do Administrador Geral: sempre com acesso total, qualquer que seja a matriz gravada. */
export const ADMIN_ROLE = 'role-admin'

const normalized = new WeakMap<object, PermissionMatrix>()

/**
 * Completa uma matriz gravada antes de existir algum módulo (ou ação): o que falta fica sem permissão. Perfis e
 * usuários salvos na nuvem ou no aparelho em versões antigas não têm os módulos novos, e ler `matriz[módulo].view`
 * direto derrubava a tela (tela branca).
 */
export function normalizeMatrix(matrix: Partial<Record<ModuleKey, Partial<PermissionSet>>> | null | undefined): PermissionMatrix {
  const cached = matrix ? normalized.get(matrix) : undefined
  if (cached) return cached
  const full = {} as PermissionMatrix
  for (const module of MODULES) {
    const set = matrix?.[module]
    full[module] = permissionSet(...ACTIONS.filter((action) => Boolean(set?.[action])))
  }
  if (matrix) normalized.set(matrix, full)
  return full
}

/** Permissões que valem para o usuário: as do Administrador Geral (todas), as personalizadas, se houver, ou as do perfil. */
export function effectivePermissions(
  user: { roleId?: string; customPermissions?: PermissionMatrix } | null | undefined,
  role: { id?: string; permissions: PermissionMatrix } | null | undefined,
): PermissionMatrix | undefined {
  if (role?.id === ADMIN_ROLE || user?.roleId === ADMIN_ROLE) return fullMatrix()
  const source = user?.customPermissions ?? role?.permissions
  return source ? normalizeMatrix(source) : undefined
}

export function hasPermission(
  matrix: PermissionMatrix | undefined,
  module: ModuleKey,
  action: ActionKey = 'view',
): boolean {
  const set = matrix?.[module]
  if (!set) return false
  return set.manage || set[action]
}
