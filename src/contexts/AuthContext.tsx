import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ActionKey, AppUser, Member, ModuleKey, Role } from '../models'
import { effectivePermissions, hasPermission } from '../models/permissions'
import { SESSION_KEY, repos, storage } from '../repositories'
import { authenticate, resolveMember, setActor } from '../services'
import { useCollection } from '../hooks/useCollection'

interface AuthValue {
  ready: boolean
  user: AppUser | null
  role: Role | null
  member: Member | null
  login(email: string, password: string): Promise<void>
  /** Troca de usuário sem senha — recurso de demonstração para testar os perfis. */
  switchUser(userId: string): void
  logout(): void
  can(module: ModuleKey, action?: ActionKey): boolean
}

const AuthContext = createContext<AuthValue | null>(null)

function readSession(): string | null {
  const raw = storage.get(SESSION_KEY)
  if (!raw) return null
  try {
    return (JSON.parse(raw) as { userId?: string }).userId ?? null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(readSession)
  const { items: users, loading: loadingUsers } = useCollection(repos.users)
  const { items: roles, loading: loadingRoles } = useCollection(repos.roles)
  const { items: members } = useCollection(repos.members)

  const user = useMemo(() => users.find((u) => u.id === userId) ?? null, [users, userId])
  const role = useMemo(() => roles.find((r) => r.id === user?.roleId) ?? null, [roles, user])
  const member = useMemo(() => resolveMember(user, members), [members, user])
  const ready = !loadingUsers && !loadingRoles

  const persist = useCallback((id: string | null) => {
    setUserId(id)
    if (id) storage.set(SESSION_KEY, JSON.stringify({ userId: id }))
    else storage.remove(SESSION_KEY)
  }, [])

  // Sessão inválida: usuário excluído, inativo ou bloqueado. Lista de usuários vazia significa "dados ainda
  // não chegaram" (nuvem), nunca "todos foram excluídos" — sempre existe ao menos um administrador.
  useEffect(() => {
    if (ready && userId && users.length > 0 && (!user || user.status !== 'ativo')) persist(null)
  }, [ready, userId, user, users.length, persist])

  useEffect(() => {
    setActor(user?.name ?? 'Sistema')
  }, [user])

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      user,
      role,
      member,
      async login(email, password) {
        const found = await authenticate(email, password)
        persist(found.id)
      },
      switchUser: (id) => persist(id),
      logout: () => persist(null),
      can: (module, action = 'view') => hasPermission(effectivePermissions(user, role), module, action),
    }),
    [ready, user, role, member, persist],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return value
}
