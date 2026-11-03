import { beforeEach, describe, expect, it } from 'vitest'
import { repos, resetAllData, exportAllData, importAllData } from '../repositories'
import { buildMatrix, effectivePermissions, hasPermission } from '../models/permissions'
import {
  departmentsService,
  ensureMemberForUser,
  eventPhase,
  eventsService,
  findRosterConflicts,
  leadersService,
  matchesEventFilter,
  membersService,
  memberUsage,
  resolveMember,
  rolesService,
  requestsService,
  rostersService,
  searchRostersByName,
  teamsService,
  usersService,
  authenticate,
} from './index'
import { attendanceRate, rosterResponses, upcomingBirthdays } from './reports'
import { addDays, nextWeekday, todayISO } from '../utils/date'

beforeEach(async () => {
  await resetAllData()
})

describe('repositório local', () => {
  it('semeia, cria, edita e exclui mantendo os dados', async () => {
    expect((await repos.members.list()).length).toBeGreaterThan(20)
    const created = await membersService.create({
      fullName: 'Teste da Silva',
      birthDate: '2000-01-01',
      phone: '',
      email: '',
      address: '',
      baptismDate: '',
      status: 'ativo',
      notes: '',
    })
    expect(created.id).toBeTruthy()
    await membersService.update(created.id, { phone: '(11) 90000-0000' })
    expect((await repos.members.get(created.id))?.phone).toBe('(11) 90000-0000')
    await membersService.remove(created.id)
    expect(await repos.members.get(created.id)).toBeUndefined()
  })

  it('avisa os assinantes quando algo muda', async () => {
    let calls = 0
    const stop = repos.members.subscribe(() => calls++)
    await repos.members.update('mem-01', { notes: 'x' })
    stop()
    await repos.members.update('mem-01', { notes: 'y' })
    expect(calls).toBe(1)
  })

  it('exporta e importa um backup completo', async () => {
    const backup = exportAllData()
    await repos.members.remove('mem-01')
    await importAllData(backup)
    expect(await repos.members.get('mem-01')).toBeDefined()
    await expect(importAllData('não é json')).rejects.toThrow()
  })
})

describe('membros', () => {
  it('rejeita e-mail inválido', async () => {
    await expect(membersService.update('mem-01', { email: 'sem-arroba' })).rejects.toThrow(/e-mail/i)
  })

  it('remove o membro de equipes, escalas, eventos e usuários ao excluir', async () => {
    const before = await memberUsage('mem-01')
    expect(before.teams).toBeGreaterThan(0)
    expect(before.users).toBe(1)
    await membersService.remove('mem-01')
    const after = await memberUsage('mem-01')
    expect(after).toEqual({ teams: 0, leaders: 0, events: 0, rosters: 0, users: 0, services: 0 })
    expect((await repos.users.get('user-01'))?.memberId).toBeUndefined()
  })
})

describe('usuários e perfis', () => {
  it('autentica apenas com e-mail e senha corretos', async () => {
    await expect(authenticate('ana.paula@igreja.demo', '123456')).resolves.toMatchObject({ id: 'user-01' })
    await expect(authenticate('ana.paula@igreja.demo', 'errada')).rejects.toThrow(/incorretos/)
    await repos.users.update('user-06', { status: 'inativo' })
    await expect(authenticate('membro@igreja.demo', '123456')).rejects.toThrow(/inativo/)
  })

  it('impede e-mail duplicado', async () => {
    await expect(usersService.update('user-02', { email: 'ana.paula@igreja.demo' })).rejects.toThrow(/e-mail/i)
  })

  it('registra o último acesso ao entrar', async () => {
    expect((await repos.users.get('user-06'))?.lastLoginAt).toBeUndefined()
    await authenticate('membro@igreja.demo', '123456')
    expect((await repos.users.get('user-06'))?.lastLoginAt).toBeTruthy()
  })

  it('reconhece o membro do usuário pelo vínculo, pelo e-mail ou pelo nome', async () => {
    const members = await repos.members.list()
    const user = (await repos.users.get('user-02'))!
    expect(resolveMember({ ...user, memberId: 'mem-08' }, members)?.id).toBe('mem-08')
    // sem vínculo: o título "Pr." é ignorado ao comparar o nome
    expect(resolveMember({ ...user, memberId: undefined }, members)?.fullName).toBe('Marcos Antônio Lima')
    expect(resolveMember({ ...user, memberId: undefined, name: 'Outra Pessoa', email: 'ana.souza@exemplo.com.br' }, members)?.fullName).toBe('Ana Souza')
    expect(resolveMember({ ...user, memberId: undefined, name: 'Pessoa Sem Cadastro', email: 'x@y.com' }, members)).toBeNull()
    expect(resolveMember(null, members)).toBeNull()
  })

  it('garante um cadastro de membro para todo usuário criado', async () => {
    const members = await repos.members.list()
    const chosen = members.find((m) => m.fullName === 'Ana Souza')!
    await expect(
      ensureMemberForUser({ name: 'Outro Nome', email: 'outro@exemplo.com', memberId: chosen.id }, members),
    ).resolves.toEqual({ memberId: chosen.id, created: false })

    // sem escolha: reconhece o membro existente pelo e-mail
    await expect(ensureMemberForUser({ name: 'Ana Souza', email: 'ana.souza@exemplo.com.br' })).resolves.toEqual({
      memberId: chosen.id,
      created: false,
    })

    // sem membro correspondente: cria um com os dados do usuário
    const created = await ensureMemberForUser({
      name: 'Novo Usuário Teste',
      email: 'novo.usuario@exemplo.com',
      phone: '(11) 99999-0000',
      birthDate: '1990-05-20',
    })
    expect(created.created).toBe(true)
    expect(await repos.members.get(created.memberId)).toMatchObject({
      fullName: 'Novo Usuário Teste',
      email: 'novo.usuario@exemplo.com',
      phone: '(11) 99999-0000',
      birthDate: '1990-05-20',
      status: 'ativo',
    })
  })

  it('permissões personalizadas valem no lugar das do perfil', async () => {
    const role = (await repos.roles.get('role-membro'))!
    const custom = buildMatrix({ membros: ['view', 'edit'] })
    expect(hasPermission(effectivePermissions({ customPermissions: undefined }, role), 'membros')).toBe(false)
    expect(hasPermission(effectivePermissions({ customPermissions: custom }, role), 'membros', 'edit')).toBe(true)
    expect(hasPermission(effectivePermissions({ customPermissions: custom }, role), 'eventos')).toBe(false)
    await usersService.update('user-06', { customPermissions: custom })
    expect((await repos.users.get('user-06'))?.customPermissions?.membros.edit).toBe(true)
  })

  it('protege o último administrador e perfis em uso', async () => {
    await expect(usersService.remove('user-01')).rejects.toThrow(/administrador/)
    await expect(rolesService.remove('role-admin')).rejects.toThrow()
    await expect(rolesService.remove('role-membro')).rejects.toThrow(/usuário/)
  })

  it('avalia permissões, com "gerenciar" liberando todas as ações', () => {
    const matrix = buildMatrix({ eventos: ['view'], equipes: ['manage'] })
    expect(hasPermission(matrix, 'eventos', 'view')).toBe(true)
    expect(hasPermission(matrix, 'eventos', 'edit')).toBe(false)
    expect(hasPermission(matrix, 'equipes', 'delete')).toBe(true)
    expect(hasPermission(matrix, 'membros')).toBe(false)
    expect(hasPermission(undefined, 'eventos')).toBe(false)
  })
})

describe('lideranças e equipes', () => {
  it('trocar o líder da equipe atualiza o cadastro de lideranças', async () => {
    await teamsService.update('team-01', { leaderId: 'mem-10' })
    const leaders = (await repos.leaders.list()).filter(
      (l) => l.scope === 'equipe' && l.scopeId === 'team-01' && l.positionId === 'pos-lider',
    )
    expect(leaders).toHaveLength(1)
    expect(leaders[0].memberId).toBe('mem-10')
  })

  it('definir uma liderança principal atualiza o líder da equipe e mantém só um', async () => {
    const created = await leadersService.create({
      memberId: 'mem-12',
      positionId: 'pos-lider',
      scope: 'equipe',
      scopeId: 'team-03',
      since: todayISO(),
    })
    expect((await repos.teams.get('team-03'))?.leaderId).toBe('mem-12')
    expect((await repos.teams.get('team-03'))?.memberIds).toContain('mem-12')
    const primaries = (await repos.leaders.list()).filter(
      (l) => l.scopeId === 'team-03' && l.positionId === 'pos-lider',
    )
    expect(primaries.map((l) => l.id)).toEqual([created.id])
    await leadersService.remove(created.id)
    expect((await repos.teams.get('team-03'))?.leaderId).toBeUndefined()
  })

  it('impede liderança repetida', async () => {
    await expect(
      leadersService.create({
        memberId: 'mem-02',
        positionId: 'pos-lider',
        scope: 'equipe',
        scopeId: 'team-01',
        since: todayISO(),
      }),
    ).rejects.toThrow(/já possui/)
  })

  it('não remove o líder da equipe e adiciona/remove integrantes', async () => {
    await expect(teamsService.removeMember('team-01', 'mem-02')).rejects.toThrow(/líder/)
    await teamsService.addMember('team-03', 'mem-05')
    expect((await repos.teams.get('team-03'))?.memberIds).toContain('mem-05')
    await teamsService.removeMember('team-03', 'mem-05')
    expect((await repos.teams.get('team-03'))?.memberIds).not.toContain('mem-05')
  })

  it('bloqueia a exclusão de departamento e de equipe com vínculos', async () => {
    await expect(departmentsService.remove('dep-01')).rejects.toThrow(/equipe/)
    await expect(teamsService.remove('team-01')).rejects.toThrow(/escala/)
  })
})

describe('eventos', () => {
  const today = todayISO()
  const base = {
    title: 'x',
    description: '',
    time: '19:00',
    location: '',
    participants: [],
    cover: 'geral' as const,
  }

  it('deriva a situação exibida e os filtros', () => {
    const soon = { id: '1', ...base, date: addDays(today, 3), status: 'planejado' as const }
    const later = { id: '2', ...base, date: addDays(today, 30), status: 'planejado' as const }
    const past = { id: '3', ...base, date: addDays(today, -3), status: 'confirmado' as const }
    const cancelled = { id: '4', ...base, date: addDays(today, 2), status: 'cancelado' as const }
    expect(eventPhase(soon, today)).toBe('em-breve')
    expect(eventPhase(later, today)).toBe('planejado')
    expect(eventPhase(past, today)).toBe('realizado')
    expect(eventPhase(cancelled, today)).toBe('cancelado')
    expect(matchesEventFilter(soon, 'proximos', today)).toBe(true)
    expect(matchesEventFilter(past, 'proximos', today)).toBe(false)
    expect(matchesEventFilter(past, 'realizados', today)).toBe(true)
    expect(matchesEventFilter(cancelled, 'cancelados', today)).toBe(true)
    expect(matchesEventFilter(cancelled, 'proximos', today)).toBe(false)
  })

  it('gerencia participantes e notifica o cancelamento', async () => {
    await eventsService.addParticipant('ev-03', 'mem-20')
    await expect(eventsService.addParticipant('ev-03', 'mem-20')).rejects.toThrow(/já participa/)
    await eventsService.setParticipantStatus('ev-03', 'mem-20', 'confirmado')
    expect((await repos.events.get('ev-03'))?.participants.find((p) => p.memberId === 'mem-20')?.status).toBe('confirmado')
    await eventsService.removeParticipant('ev-03', 'mem-20')
    expect((await repos.events.get('ev-03'))?.participants.some((p) => p.memberId === 'mem-20')).toBe(false)

    const before = (await repos.notifications.list()).length
    await eventsService.update('ev-03', { status: 'cancelado' })
    expect((await repos.notifications.list()).length).toBe(before + 1)
  })
})

describe('escalas', () => {
  it('detecta membro repetido e conflito de horário', async () => {
    const rosters = await repos.rosters.list()
    const louvor = rosters.find((r) => r.id === 'ros-01')!
    const names = (id: string) => id
    expect(
      findRosterConflicts(
        { date: louvor.date, time: louvor.time, assignments: [{ memberId: 'mem-01', role: 'Vocal', status: 'pendente' }] },
        rosters,
        names,
      ),
    ).toHaveLength(1)
    expect(
      findRosterConflicts(
        {
          date: '2030-01-01',
          time: '10:00',
          assignments: [
            { memberId: 'mem-01', role: 'A', status: 'pendente' },
            { memberId: 'mem-01', role: 'B', status: 'pendente' },
          ],
        },
        rosters,
        names,
      ),
    ).toHaveLength(1)
  })

  it('não grava escala em conflito e confirma a presença do membro', async () => {
    const louvor = (await repos.rosters.get('ros-01'))!
    await expect(
      rostersService.create({
        title: 'Outra',
        date: louvor.date,
        time: louvor.time,
        location: '',
        teamId: 'team-03',
        notes: '',
        assignments: [{ memberId: 'mem-01', role: 'Som', status: 'pendente' }],
      }),
    ).rejects.toThrow(/mesmo horário/)
    await expect(
      rostersService.create({
        title: 'Vazia',
        date: '2030-01-01',
        time: '10:00',
        location: '',
        teamId: 'team-03',
        notes: '',
        assignments: [],
      }),
    ).rejects.toThrow(/ao menos um/)

    await rostersService.respond('ros-02', 'mem-01', 'confirmado')
    const updated = await repos.rosters.get('ros-02')
    expect(updated?.assignments.find((a) => a.memberId === 'mem-01')?.status).toBe('confirmado')
    await expect(rostersService.respond('ros-02', 'mem-28', 'confirmado')).rejects.toThrow(/não está/)
  })
})

describe('relatórios', () => {
  it('calcula respostas de escalas, presença e aniversariantes', async () => {
    const rosters = await repos.rosters.list()
    const responses = rosterResponses(rosters)
    expect(responses.total).toBe(responses.confirmado + responses.pendente + responses.recusado)
    const events = await repos.events.list()
    expect(attendanceRate(events).rate).toBeGreaterThan(0)
    const members = await repos.members.list()
    const today = todayISO()
    const sample = members.map((m) => ({ ...m, birthDate: '1990' + addDays(today, 5).slice(4) }))
    expect(upcomingBirthdays(sample, 10, today)).toHaveLength(sample.filter((m) => m.status !== 'inativo').length)
  })

  it('sempre há um próximo sábado a partir de amanhã', () => {
    const saturday = nextWeekday(6, addDays(todayISO(), 1))
    expect(saturday > todayISO()).toBe(true)
    expect(new Date(`${saturday}T12:00:00`).getDay()).toBe(6)
  })
})

describe('solicitações de cadastro', () => {
  const input = {
    fullName: 'Camila Teste Souza',
    birthDate: '1999-05-20',
    phone: '(11) 91234-5678',
    email: 'camila.teste@exemplo.com.br',
    address: 'Rua A, 10',
    baptized: true,
    baptismDate: '2015-03-14',
    teamIds: ['team-01', 'team-inexistente'],
    message: 'Quero ajudar',
  }

  it('entra como pendente, mantém só equipes ativas e avisa a secretaria', async () => {
    const before = (await repos.notifications.list()).length
    const created = await requestsService.submit(input)
    expect(created.status).toBe('pendente')
    expect(created.teamIds).toEqual(['team-01'])
    expect((await repos.notifications.list()).length).toBe(before + 1)
  })

  it('valida os dados e barra pedidos duplicados em análise', async () => {
    await expect(requestsService.submit({ ...input, fullName: 'Camila' })).rejects.toThrow(/nome completo/i)
    await expect(requestsService.submit({ ...input, phone: '123' })).rejects.toThrow(/telefone/i)
    await expect(requestsService.submit({ ...input, email: '' })).rejects.toThrow(/e-mail/i)
    await expect(requestsService.submit({ ...input, email: 'sem-arroba' })).rejects.toThrow(/e-mail/i)
    await requestsService.submit(input)
    await expect(requestsService.submit({ ...input, email: 'outro@exemplo.com.br' })).rejects.toThrow(/em análise/)
    await expect(requestsService.submit({ ...input, phone: '(11) 90000-0000' })).rejects.toThrow(/em análise/)
  })

  it('aprovar cria o membro, coloca nas equipes e não permite analisar de novo', async () => {
    const request = await requestsService.submit(input)
    const members = (await repos.members.list()).length
    const member = await requestsService.approve(request.id, { teamIds: ['team-01'], status: 'ativo' }, 'Fernanda')
    expect((await repos.members.list()).length).toBe(members + 1)
    expect(member).toMatchObject({ fullName: 'Camila Teste Souza', status: 'ativo', baptismDate: '2015-03-14' })
    expect((await repos.teams.get('team-01'))?.memberIds).toContain(member.id)
    expect(await repos.requests.get(request.id)).toMatchObject({ status: 'aprovada', memberId: member.id, reviewedBy: 'Fernanda' })
    await expect(requestsService.approve(request.id, { teamIds: [], status: 'ativo' }, 'x')).rejects.toThrow(/já foi analisada/)
    await expect(requestsService.reject(request.id, 'motivo', 'x')).rejects.toThrow(/já foi analisada/)
  })

  it('recusar exige o motivo e fica registrado', async () => {
    const request = await requestsService.submit(input)
    await expect(requestsService.reject(request.id, '  ', 'Fernanda')).rejects.toThrow(/motivo/)
    await requestsService.reject(request.id, 'Cadastro duplicado', 'Fernanda')
    expect(await repos.requests.get(request.id)).toMatchObject({ status: 'recusada', reason: 'Cadastro duplicado' })
  })
})

describe('busca de escalas pelo nome (visitante)', () => {
  it('encontra escalas futuras ignorando acentos e maiúsculas e exige 3 letras', async () => {
    const rosters = await repos.rosters.list()
    const members = await repos.members.list()
    const nameOf = (id: string) => members.find((m) => m.id === id)?.fullName ?? ''
    const found = searchRostersByName(rosters, nameOf, 'ANA paula')
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((match) => match.slots.every((slot) => slot.memberId === 'mem-01'))).toBe(true)
    expect(searchRostersByName(rosters, nameOf, 'an')).toEqual([])
    expect(searchRostersByName(rosters, nameOf, 'Fulano Inexistente')).toEqual([])
    expect(searchRostersByName(rosters, nameOf, 'ana paula', '2999-01-01')).toEqual([])
  })
})
