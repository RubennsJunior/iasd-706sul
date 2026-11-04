import { beforeEach, describe, expect, it } from 'vitest'
import { repos, resetAllData } from '../repositories'
import { addDays, todayISO } from '../utils/date'
import { dataUrlBytes, fitSize, isImageFile, isPhoto } from '../utils/image'
import { actionState, applyActionChoice, cleanPlan, emptyPlan, moveItem, planOf, validatePlan } from './eventPlan'
import { eventsService, membersService, requestIdFor, requestsService, usersService } from './index'

beforeEach(async () => {
  await resetAllData()
})

const newMember = (patch: Partial<Parameters<typeof membersService.create>[0]> = {}) => ({
  fullName: 'Pessoa de Teste',
  birthDate: '',
  phone: '',
  email: '',
  address: '',
  baptismDate: '',
  status: 'ativo' as const,
  notes: '',
  ...patch,
})

describe('e-mail não pode ser cadastrado duas vezes', () => {
  it('membros: barra o mesmo e-mail, em qualquer capitalização, ao cadastrar e ao editar', async () => {
    await membersService.create(newMember({ email: 'Maria.Teste@Exemplo.com' }))
    await expect(membersService.create(newMember({ fullName: 'Outra Maria', email: 'maria.teste@exemplo.com' }))).rejects.toThrow(
      /Já existe um membro com este e-mail: Pessoa de Teste/,
    )
    await expect(membersService.create(newMember({ fullName: 'Outra Maria', email: '  MARIA.TESTE@EXEMPLO.COM ' }))).rejects.toThrow(/Já existe um membro/)

    const other = await membersService.create(newMember({ fullName: 'Joana Teste', email: 'joana.teste@exemplo.com' }))
    await expect(membersService.update(other.id, { email: 'maria.teste@exemplo.com' })).rejects.toThrow(/Já existe um membro/)
    // continuar com o próprio e-mail e vários cadastros sem e-mail é permitido
    await membersService.update(other.id, { email: 'joana.teste@exemplo.com', phone: '(11) 90000-0000' })
    await membersService.create(newMember({ fullName: 'Sem Email Um' }))
    await membersService.create(newMember({ fullName: 'Sem Email Dois' }))
  })

  it('membros: dados antigos que já repetem o e-mail continuam editáveis', async () => {
    const a = await membersService.create(newMember({ fullName: 'Antigo Um', email: 'antigo@exemplo.com' }))
    const b = await repos.members.create(newMember({ fullName: 'Antigo Dois', email: 'ANTIGO@exemplo.com' }))
    await expect(membersService.update(b.id, { notes: 'observação' })).resolves.toBeDefined()
    await expect(membersService.update(a.id, { phone: '(11) 91111-1111' })).resolves.toBeDefined()
  })

  it('usuários: barra o mesmo e-mail e diz com quem ele está', async () => {
    const [first] = await repos.users.list()
    await expect(
      usersService.create({ name: 'Outro', email: first.email.toUpperCase(), phone: '', roleId: first.roleId, status: 'ativo', password: 'abcd' }),
    ).rejects.toThrow(new RegExp(`Já existe um usuário com este e-mail: ${first.name}`))
  })

  it('solicitações: o código é o e-mail, então um e-mail só tem uma solicitação', async () => {
    const input = {
      fullName: 'Camila Teste Souza',
      birthDate: '',
      phone: '(11) 91234-5678',
      email: 'Camila.Teste@Exemplo.com',
      address: '',
      baptized: false,
      baptismDate: '',
      teamIds: [],
      message: '',
    }
    const created = await requestsService.submit(input)
    expect(created.id).toBe(requestIdFor('camila.teste@exemplo.com'))
    expect(created.id).toBe('req-camila.teste@exemplo.com')

    await expect(requestsService.submit({ ...input, phone: '(11) 98888-7777' })).rejects.toThrow(/e-mail/)
    await expect(requestsService.submit({ ...input, email: 'CAMILA.TESTE@EXEMPLO.COM', phone: '(11) 98888-7777' })).rejects.toThrow(/e-mail/)
    expect((await repos.requests.list()).filter((r) => r.email.toLowerCase() === 'camila.teste@exemplo.com')).toHaveLength(1)
  })

  it('solicitações: e-mail com caracteres que não podem virar código é recusado', async () => {
    await expect(
      requestsService.submit({
        fullName: 'Camila Teste Souza',
        birthDate: '',
        phone: '(11) 91234-5678',
        email: 'a/b@exemplo.com',
        address: '',
        baptized: false,
        baptismDate: '',
        teamIds: [],
        message: '',
      }),
    ).rejects.toThrow(/e-mail válido/)
  })

  it('solicitações: e-mail de quem já é membro não vira nova solicitação', async () => {
    const [member] = await repos.members.list()
    expect(member.email).toBeTruthy()
    await expect(
      requestsService.submit({
        fullName: 'Pessoa Repetida',
        birthDate: '',
        phone: '(11) 91234-5678',
        email: member.email.toUpperCase(),
        address: '',
        baptized: false,
        baptismDate: '',
        teamIds: [],
        message: '',
      }),
    ).rejects.toThrow(/já está cadastrado como membro/)
  })

  it('solicitações: aprovar não cria o mesmo membro duas vezes e a solicitação segue pendente', async () => {
    const request = await requestsService.submit({
      fullName: 'Camila Teste Souza',
      birthDate: '',
      phone: '(11) 91234-5678',
      email: 'camila.teste@exemplo.com',
      address: '',
      baptized: false,
      baptismDate: '',
      teamIds: [],
      message: '',
    })
    await membersService.create(newMember({ fullName: 'Camila Cadastrada Antes', email: 'camila.teste@exemplo.com' }))
    const members = (await repos.members.list()).length
    await expect(requestsService.approve(request.id, { teamIds: [], status: 'ativo' }, 'Fernanda')).rejects.toThrow(
      /Já existe um membro com este e-mail: Camila Cadastrada Antes/,
    )
    expect((await repos.members.list()).length).toBe(members)
    expect((await repos.requests.get(request.id))?.status).toBe('pendente')
  })

  it('solicitações: quem foi recusado pode reenviar e a decisão anterior some', async () => {
    const input = {
      fullName: 'Camila Teste Souza',
      birthDate: '',
      phone: '(11) 91234-5678',
      email: 'camila.teste@exemplo.com',
      address: '',
      baptized: false,
      baptismDate: '',
      teamIds: [],
      message: '',
    }
    const first = await requestsService.submit(input)
    await requestsService.reject(first.id, 'Faltou o telefone correto', 'Fernanda')
    const again = await requestsService.submit({ ...input, phone: '(11) 97777-6666', message: 'Corrigi o telefone' })
    expect(again.id).toBe(first.id)
    expect(await repos.requests.get(first.id)).toMatchObject({ status: 'pendente', phone: '(11) 97777-6666', message: 'Corrigi o telefone' })
    const stored = await repos.requests.get(first.id)
    expect(stored?.reason).toBeUndefined()
    expect(stored?.reviewedBy).toBeUndefined()
    expect((await repos.requests.list()).filter((r) => r.email === input.email)).toHaveLength(1)
  })

  it('solicitações: já aprovada, o mesmo e-mail não envia outra', async () => {
    const input = {
      fullName: 'Camila Teste Souza',
      birthDate: '',
      phone: '(11) 91234-5678',
      email: 'camila.teste@exemplo.com',
      address: '',
      baptized: false,
      baptismDate: '',
      teamIds: [],
      message: '',
    }
    const request = await requestsService.submit(input)
    await requestsService.approve(request.id, { teamIds: [], status: 'ativo' }, 'Fernanda')
    await expect(requestsService.submit({ ...input, phone: '(11) 90000-1111' })).rejects.toThrow(/Já existe uma solicitação com este e-mail/)
  })
})

describe('plano do evento', () => {
  it('eventos gravados antes dos novos campos têm tudo vazio', () => {
    expect(planOf({})).toEqual(emptyPlan())
  })

  it('moveItem troca com o vizinho e ignora os limites', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })

  it('cleanPlan tira linhas em branco, apara textos e ordena o cronograma por horário', () => {
    const plan = cleanPlan({
      schedule: [
        { id: '1', time: '20:30', title: ' Encerramento ' },
        { id: '2', time: '', title: '   ' },
        { id: '3', time: '19:00', title: 'Abertura', notes: '  ', responsibleId: '' },
      ],
      liturgy: [
        { id: 'l1', kind: 'Hino', title: ' Hino 12 ', details: '' },
        { id: 'l2', kind: 'Oração', title: '' },
      ],
      dynamics: [{ id: 'd1', title: 'Quebra-gelo', minutes: 0 }, { id: 'd2', title: 'Jogo', minutes: 15.9, materials: ' bola ' }],
      actions: [{ id: 'a1', title: ' Levar prato ', slots: 0, memberIds: ['m1', 'm1', 'm2'] }, { id: 'a2', title: '', memberIds: [] }],
    })
    expect(plan.schedule.map((s) => s.title)).toEqual(['Abertura', 'Encerramento'])
    expect(plan.schedule[0]).toEqual({ id: '3', time: '19:00', title: 'Abertura', responsibleId: undefined, notes: undefined })
    expect(plan.liturgy).toEqual([{ id: 'l1', kind: 'Hino', title: 'Hino 12', details: undefined, responsibleId: undefined }])
    expect(plan.dynamics.map((d) => [d.title, d.minutes, d.materials])).toEqual([
      ['Quebra-gelo', undefined, undefined],
      ['Jogo', 15, 'bola'],
    ])
    expect(plan.actions).toEqual([{ id: 'a1', title: 'Levar prato', description: undefined, slots: undefined, memberIds: ['m1', 'm2'] }])
  })

  it('validatePlan aponta o campo com problema', () => {
    const ok = emptyPlan()
    expect(validatePlan(ok)).toEqual({})
    expect(validatePlan({ ...ok, schedule: [{ id: '1', time: '', title: 'Sem horário' }] }).schedule).toMatch(/horário/)
    expect(validatePlan({ ...ok, schedule: [{ id: '1', time: '', title: '' }] })).toEqual({})
    expect(validatePlan({ ...ok, dynamics: [{ id: '1', title: 'X', minutes: 0 }] }).dynamics).toMatch(/minutos/)
    expect(validatePlan({ ...ok, dynamics: [{ id: '1', title: 'X', minutes: -5 }] }).dynamics).toMatch(/minutos/)
    expect(validatePlan({ ...ok, actions: [{ id: '1', title: 'X', slots: 0, memberIds: [] }] }).actions).toMatch(/vagas/)
    expect(validatePlan({ ...ok, actions: [{ id: '1', title: 'X', slots: 1, memberIds: ['a', 'b'] }] }).actions).toMatch(/mais pessoas do que vagas/)
    expect(validatePlan({ ...ok, actions: [{ id: '1', title: 'X', memberIds: ['a', 'b'] }] })).toEqual({})
  })

  it('escolher e largar ação respeita as vagas', () => {
    const actions = [{ id: 'a', title: 'Som', slots: 1, memberIds: [] as string[] }, { id: 'b', title: 'Recepção', memberIds: ['m9'] }]
    const taken = applyActionChoice(actions, 'a', 'm1', true)
    expect(taken[0].memberIds).toEqual(['m1'])
    expect(actionState(taken[0], 'm1')).toEqual({ taken: 1, left: 0, full: true, mine: true })
    expect(actionState(taken[1], 'm1')).toEqual({ taken: 1, left: undefined, full: false, mine: false })
    expect(() => applyActionChoice(taken, 'a', 'm2', true)).toThrow(/vagas/)
    expect(() => applyActionChoice(taken, 'a', 'm1', true)).toThrow(/já escolheu/)
    expect(() => applyActionChoice(taken, 'zzz', 'm1', true)).toThrow(/não existe/)
    expect(applyActionChoice(taken, 'a', 'm1', false)[0].memberIds).toEqual([])
    // largar uma ação que a pessoa não escolheu não muda nada
    expect(applyActionChoice(taken, 'b', 'm1', false)).toEqual(taken)
    // sem limite de vagas, todo mundo pode escolher
    expect(applyActionChoice(taken, 'b', 'm1', true)[1].memberIds).toEqual(['m9', 'm1'])
  })

  it('eventsService.chooseAction grava a escolha e encerra com o evento', async () => {
    const event = await eventsService.create({
      title: 'Confraternização',
      description: '',
      date: addDays(todayISO(), 7),
      time: '19:00',
      location: 'Salão',
      participants: [],
      status: 'confirmado',
      cover: 'geral',
      actions: [{ id: 'a1', title: 'Levar bolo', slots: 1, memberIds: [] }],
    })
    await eventsService.chooseAction(event.id, 'a1', 'mem-01', true)
    expect((await repos.events.get(event.id))?.actions?.[0].memberIds).toEqual(['mem-01'])
    await expect(eventsService.chooseAction(event.id, 'a1', 'mem-02', true)).rejects.toThrow(/vagas/)
    await eventsService.chooseAction(event.id, 'a1', 'mem-01', false)
    expect((await repos.events.get(event.id))?.actions?.[0].memberIds).toEqual([])

    await eventsService.update(event.id, { status: 'cancelado' })
    await expect(eventsService.chooseAction(event.id, 'a1', 'mem-01', true)).rejects.toThrow(/não aceita mais/)

    const past = await eventsService.create({
      title: 'Evento passado',
      description: '',
      date: addDays(todayISO(), -3),
      time: '19:00',
      location: 'Salão',
      participants: [],
      status: 'confirmado',
      cover: 'geral',
      actions: [{ id: 'a2', title: 'Som', memberIds: ['mem-03'] }],
    })
    await expect(eventsService.chooseAction(past.id, 'a2', 'mem-01', true)).rejects.toThrow(/não aceita mais/)
    // quem já tinha escolhido ainda consegue sair
    await eventsService.chooseAction(past.id, 'a2', 'mem-03', false)
    expect((await repos.events.get(past.id))?.actions?.[0].memberIds).toEqual([])
  })

  it('evento guarda foto, cronograma, liturgia, dinâmicas e ações', async () => {
    const created = await eventsService.create({
      title: 'Programação completa',
      description: '',
      date: addDays(todayISO(), 10),
      time: '10:00',
      location: 'Templo',
      participants: [],
      status: 'planejado',
      cover: 'louvor',
      photo: 'data:image/jpeg;base64,AAAA',
      ...cleanPlan({
        schedule: [{ id: 's1', time: '10:00', title: 'Abertura' }],
        liturgy: [{ id: 'l1', kind: 'Hino', title: 'Hino 1' }],
        dynamics: [{ id: 'd1', title: 'Quebra-gelo', minutes: 10 }],
        actions: [{ id: 'a1', title: 'Recepção', memberIds: [] }],
      }),
    })
    const stored = await repos.events.get(created.id)
    expect(stored?.photo).toBe('data:image/jpeg;base64,AAAA')
    expect(planOf(stored)).toMatchObject({
      schedule: [{ title: 'Abertura' }],
      liturgy: [{ title: 'Hino 1' }],
      dynamics: [{ title: 'Quebra-gelo', minutes: 10 }],
      actions: [{ title: 'Recepção' }],
    })
  })
})

describe('fotos', () => {
  it('calcula o tamanho de uma imagem em data URL', () => {
    expect(dataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3)
    expect(dataUrlBytes('data:image/jpeg;base64,AAA=')).toBe(2)
    expect(dataUrlBytes('data:image/jpeg;base64,AA==')).toBe(1)
  })

  it('reconhece só imagens', () => {
    expect(isImageFile({ type: 'image/jpeg' })).toBe(true)
    expect(isImageFile({ type: 'image/png' })).toBe(true)
    expect(isImageFile({ type: 'application/pdf' })).toBe(false)
    expect(isImageFile({ type: 'image/svg+xml' })).toBe(false)
    expect(isPhoto('data:image/jpeg;base64,AAAA')).toBe(true)
    expect(isPhoto('https://site.com/foto.jpg')).toBe(false)
    expect(isPhoto(undefined)).toBe(false)
  })

  it('reduz sem ampliar e recorta o centro no modo quadrado', () => {
    const wide = { maxWidth: 960, maxHeight: 540, maxBytes: 1 }
    expect(fitSize(1920, 1080, wide)).toMatchObject({ dw: 960, dh: 540 })
    expect(fitSize(4000, 1000, wide)).toMatchObject({ dw: 960, dh: 240 })
    expect(fitSize(400, 300, wide)).toMatchObject({ dw: 400, dh: 300 })
    const square = { maxWidth: 320, maxHeight: 320, maxBytes: 1, square: true }
    expect(fitSize(1000, 500, square)).toEqual({ sx: 250, sy: 0, sw: 500, sh: 500, dw: 320, dh: 320 })
    expect(fitSize(200, 300, square)).toEqual({ sx: 0, sy: 50, sw: 200, sh: 200, dw: 200, dh: 200 })
  })
})
