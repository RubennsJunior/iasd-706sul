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
  permissoes: 'Permissões de Usuários',
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

/** Permissões que valem para o usuário: as personalizadas, se houver, senão as do perfil. */
export function effectivePermissions(
  user: { customPermissions?: PermissionMatrix } | null | undefined,
  role: { permissions: PermissionMatrix } | null | undefined,
): PermissionMatrix | undefined {
  return user?.customPermissions ?? role?.permissions
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
