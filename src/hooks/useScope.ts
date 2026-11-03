import { useEffect, useMemo } from 'react'
import type { AppUser, Member, Role } from '../models'
import { repos } from '../repositories'
import { resolveScope, setScope } from '../services'
import { useCollection } from './useCollection'

/**
 * Abrangência de quem está logado: calculada a partir do perfil de acesso e da estrutura da igreja (líderes, equipes e
 * departamentos). Também informa os serviços, que recusam gravações fora dela.
 */
export function useScope(user: AppUser | null, role: Role | null, member: Member | null) {
  const { items: teams } = useCollection(repos.teams)
  const { items: departments } = useCollection(repos.departments)
  const { items: leaders } = useCollection(repos.leaders)
  const scope = useMemo(
    () => resolveScope(user, role, member, { teams, departments, leaders }),
    [user, role, member, teams, departments, leaders],
  )
  useEffect(() => {
    setScope(scope)
  }, [scope])
  return scope
}
