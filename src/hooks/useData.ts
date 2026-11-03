import { useCallback, useMemo } from 'react'
import type { Entity, ID, Member } from '../models'
import { repos } from '../repositories'
import { useCollection } from './useCollection'

export const useMembers = () => useCollection(repos.members)
export const useUsers = () => useCollection(repos.users)
export const useRoles = () => useCollection(repos.roles)
export const useDepartments = () => useCollection(repos.departments)
export const usePositions = () => useCollection(repos.positions)
export const useLeaders = () => useCollection(repos.leaders)
export const useTeams = () => useCollection(repos.teams)
export const useEvents = () => useCollection(repos.events)
export const useWorshipServices = () => useCollection(repos.services)
export const useRosters = () => useCollection(repos.rosters)
export const useReadings = () => useCollection(repos.readings)
export const useHymns = () => useCollection(repos.hymns)
export const usePrayers = () => useCollection(repos.prayers)
export const useMessages = () => useCollection(repos.messages)
export const useMaterials = () => useCollection(repos.materials)
export const useNotifications = () => useCollection(repos.notifications)
export const useContacts = () => useCollection(repos.contacts)
export const useActivity = () => useCollection(repos.activity)
export const useRequests = () => useCollection(repos.requests)

export function useChurch() {
  const { items, loading } = useCollection(repos.church)
  return { church: items[0], loading }
}

export function useSettings() {
  const { items, loading } = useCollection(repos.settings)
  return { settings: items[0], loading }
}

export function useById<T extends Entity>(items: T[]) {
  return useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
}

export const useDirectory = () => useCollection(repos.directory)

/**
 * Atalho para exibir o nome de um membro a partir do código. Quem não pode abrir o cadastro de membros
 * (visitante, perfil "Membro") ainda enxerga os nomes pelo diretório público.
 */
export function useMemberNames() {
  const { items } = useMembers()
  const { items: directory } = useDirectory()
  const byId = useById<Member>(items)
  const nameById = useMemo(() => new Map(directory.map((d) => [d.id, d.fullName])), [directory])
  const nameOf = useCallback(
    (id?: ID) => (id ? (byId.get(id)?.fullName ?? nameById.get(id) ?? '—') : '—'),
    [byId, nameById],
  )
  return { members: items, byId, nameOf }
}
