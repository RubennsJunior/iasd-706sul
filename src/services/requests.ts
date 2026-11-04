import type { ID, Member, MemberRequest, MemberStatus, NewEntity } from '../models'
import { explainCloudError } from '../lib/cloudStatus'
import { getSession } from '../lib/cloudSession'
import { cloudEnabled } from '../lib/firebase'
import { repos } from '../repositories'
import { isValidEmail } from '../utils/misc'
import { createCrudService } from './crud'
import { membersService, sameEmail, teamsService } from './people'
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

/** Só letras, números e . _ % + - @ : o e-mail vira parte do código da solicitação. */
const SAFE_EMAIL = /^[A-Za-z0-9._%+@-]+$/

/**
 * Código da solicitação = o e-mail. Assim o banco de dados só aceita UMA solicitação por e-mail, mesmo quando quem
 * envia (visitante sem login) não pode ler as já enviadas. Uma solicitação recusada pode ser reenviada.
 */
export const requestIdFor = (email: string) => `req-${email.trim().toLowerCase()}`

/** Quem pode ler membros e usuários; o visitante não, e para ele essa conferência é feita pela secretaria. */
const canSeePeople = () => !cloudEnabled || Boolean(getSession())

/** Já existe cadastro (membro) com este e-mail? Só confere quando a pessoa logada pode ver os membros. */
export async function findMemberByEmail(email: string): Promise<Member | undefined> {
  if (!email.trim() || !canSeePeople()) return undefined
  return (await repos.members.list()).find((m) => m.email && sameEmail(m.email, email))
}

async function checkNewRequest(data: Partial<NewEntity<MemberRequest>>) {
  if ((data.fullName ?? '').trim().split(/\s+/).filter(Boolean).length < 2) {
    throw new Error('Informe o nome completo (nome e sobrenome).')
  }
  if (digits(data.phone ?? '').length < 10) throw new Error('Informe um telefone com DDD.')
  const email = data.email?.trim() ?? ''
  if (!email) throw new Error('Informe o e-mail de contato.')
  if (!isValidEmail(email) || !SAFE_EMAIL.test(email)) throw new Error('Informe um e-mail válido.')

  const pending = (await repos.requests.list()).filter((r) => r.status === 'pendente')
  if (pending.some((r) => r.email && sameEmail(r.email, email))) {
    throw new Error('Já existe uma solicitação em análise com este e-mail. Aguarde o retorno da secretaria.')
  }
  if (pending.some((r) => digits(r.phone) === digits(data.phone ?? ''))) {
    throw new Error('Já existe uma solicitação em análise com este telefone. Aguarde o retorno da secretaria.')
  }
  const member = await findMemberByEmail(email)
  if (member) throw new Error('Este e-mail já está cadastrado como membro. Se foi você, fale com a secretaria.')
}

const base = createCrudService<MemberRequest>(repos.requests, {
  label: 'Solicitação',
  feminine: true,
  activityKind: 'membro',
  nameOf: (r) => r.fullName,
  async validate(data, existing) {
    if (existing) return // só o envio inicial é validado; análise e edição seguem outras regras
    await checkNewRequest(data)
  },
  async afterSave(request, previous) {
    if (previous) return
    // o aviso à secretaria é um complemento: se falhar, a solicitação já foi enviada e não pode parecer perdida
    try {
      const teams = (await repos.teams.list()).filter((t) => request.teamIds.includes(t.id))
      const interest = teams.length ? ` Equipes de interesse: ${teams.map((t) => t.name).join(', ')}.` : ''
      await notify('aviso', 'Nova solicitação de cadastro', `${request.fullName} pediu para ser cadastrado(a) como membro.${interest}`)
    } catch {
      // ignorado de propósito
    }
  },
})

/** Traduz a recusa do servidor para uma mensagem que a pessoa entenda. */
function explainSubmitError(error: unknown): Error {
  const code = (error as { code?: string } | undefined)?.code ?? ''
  if (code === 'permission-denied') {
    return new Error('Já existe uma solicitação com este e-mail. Se ela ainda está em análise, aguarde o retorno da secretaria.')
  }
  if (error instanceof Error && !code) return error
  if (code === 'timeout' || code === 'unavailable') return new Error('Sem conexão com a nuvem. Verifique a internet e tente novamente.')
  return new Error(explainCloudError(error))
}

export const requestsService = {
  ...base,

  /**
   * Envio feito pela pessoa, sem login. Entra como "pendente" até alguém da equipe analisar. Só termina quando o
   * servidor confirma o recebimento — o pedido nunca fica guardado apenas no aparelho de quem enviou.
   */
  async submit(input: MemberRequestInput): Promise<MemberRequest> {
    const activeTeams = new Set((await repos.teams.list()).filter((t) => t.status === 'ativa').map((t) => t.id))
    const fresh = {
      fullName: input.fullName.trim(),
      birthDate: input.birthDate,
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      baptized: input.baptized,
      baptismDate: input.baptized ? input.baptismDate : '',
      teamIds: input.teamIds.filter((id) => activeTeams.has(id)),
      message: input.message.trim(),
      status: 'pendente' as const,
    }
    const id = requestIdFor(fresh.email)
    const previous = await repos.requests.get(id) // o visitante não enxerga as solicitações; quem está logado, sim
    try {
      if (previous?.status === 'recusada') {
        await checkNewRequest(fresh)
        // reenvio de quem foi recusado: volta para análise com os dados novos e sem a decisão anterior
        return await base.update(id, { ...fresh, reviewedBy: undefined, reviewedAt: undefined, reason: undefined, memberId: undefined })
      }
      if (previous) throw new Error('Já existe uma solicitação com este e-mail. Se ela ainda está em análise, aguarde o retorno da secretaria.')
      return await base.create({ ...fresh, id } as NewEntity<MemberRequest>, { confirm: true })
    } catch (error) {
      throw explainSubmitError(error)
    }
  },

  /** Cria o membro a partir da solicitação e o coloca nas equipes confirmadas. */
  async approve(id: ID, options: { teamIds: ID[]; status: MemberStatus }, reviewer: string): Promise<Member> {
    const request = await repos.requests.get(id)
    if (!request) throw new Error('Solicitação não encontrada.')
    if (request.status !== 'pendente') throw new Error('Esta solicitação já foi analisada.')
    // a conferência de e-mail repetido acontece em membersService.create e avisa quem já tem esse e-mail
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
