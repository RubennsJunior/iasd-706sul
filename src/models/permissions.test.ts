import { describe, expect, it } from 'vitest'
import { MODULES } from './index'
import type { PermissionMatrix } from './index'
import { ADMIN_ROLE, buildMatrix, effectivePermissions, fullMatrix, hasPermission, normalizeMatrix } from './permissions'

/** Matriz como ficou gravada antes de existir o módulo "Patrimônio". */
const antiga = (): PermissionMatrix => {
  const matrix = buildMatrix({ eventos: ['view', 'create'], equipes: ['view'] })
  delete (matrix as Partial<PermissionMatrix>).patrimonio
  return matrix
}

describe('matriz de permissões gravada em versões antigas', () => {
  it('completa os módulos que faltam sem permissão e mantém o que já estava marcado', () => {
    const matrix = normalizeMatrix(antiga())
    expect(Object.keys(matrix).sort()).toEqual([...MODULES].sort())
    expect(matrix.patrimonio).toEqual({ view: false, create: false, edit: false, delete: false, manage: false })
    expect(matrix.eventos).toMatchObject({ view: true, create: true, edit: false })
  })

  it('completa também ações que faltam e aceita vazio', () => {
    expect(normalizeMatrix({ eventos: { view: true } }).eventos).toEqual({ view: true, create: false, edit: false, delete: false, manage: false })
    expect(Object.keys(normalizeMatrix(undefined))).toHaveLength(MODULES.length)
    expect(Object.keys(normalizeMatrix(null))).toHaveLength(MODULES.length)
  })

  it('perfil antigo nunca derruba a leitura das permissões (era a tela branca)', () => {
    const role = { id: 'role-antigo', permissions: antiga() }
    const matrix = effectivePermissions({ roleId: role.id }, role)!
    expect(MODULES.every((m) => matrix[m].view !== undefined)).toBe(true)
    expect(hasPermission(matrix, 'patrimonio')).toBe(false)
    expect(hasPermission(matrix, 'eventos', 'create')).toBe(true)
  })

  it('permissões personalizadas antigas também são completadas', () => {
    const matrix = effectivePermissions({ roleId: 'role-membro', customPermissions: antiga() }, { id: 'role-membro', permissions: fullMatrix() })!
    expect(matrix.patrimonio.view).toBe(false)
    expect(matrix.eventos.create).toBe(true)
  })

  it('o Administrador Geral tem acesso total mesmo com a matriz gravada incompleta', () => {
    const role = { id: ADMIN_ROLE, permissions: antiga() }
    expect(hasPermission(effectivePermissions({ roleId: ADMIN_ROLE }, role), 'patrimonio', 'delete')).toBe(true)
    // e sem o perfil carregado (nuvem ainda carregando)
    expect(hasPermission(effectivePermissions({ roleId: ADMIN_ROLE }, null), 'patrimonio', 'create')).toBe(true)
  })

  it('sem perfil nem usuário não há permissão nenhuma', () => {
    expect(effectivePermissions(null, null)).toBeUndefined()
    expect(hasPermission(undefined, 'patrimonio')).toBe(false)
  })
})
