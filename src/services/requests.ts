import type { ID, Member, MemberRequest, MemberStatus } from '../models'
import { repos } from '../repositories'
import { isValidEmail, normalize } from '../utils/misc'
import { createCrudService } from './crud'
import { membersService, teamsService } from './people'
import { notify } from './system'

/** Dados enviados pela própria pessoa na tela pública de cadastro. */
export interface MemberRequestInput {
  fullName: string
  birthDate: string
  phone: string
  email: string
  address: string
  baptized: boolean
  baptismDate: string
  teamIds: ID[]
  message: string
}

const digits = (value: string) => value.replace(/\D/g, '')

const base = createCrudService<MemberRequest>(repos.requests, {
  label: 'Solicitação',
  feminine: true,
  activityKind: 'membro',
  nameOf: (r) => r.fullName,
  async validate(data, existing) {
    if (existing) return // só o envio inicial é validado; análise e edição seguem outras regras
    if ((data.fullName ?? '').trim().split(/\s+/).filter(Boolean).length < 2) {
      throw new Error('Informe o nome completo (nome e sobrenome).')
    }
    if (digits(data.phone ?? '').length < 10) throw new Error('Informe um telefone com DDD.')
    if (!data.email?.trim()) throw new Error('Informe o e-mail de contato.')
    if (!isValidEmail(data.email)) throw new Error('Informe um e-mail válido.')
    const pending = (await repos.requests.list()).filter((r) => r.status === 'pendente')
    const sameEmail = data.email && pending.some((r) => r.email && normalize(r.email) === normalize(data.email ?? ''))
    const samePhone = pending.some((r) => digits(r.phone) === digits(data.phone ?? ''))
    if (sameEmail || samePhone) {
      throw new Error('Já existe uma solicitação em análise com este contato. Aguarde o retorno da secretaria.')
    }
  },
  async afterSave(request, previous) {
    if (previous) return
    const teams = (await repos.teams.list()).filter((t) => request.teamIds.includes(t.id))
    const interest = teams.length ? ` Equipes de interesse: ${teams.map((t) => t.name).join(', ')}.` : ''
    await notify('aviso', 'Nova solicitação de cadastro', `${request.fullName} pediu para ser cadastrado(a) como membro.${interest}`)
  },
})

export const requestsService = {
  ...base,

  /** Envio feito pela pessoa, sem login. Entra como "pendente" até alguém da equipe analisar. */
  async submit(input: MemberRequestInput) {
    const activeTeams = new Set((await repos.teams.list()).filter((t) => t.status === 'ativa').map((t) => t.id))
    return base.create({
      fullName: input.fullName.trim(),
      birthDate: input.birthDate,
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      baptized: input.baptized,
      baptismDate: input.baptized ? input.baptismDate : '',
      teamIds: input.teamIds.filter((id) => activeTeams.has(id)),
      message: input.message.trim(),
      status: 'pendente',
    })
  },

  /** Cria o membro a partir da solicitação e o coloca nas equipes confirmadas. */
  async approve(id: ID, options: { teamIds: ID[]; status: MemberStatus }, reviewer: string): Promise<Member> {
    const request = await repos.requests.get(id)
    if (!request) throw new Error('Solicitação não encontrada.')
    if (request.status !== 'pendente') throw new Error('Esta solicitação já foi analisada.')
    const member = await membersService.create({
      fullName: request.fullName,
      birthDate: request.birthDate,
      phone: request.phone,
      email: request.email,
      address: request.address,
      baptismDate: request.baptized ? request.baptismDate : '',
      status: options.status,
      notes: request.message ? `Mensagem no cadastro: ${request.message}` : '',
    })
    for (const teamId of options.teamIds) await teamsService.addMember(teamId, member.id)
    await repos.requests.update(id, {
      status: 'aprovada',
      teamIds: options.teamIds,
      memberId: member.id,
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
    })
    return member
  },

  async reject(id: ID, reason: string, reviewer: string) {
    const request = await repos.requests.get(id)
    if (!request) throw new Error('Solicitação não encontrada.')
    if (request.status !== 'pendente') throw new Error('Esta solicitação já foi analisada.')
    if (!reason.trim()) throw new Error('Informe o motivo da recusa para ficar registrado.')
    return repos.requests.update(id, {
      status: 'recusada',
      reason: reason.trim(),
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
    })
  },
}

export const pendingRequests = (requests: MemberRequest[]) => requests.filter((r) => r.status === 'pendente')
