import type { ID, LeaderScope } from '../models'
import { repos } from '../repositories'

/** Cargo que define o "líder responsável" exibido em cada equipe ou departamento. */
export const PRIMARY_POSITION: Record<LeaderScope, ID> = {
  equipe: 'pos-lider',
  departamento: 'pos-diretor',
}

async function setScopeLeader(scope: LeaderScope, scopeId: ID, leaderId: ID | undefined) {
  if (scope === 'departamento') {
    const department = await repos.departments.get(scopeId)
    if (department && department.leaderId !== leaderId) await repos.departments.update(scopeId, { leaderId })
    return
  }
  const team = await repos.teams.get(scopeId)
  if (!team || team.leaderId === leaderId) return
  const memberIds =
    leaderId && !team.memberIds.includes(leaderId) ? [...team.memberIds, leaderId] : team.memberIds
  await repos.teams.update(scopeId, { leaderId, memberIds })
}

/** Recalcula o líder responsável a partir do registro de lideranças. */
export async function reconcileLeader(scope: LeaderScope, scopeId: ID) {
  const all = await repos.leaders.list()
  const primary = all.find(
    (l) => l.scope === scope && l.scopeId === scopeId && l.positionId === PRIMARY_POSITION[scope],
  )
  await setScopeLeader(scope, scopeId, primary?.memberId)
}

/** Equipe ou departamento foi salvo com um líder: reflete no cadastro de lideranças. */
export async function syncLeaderFromEntity(scope: LeaderScope, scopeId: ID, leaderId?: ID) {
  const all = await repos.leaders.list()
  const primaries = all.filter(
    (l) => l.scope === scope && l.scopeId === scopeId && l.positionId === PRIMARY_POSITION[scope],
  )
  if (primaries.length === 1 && primaries[0].memberId === leaderId) return
  for (const old of primaries) await repos.leaders.remove(old.id)
  if (leaderId) {
    await repos.leaders.create({
      memberId: leaderId,
      positionId: PRIMARY_POSITION[scope],
      scope,
      scopeId,
      since: new Date().toISOString().slice(0, 10),
    })
  }
}

/** Mantém no máximo um responsável principal por equipe/departamento. */
export async function enforceSinglePrimary(keepId: ID, scope: LeaderScope, scopeId: ID) {
  const all = await repos.leaders.list()
  for (const other of all) {
    if (
      other.id !== keepId &&
      other.scope === scope &&
      other.scopeId === scopeId &&
      other.positionId === PRIMARY_POSITION[scope]
    ) {
      await repos.leaders.remove(other.id)
    }
  }
}
