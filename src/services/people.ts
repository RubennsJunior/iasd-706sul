import type {
  AppUser,
  Department,
  ID,
  LeaderAssignment,
  Member,
  NewEntity,
  Position,
  Role,
  Team,
} from '../models'
import { seedRoles } from '../data/seed/people'
import { MODULES } from '../models'
import { normalizeMatrix, permissionSet } from '../models/permissions'
import { repos } from '../repositories'
import { isValidEmail, normalize, pluralize } from '../utils/misc'
import { createCrudService } from './crud'
import { assertScope, getScope } from './scope'
import { PRIMARY_POSITION, enforceSinglePrimary, reconcileLeader, syncLeaderFromEntity } from './leadership'

/** Quantos vínculos um membro possui (usado para avisar antes de excluir). */
export async function memberUsage(memberId: ID) {
  const [teams, leaders, events, rosters, users, services] = await Promise.all([
    repos.teams.list(),
    repos.leaders.list(),
    repos.events.list(),
    repos.rosters.list(),
    repos.users.list(),
    repos.services.list(),
  ])
  return {
    teams: teams.filter((t) => t.memberIds.includes(memberId) || t.leaderId === memberId).length,
    leaders: leaders.filter((l) => l.memberId === memberId).length,
    events: events.filter(
      (e) => e.responsibleId === memberId || e.participants.some((p) => p.memberId === memberId),
    ).length,
    rosters: rosters.filter((r) => r.assignments.some((a) => a.memberId === memberId)).length,
    users: users.filter((u) => u.memberId === memberId).length,
    services: services.filter(
      (s) => s.leaderId === memberId || s.program.some((p) => p.responsibleId === memberId),
    ).length,
  }
}

/** Mantém o diretório público de nomes (visitante e perfis sem acesso a "Membros") igual ao cadastro de membros. */
async function upsertDirectory(member: { id: ID; fullName: string }) {
  const existing = await repos.directory.get(member.id)
  if (!existing) await repos.directory.create({ id: member.id, fullName: member.fullName })
  else if (existing.fullName !== member.fullName) await repos.directory.update(member.id, { fullName: member.fullName })
}

/** Acerta o diretório de nomes com os membros (dados anteriores ao diretório, importações). Só para quem enxerga os membros. */
export async function syncDirectory() {
  const [members, directory] = await Promise.all([repos.members.list(), repos.directory.list()])
  if (members.length === 0) return // sem acesso aos membros (ou nenhum): nunca apagar o diretório por isso
  const known = new Map(directory.map((d) => [d.id, d.fullName]))
  for (const member of members) if (known.get(member.id) !== member.fullName) await upsertDirectory(member)
  const ids = new Set(members.map((m) => m.id))
  for (const entry of directory) if (!ids.has(entry.id)) await repos.directory.remove(entry.id)
}

/**
 * Perfis gravados antes de existir algum módulo (ex.: Patrimônio) não têm a entrada dele. Completa cada perfil: o módulo
 * novo recebe o padrão do perfil de fábrica (Administrador Geral: acesso total) ou, em perfis criados pela igreja, fica
 * sem permissão até alguém liberar. Não mexe no que já estava marcado.
 */
export async function completeRoles() {
  const defaults = new Map(seedRoles().map((r) => [r.id, r.permissions]))
  for (const role of await repos.roles.list()) {
    const missing = MODULES.filter((m) => !role.permissions?.[m])
    if (missing.length === 0) continue
    const permissions = { ...(role.permissions ?? {}) } as Role['permissions']
    for (const module of missing) permissions[module] = defaults.get(role.id)?.[module] ?? permissionSet()
    await repos.roles.update(role.id, { permissions })
  }
}

/** Tira da lista as contas de demonstração antigas: na nuvem elas não têm acesso no Firebase Authentication. */
export async function purgeDemoUsers(keepId: ID) {
  for (const user of await repos.users.list()) {
    if (user.id !== keepId && user.email.endsWith('@igreja.demo')) await repos.users.remove(user.id)
  }
}

/** O mesmo e-mail escrito de outro jeito (maiúsculas, espaços nas pontas) conta como repetido. */
export const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const membersService = createCrudService<Member>(repos.members, {
  label: 'Membro',
  activityKind: 'membro',
  nameOf: (m) => m.fullName,
  async validate(data, existing) {
    const email = data.email?.trim()
    if (!email) return
    if (!isValidEmail(email)) throw new Error('Informe um e-mail válido.')
    // quem já tinha este e-mail (mesmo repetido em dados antigos) pode continuar sendo editado
    if (existing?.email && sameEmail(existing.email, email)) return
    const other = (await repos.members.list()).find((m) => m.id !== existing?.id && m.email && sameEmail(m.email, email))
    if (other) throw new Error(`Já existe um membro com este e-mail: ${other.fullName}.`)
  },
  async afterSave(member, previous) {
    if (!previous || previous.fullName !== member.fullName) await upsertDirectory(member)
  },
  async afterRemove(member) {
    await repos.directory.remove(member.id)
  },
  async beforeRemove(member) {
    const id = member.id
    for (const team of await repos.teams.list()) {
      if (team.memberIds.includes(id) || team.leaderId === id) {
        await repos.teams.update(team.id, {
          memberIds: team.memberIds.filter((m) => m !== id),
          leaderId: team.leaderId === id ? undefined : team.leaderId,
        })
      }
    }
    for (const dep of await repos.departments.list()) {
      if (dep.leaderId === id) await repos.departments.update(dep.id, { leaderId: undefined })
    }
    for (const leader of await repos.leaders.list()) {
      if (leader.memberId === id) await repos.leaders.remove(leader.id)
    }
    for (const event of await repos.events.list()) {
      if (event.responsibleId === id || event.participants.some((p) => p.memberId === id)) {
        await repos.events.update(event.id, {
          responsibleId: event.responsibleId === id ? undefined : event.responsibleId,
          participants: event.participants.filter((p) => p.memberId !== id),
        })
      }
    }
    for (const roster of await repos.rosters.list()) {
      if (roster.assignments.some((a) => a.memberId === id)) {
        await repos.rosters.update(roster.id, {
          assignments: roster.assignments.filter((a) => a.memberId !== id),
        })
      }
    }
    for (const service of await repos.services.list()) {
      if (service.leaderId === id || service.program.some((p) => p.responsibleId === id)) {
        await repos.services.update(service.id, {
          leaderId: service.leaderId === id ? undefined : service.leaderId,
          program: service.program.map((p) =>
            p.responsibleId === id ? { ...p, responsibleId: undefined } : p,
          ),
        })
      }
    }
    for (const user of await repos.users.list()) {
      if (user.memberId === id) await repos.users.update(user.id, { memberId: undefined })
    }
  },
})

const TITLE_PREFIX = /^(pr|pra|dr|dra)\.?\s+/i

/**
 * Membro correspondente ao usuário logado (usado em "minhas escalas", "minhas equipes"…).
 * Usa o vínculo interno, se existir; senão procura um membro com o mesmo e-mail ou nome.
 */
export function resolveMember(user: AppUser | null | undefined, members: Member[]): Member | null {
  if (!user) return null
  const linked = user.memberId ? members.find((m) => m.id === user.memberId) : undefined
  if (linked) return linked
  const email = normalize(user.email.trim())
  const name = normalize(user.name.trim().replace(TITLE_PREFIX, ''))
  return (
    members.find((m) => m.email && normalize(m.email.trim()) === email) ??
    members.find((m) => normalize(m.fullName.trim()) === name) ??
    null
  )
}

/**
 * Garante que todo usuário tenha um cadastro de membro: usa o membro escolhido na tela, reconhece um já existente
 * pelo e-mail/nome ou cria um novo com os dados do usuário. Devolve o vínculo e se o membro acabou de ser criado
 * (para desfazer caso a criação do acesso falhe).
 */
export async function ensureMemberForUser(
  user: Partial<AppUser> & Pick<AppUser, 'name' | 'email'>,
  members?: Member[],
): Promise<{ memberId: ID; created: boolean }> {
  const list = members ?? (await repos.members.list())
  const chosen = user.memberId ? list.find((member) => member.id === user.memberId) : undefined
  if (chosen) return { memberId: chosen.id, created: false }
  const existing = resolveMember({ ...user, id: user.id ?? '' } as AppUser, list)
  if (existing) return { memberId: existing.id, created: false }
  const member = await membersService.create({
    fullName: user.name.trim(),
    birthDate: user.birthDate ?? '',
    phone: user.phone ?? '',
    email: user.email.trim(),
    address: '',
    baptismDate: '',
    status: 'ativo',
    notes: '',
  })
  return { memberId: member.id, created: true }
}

/** Regras do cadastro de usuário; a tela também as usa antes de criar o acesso no Firebase (para não deixar acesso órfão). */
export async function validateUser(data: Partial<NewEntity<AppUser>>, existing?: AppUser) {
  if (data.email && !isValidEmail(data.email)) throw new Error('Informe um e-mail válido.')
  if (data.password !== undefined && data.password.length < 4) {
    throw new Error('A senha deve ter pelo menos 4 caracteres.')
  }
  const all = await repos.users.list()
  if (existing?.roleId === 'role-admin') {
    const demoted = data.roleId !== 'role-admin' || data.status !== 'ativo'
    const otherAdmins = all.filter((u) => u.id !== existing.id && u.roleId === 'role-admin' && u.status === 'ativo')
    if (demoted && otherAdmins.length === 0) {
      throw new Error('Mantenha ao menos um administrador ativo no sistema.')
    }
  }
  const email = data.email?.trim()
  if (email) {
    const other = all.find((u) => u.id !== existing?.id && sameEmail(u.email, email))
    if (other) throw new Error(`Já existe um usuário com este e-mail: ${other.name}.`)
  }
}

export const usersService = createCrudService<AppUser>(repos.users, {
  label: 'Usuário',
  activityKind: 'usuario',
  nameOf: (u) => u.name,
  validate: validateUser,
  async beforeRemove(user) {
    const admins = (await repos.users.list()).filter(
      (u) => u.roleId === 'role-admin' && u.status === 'ativo' && u.id !== user.id,
    )
    if (user.roleId === 'role-admin' && admins.length === 0) {
      throw new Error('Mantenha ao menos um administrador ativo no sistema.')
    }
  },
})

export const rolesService = createCrudService<Role>(repos.roles, {
  label: 'Perfil',
  activityKind: 'perfil',
  nameOf: (r) => r.name,
  async validate(data, existing) {
    const name = String(data.name ?? '').trim()
    if (!name) throw new Error('Informe o nome do perfil.')
    const others = (await repos.roles.list()).filter((r) => r.id !== existing?.id)
    if (others.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new Error('Já existe um perfil com este nome.')
    }
    if (existing?.system) {
      // o perfil do administrador sempre tem acesso total e vale para toda a igreja
      const same = JSON.stringify(normalizeMatrix(data.permissions)) === JSON.stringify(normalizeMatrix(existing.permissions))
      if (!same || (data.reach ?? 'todos') !== 'todos') throw new Error('O perfil de administrador não pode ter as permissões alteradas.')
    }
  },
  async beforeRemove(role) {
    if (role.system) throw new Error('O perfil de administrador não pode ser excluído.')
    const users = (await repos.users.list()).filter((u) => u.roleId === role.id)
    if (users.length > 0) {
      throw new Error(
        `Há ${pluralize(users.length, 'usuário')} com este perfil. Altere o perfil deles antes de excluir.`,
      )
    }
  },
})

export const departmentsService = createCrudService<Department>(repos.departments, {
  label: 'Departamento',
  activityKind: 'departamento',
  nameOf: (d) => d.name,
  authorize: (_action, item, existing) => {
    if (!existing) return assertScope('department', item, { isNew: true })
    assertScope('department', existing)
    // quem só enxerga a(s) equipe(s) pode consultar o departamento dela, não alterá-lo
    if (!getScope().all && getScope().reach !== 'departamento') throw new Error('Seu perfil só pode consultar departamentos.')
  },
  async afterSave(department, previous) {
    if (department.leaderId !== previous?.leaderId) {
      await syncLeaderFromEntity('departamento', department.id, department.leaderId)
    }
  },
  async beforeRemove(department) {
    const teams = (await repos.teams.list()).filter((t) => t.departmentId === department.id)
    if (teams.length > 0) {
      throw new Error(
        `Há ${pluralize(teams.length, 'equipe')} neste departamento. Mova ou exclua as equipes antes.`,
      )
    }
    for (const leader of await repos.leaders.list()) {
      if (leader.scope === 'departamento' && leader.scopeId === department.id) {
        await repos.leaders.remove(leader.id)
      }
    }
  },
})

export const positionsService = createCrudService<Position>(repos.positions, {
  label: 'Cargo',
  activityKind: 'cargo',
  nameOf: (p) => p.name,
  async beforeRemove(position) {
    if (Object.values(PRIMARY_POSITION).includes(position.id)) {
      throw new Error('Este cargo define o responsável das equipes e departamentos e não pode ser excluído.')
    }
    const used = (await repos.leaders.list()).filter((l) => l.positionId === position.id)
    if (used.length > 0) {
      throw new Error(`Há ${pluralize(used.length, 'liderança')} com este cargo. Remova-as antes de excluir.`)
    }
  },
})

export const leadersService = createCrudService<LeaderAssignment>(repos.leaders, {
  label: 'Liderança',
  feminine: true,
  activityKind: 'lideranca',
  nameOf: () => 'registro',
  silent: true,
  authorize: (action, item, existing) => {
    if (existing) assertScope('leader', existing)
    if (action !== 'remove') assertScope('leader', item, { isNew: !existing })
  },
  async validate(data, existing) {
    const all = await repos.leaders.list()
    const duplicate = all.find(
      (l) =>
        l.id !== existing?.id &&
        l.memberId === data.memberId &&
        l.positionId === data.positionId &&
        l.scope === data.scope &&
        l.scopeId === data.scopeId,
    )
    if (duplicate) throw new Error('Este membro já possui este cargo neste local.')
  },
  async afterSave(leader, previous) {
    if (leader.positionId === PRIMARY_POSITION[leader.scope]) {
      await enforceSinglePrimary(leader.id, leader.scope, leader.scopeId)
    }
    await reconcileLeader(leader.scope, leader.scopeId)
    if (previous && (previous.scope !== leader.scope || previous.scopeId !== leader.scopeId)) {
      await reconcileLeader(previous.scope, previous.scopeId)
    }
  },
  async afterRemove(leader) {
    await reconcileLeader(leader.scope, leader.scopeId)
  },
})

export const teamsService = {
  ...createCrudService<Team>(repos.teams, {
    label: 'Equipe',
    feminine: true,
    activityKind: 'equipe',
    nameOf: (t) => t.name,
    authorize: (_action, item, existing) => {
      if (existing) assertScope('team', existing)
      else assertScope('team', item, { isNew: true })
    },
    async afterSave(team, previous) {
      if (team.leaderId && !team.memberIds.includes(team.leaderId)) {
        await repos.teams.update(team.id, { memberIds: [...team.memberIds, team.leaderId] })
      }
      if (team.leaderId !== previous?.leaderId) {
        await syncLeaderFromEntity('equipe', team.id, team.leaderId)
      }
    },
    async beforeRemove(team) {
      const rosters = (await repos.rosters.list()).filter((r) => r.teamId === team.id)
      if (rosters.length > 0) {
        throw new Error(
          `Há ${pluralize(rosters.length, 'escala')} desta equipe. Exclua as escalas antes de excluir a equipe.`,
        )
      }
      for (const leader of await repos.leaders.list()) {
        if (leader.scope === 'equipe' && leader.scopeId === team.id) await repos.leaders.remove(leader.id)
      }
    },
  }),

  async addMember(teamId: ID, memberId: ID) {
    const team = await repos.teams.get(teamId)
    if (!team) throw new Error('Equipe não encontrada.')
    if (team.memberIds.includes(memberId)) return team
    return repos.teams.update(teamId, { memberIds: [...team.memberIds, memberId] })
  },

  async removeMember(teamId: ID, memberId: ID) {
    const team = await repos.teams.get(teamId)
    if (!team) throw new Error('Equipe não encontrada.')
    if (team.leaderId === memberId) {
      throw new Error('O líder responsável não pode ser removido. Defina outro líder antes.')
    }
    return repos.teams.update(teamId, { memberIds: team.memberIds.filter((m) => m !== memberId) })
  },
}
