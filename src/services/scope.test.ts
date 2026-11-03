import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { repos, resetAllData } from '../repositories'
import { ALL_SCOPE, assertScope, resolveScope, scopeAllows, scopeAllowsNew, setScope } from './scope'
import type { Scope, Structure } from './scope'
import { departmentsService, leadersService, rostersService, teamsService } from './index'
import { nextWeekday } from '../utils/date'

const dep = (id: string, leaderId?: string) => ({ id, name: id, description: '', leaderId, status: 'ativa' as const })
const team = (id: string, departmentId: string, memberIds: string[] = [], leaderId?: string) => ({
  id, name: id, description: '', departmentId, leaderId, memberIds, foundedAt: '2020-01-01', status: 'ativa' as const, icon: 'users',
})
const lead = (memberId: string, positionId: string, scope: 'equipe' | 'departamento', scopeId: string) => ({ id: `${memberId}-${positionId}-${scopeId}`, memberId, positionId, scope, scopeId, since: '2020-01-01' })

/** Música (D1) tem as equipes T1 e T2; Mídia (D2) tem a T3. */
const estrutura: Structure = {
  departments: [dep('D1', 'ana'), dep('D2')],
  teams: [team('T1', 'D1', ['bia', 'cris'], 'bia'), team('T2', 'D1', ['dani']), team('T3', 'D2', ['cris'])],
  leaders: [lead('bia', 'pos-lider', 'equipe', 'T1'), lead('ana', 'pos-diretor', 'departamento', 'D1'), lead('eva', 'pos-vice', 'departamento', 'D2')],
}

describe('abrangência do perfil de acesso', () => {
  it('administrador e perfis "toda a igreja" (ou antigos, sem o campo) não têm restrição', () => {
    expect(resolveScope({ roleId: 'role-admin' }, { id: 'role-admin', reach: 'equipe' }, { id: 'ana' }, estrutura).all).toBe(true)
    expect(resolveScope({ roleId: 'x' }, { id: 'x', reach: 'todos' }, { id: 'bia' }, estrutura).all).toBe(true)
    expect(resolveScope({ roleId: 'x' }, { id: 'x' }, { id: 'bia' }, estrutura).all).toBe(true)
    expect(resolveScope(null, null, null, estrutura).all).toBe(true)
  })

  it('por equipe: líder e integrante enxergam só as suas equipes', () => {
    const bia = resolveScope({ roleId: 'x' }, { id: 'x', reach: 'equipe' }, { id: 'bia' }, estrutura)
    expect([...bia.teamIds].sort()).toEqual(['T1'])
    expect([...bia.departmentIds]).toEqual(['D1']) // o departamento da equipe, só para consulta
    const cris = resolveScope({ roleId: 'x' }, { id: 'x', reach: 'equipe' }, { id: 'cris' }, estrutura)
    expect([...cris.teamIds].sort()).toEqual(['T1', 'T3'])
  })

  it('por departamento: o departamento que lidera e todas as equipes dele', () => {
    const ana = resolveScope({ roleId: 'x' }, { id: 'x', reach: 'departamento' }, { id: 'ana' }, estrutura)
    expect([...ana.departmentIds]).toEqual(['D1'])
    expect([...ana.teamIds].sort()).toEqual(['T1', 'T2'])
    // integrante de uma equipe também pertence ao departamento dela
    const dani = resolveScope({ roleId: 'x' }, { id: 'x', reach: 'departamento' }, { id: 'dani' }, estrutura)
    expect([...dani.teamIds].sort()).toEqual(['T1', 'T2'])
  })

  it('cargos e funções escolhidos no perfil: só contam as lideranças com esses cargos', () => {
    const soDiretor = { id: 'x', reach: 'departamento' as const, reachPositionIds: ['pos-diretor'] }
    expect([...resolveScope({ roleId: 'x' }, soDiretor, { id: 'ana' }, estrutura).departmentIds]).toEqual(['D1'])
    // eva é vice de D2: o cargo não está na lista
    expect(resolveScope({ roleId: 'x' }, soDiretor, { id: 'eva' }, estrutura).teamIds.size).toBe(0)
    // integrante comum de equipe também não conta quando há cargo escolhido
    expect(resolveScope({ roleId: 'x' }, soDiretor, { id: 'dani' }, estrutura).teamIds.size).toBe(0)
    const lideres = { id: 'x', reach: 'equipe' as const, reachPositionIds: ['pos-lider'] }
    expect([...resolveScope({ roleId: 'x' }, lideres, { id: 'bia' }, estrutura).teamIds]).toEqual(['T1'])
    expect(resolveScope({ roleId: 'x' }, lideres, { id: 'cris' }, estrutura).teamIds.size).toBe(0)
  })

  it('sem cadastro de membro vinculado, um perfil com abrangência não enxerga nada', () => {
    const scope = resolveScope({ roleId: 'x' }, { id: 'x', reach: 'equipe' }, null, estrutura)
    expect(scope.all).toBe(false)
    expect(scope.teamIds.size).toBe(0)
  })

  it('o que cada item exige', () => {
    const dep: Scope = resolveScope({ roleId: 'x' }, { id: 'x', reach: 'departamento' }, { id: 'ana' }, estrutura)
    expect(scopeAllows(dep, 'team', { id: 'T2' })).toBe(true)
    expect(scopeAllows(dep, 'team', { id: 'T3' })).toBe(false)
    expect(scopeAllows(dep, 'roster', { teamId: 'T1' })).toBe(true)
    expect(scopeAllows(dep, 'roster', { teamId: 'T3' })).toBe(false)
    expect(scopeAllows(dep, 'department', { id: 'D1' })).toBe(true)
    expect(scopeAllows(dep, 'department', { id: 'D2' })).toBe(false)
    expect(scopeAllows(dep, 'leader', { scope: 'departamento', scopeId: 'D1' })).toBe(true)
    expect(scopeAllows(dep, 'leader', { scope: 'equipe', scopeId: 'T3' })).toBe(false)
    // novo: equipe só dentro do departamento; departamento novo, não
    expect(scopeAllowsNew(dep, 'team', { departmentId: 'D1' })).toBe(true)
    expect(scopeAllowsNew(dep, 'team', { departmentId: 'D2' })).toBe(false)
    expect(scopeAllowsNew(dep, 'department', {})).toBe(false)
    const eq = resolveScope({ roleId: 'x' }, { id: 'x', reach: 'equipe' }, { id: 'bia' }, estrutura)
    expect(scopeAllowsNew(eq, 'team', { departmentId: 'D1' })).toBe(false)
    expect(scopeAllows(eq, 'leader', { scope: 'departamento', scopeId: 'D1' })).toBe(false)
    expect(scopeAllows(ALL_SCOPE, 'team', { id: 'qualquer' })).toBe(true)
  })
})

describe('travas dos serviços (perfil com abrangência)', () => {
  beforeEach(async () => {
    await resetAllData()
    for (const d of estrutura.departments) await repos.departments.create(d)
    for (const t of estrutura.teams) await repos.teams.create(t)
  })
  afterEach(() => setScope(ALL_SCOPE))

  const comoEquipe = (...teamIds: string[]): Scope => ({ reach: 'equipe', all: false, teamIds: new Set(teamIds), departmentIds: new Set(['D1']) })
  const comoDepartamento: Scope = { reach: 'departamento', all: false, teamIds: new Set(['T1', 'T2']), departmentIds: new Set(['D1']) }

  it('equipes: altera a própria, recusa a dos outros e não cria equipe nova', async () => {
    setScope(comoEquipe('T1'))
    await expect(teamsService.update('T1', { description: 'ok' })).resolves.toBeTruthy()
    await expect(teamsService.update('T3', { description: 'x' })).rejects.toThrow(/só pode alterar equipes da\(s\) sua\(s\) equipe\(s\)/)
    await expect(teamsService.remove('T2')).rejects.toThrow(/equipes/)
    await expect(teamsService.create(team('T9', 'D1') as never)).rejects.toThrow(/dentro do seu departamento/)
    expect((await repos.teams.get('T3'))?.description).toBe('')
  })

  it('departamento: cria equipe só no próprio departamento e altera só as dele', async () => {
    setScope(comoDepartamento)
    const { id: _id, ...nova } = team('T9', 'D1')
    await expect(teamsService.create(nova)).resolves.toMatchObject({ departmentId: 'D1' })
    const { id: _id2, ...fora } = team('T8', 'D2')
    await expect(teamsService.create(fora)).rejects.toThrow(/dentro do seu departamento/)
    await expect(teamsService.update('T2', { description: 'ok' })).resolves.toBeTruthy()
    await expect(teamsService.update('T3', { description: 'x' })).rejects.toThrow(/departamento/)
  })

  it('departamentos: quem só vê equipes consulta mas não altera; quem tem o departamento altera', async () => {
    setScope(comoEquipe('T1'))
    await expect(departmentsService.update('D1', { description: 'x' })).rejects.toThrow(/só pode consultar departamentos/)
    setScope(comoDepartamento)
    await expect(departmentsService.update('D1', { description: 'ok' })).resolves.toBeTruthy()
    await expect(departmentsService.update('D2', { description: 'x' })).rejects.toThrow(/departamentos/)
    await expect(departmentsService.create({ name: 'Novo', description: '', status: 'ativa' })).rejects.toThrow(/não pode criar departamentos/)
  })

  it('lideranças e escalas só nas equipes liberadas', async () => {
    setScope(comoEquipe('T1'))
    const base = { positionId: 'pos-lider', since: '2024-01-01' }
    await expect(leadersService.create({ ...base, memberId: 'mem-05', scope: 'equipe', scopeId: 'T1' })).resolves.toBeTruthy()
    await expect(leadersService.create({ ...base, memberId: 'mem-05', scope: 'equipe', scopeId: 'T3' })).rejects.toThrow(/lideranças/)
    await expect(leadersService.create({ ...base, memberId: 'mem-06', scope: 'departamento', scopeId: 'D1' })).rejects.toThrow(/lideranças/)

    const escala = (teamId: string, dia: number) => ({
      title: 'Escala', date: nextWeekday(dia), time: '20:00', location: '', teamId, notes: '', assignments: [{ memberId: 'mem-0' + (dia + 1), role: 'Apoio', status: 'pendente' as const }],
    })
    await expect(rostersService.create(escala('T1', 2))).resolves.toBeTruthy()
    await expect(rostersService.create(escala('T3', 3))).rejects.toThrow(/escalas/)
  })

  it('sem restrição (administrador / toda a igreja) nada muda', async () => {
    setScope(ALL_SCOPE)
    await expect(teamsService.update('T3', { description: 'ok' })).resolves.toBeTruthy()
    expect(() => assertScope('department', { id: 'D2' })).not.toThrow()
  })
})
