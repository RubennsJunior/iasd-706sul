import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { BOOTSTRAP_ADMIN_EMAIL } from '../config'
import { cloudEnabled } from '../lib/firebase'
import { accessChanged, createFirstProfile, setAccessReady, settleWrites, signIn, signOutNow, useSession, watchDoc } from '../lib/cloudSession'
import type { ActionKey, AppUser, Member, ModuleKey, Role } from '../models'
import { effectivePermissions, fullMatrix, hasPermission } from '../models/permissions'
import { SESSION_KEY, prepareCloud, repos, storage } from '../repositories'
import { authenticate, purgeDemoUsers, resolveMember, setActor, syncDirectory } from '../services'
import { useCollection } from '../hooks/useCollection'

const ADMIN_ROLE = 'role-admin'

interface AuthValue {
  ready: boolean
  user: AppUser | null
  role: Role | null
  member: Member | null
  /** Recado para a tela de entrada (conta sem perfil, usuário inativo…). */
  message: string
  login(email: string, password: string): Promise<void>
  /** Troca de usuário sem senha — recurso de demonstração (só no modo local) para testar os perfis. */
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

/** Modo local (demonstração): usuários e senhas ficam no próprio aparelho. */
function LocalAuthProvider({ children }: { children: ReactNode }) {
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
  // não chegaram", nunca "todos foram excluídos" — sempre existe ao menos um administrador.
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
      message: '',
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

/**
 * Nuvem: o acesso é do Firebase Authentication (e-mail e senha). O perfil do usuário é o documento
 * `users/<uid>`, que diz o perfil de acesso e o status; as regras do Firestore usam esse mesmo documento.
 */
function CloudAuthProvider({ children }: { children: ReactNode }) {
  const session = useSession()
  const uid = session?.uid
  const email = session?.email ?? ''
  const [profile, setProfile] = useState<AppUser | null | undefined>(undefined)
  const [profileError, setProfileError] = useState('')
  const [ownMember, setOwnMember] = useState<Member | null>(null)
  const [message, setMessage] = useState('')
  const [bootstrapFailed, setBootstrapFailed] = useState(false)
  const { items: roles, loading: loadingRoles } = useCollection(repos.roles)
  const { items: members } = useCollection(repos.members)
  const creating = useRef('')
  const prepared = useRef('')

  const isBootstrap = email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()

  // perfil de quem está logado
  useEffect(() => {
    setProfile(undefined)
    setProfileError('')
    if (!uid) return
    return watchDoc<AppUser>('users', uid, setProfile, setProfileError)
  }, [uid])

  // cadastro de membro do próprio usuário (perfis sem acesso à lista de membros também enxergam o seu)
  const memberId = profile?.memberId
  useEffect(() => {
    setOwnMember(null)
    if (!memberId) return
    return watchDoc<Member>('members', memberId, setOwnMember, () => setOwnMember(null))
  }, [memberId])

  // Primeiro acesso do administrador: a conta do e-mail combinado ganha o perfil de administrador.
  useEffect(() => {
    if (!uid || profile !== null || !isBootstrap || creating.current === uid) return
    creating.current = uid
    setBootstrapFailed(false)
    void createFirstProfile(uid, { name: 'Administrador', email, phone: '', roleId: ADMIN_ROLE, status: 'ativo' })
      .catch(() => {
        creating.current = '' // numa nova tentativa de login o perfil é criado de novo
        setBootstrapFailed(true)
      })
  }, [uid, profile, isBootstrap, email])

  const loadingProfile = Boolean(uid) && profile === undefined && !profileError
  const waitingBootstrap = Boolean(uid) && profile === null && isBootstrap && !bootstrapFailed

  // As coleções só começam a ser lidas com o perfil confirmado no servidor (ele decide o que as regras liberam).
  useEffect(() => {
    if (!uid || loadingProfile || waitingBootstrap) return
    let alive = true
    void settleWrites()
      .catch(() => undefined)
      .then(() => alive && setAccessReady(true))
    return () => {
      alive = false
    }
  }, [uid, loadingProfile, waitingBootstrap])

  // Perfil de acesso ou permissões alterados com o app aberto: as coleções são lidas de novo.
  const accessKey = profile ? `${profile.id}|${profile.roleId}|${profile.status}|${JSON.stringify(profile.customPermissions ?? null)}` : ''
  const lastAccessKey = useRef('')
  useEffect(() => {
    const previous = lastAccessKey.current
    lastAccessKey.current = accessKey
    if (!accessKey || !previous || previous === accessKey) return // a primeira leitura já nasce com o acesso certo
    void settleWrites()
      .catch(() => undefined)
      .then(() => accessChanged())
  }, [accessKey])
  const usable = profile && profile.status === 'ativo' ? profile : null
  const user = usable
  const role = useMemo<Role | null>(() => {
    const found = roles.find((r) => r.id === user?.roleId)
    if (found) return found
    // Tenant novo: o administrador entra antes de os perfis existirem
    return user?.roleId === ADMIN_ROLE
      ? { id: ADMIN_ROLE, name: 'Administrador Geral', description: '', permissions: fullMatrix(), system: true }
      : null
  }, [roles, user])
  const member = useMemo(() => ownMember ?? resolveMember(user, members), [ownMember, user, members])

  // Conta sem acesso: explica na tela de entrada e sai.
  useEffect(() => {
    if (!uid || loadingProfile || waitingBootstrap) return
    let reason = ''
    if (bootstrapFailed) reason = 'Não foi possível criar o perfil de administrador. Verifique a conexão e se as regras do Firestore foram publicadas.'
    else if (profileError) reason = 'Não foi possível carregar o seu perfil. Verifique a conexão e se as regras do Firestore foram publicadas.'
    else if (profile === null) reason = 'Esta conta ainda não tem acesso ao sistema. Peça ao administrador para cadastrá-la.'
    else if (profile && profile.status !== 'ativo') reason = 'Este usuário está inativo ou bloqueado.'
    if (!reason) return
    setMessage(reason)
    void signOutNow()
  }, [uid, loadingProfile, waitingBootstrap, profile, profileError, bootstrapFailed])

  useEffect(() => {
    setActor(user?.name ?? 'Sistema')
  }, [user])

  // Administrador entrou: grava os dados de exemplo se a igreja ainda não tem nada, tira as contas de demonstração
  // antigas e acerta o diretório público de nomes.
  useEffect(() => {
    if (!user || user.roleId !== ADMIN_ROLE || prepared.current === user.id) return
    prepared.current = user.id
    void (async () => {
      await prepareCloud()
      await purgeDemoUsers(user.id)
      await syncDirectory()
    })().catch(() => (prepared.current = ''))
  }, [user])

  // quem tem acesso a "Membros" mantém o diretório em dia (importações, dados antigos)
  const canSeeMembers = Boolean(user) && hasPermission(effectivePermissions(user, role), 'membros', 'edit')
  const memberCount = members.length
  useEffect(() => {
    if (canSeeMembers && user?.roleId !== ADMIN_ROLE && memberCount > 0) void syncDirectory().catch(() => undefined)
  }, [canSeeMembers, user?.roleId, memberCount])

  // O perfil de acesso chega logo depois do login (as regras liberam a coleção só a quem tem perfil): sem esperar por ele os
  // botões e rotas veriam uma permissão vazia por um instante. Se o perfil sumiu, segue depois de alguns segundos.
  const roleReady = !user || user.roleId === ADMIN_ROLE || Boolean(user.customPermissions) || roles.some((r) => r.id === user.roleId)
  const [roleWaited, setRoleWaited] = useState(false)
  useEffect(() => {
    setRoleWaited(false)
    if (!user) return
    const timer = window.setTimeout(() => setRoleWaited(true), 8000)
    return () => window.clearTimeout(timer)
  }, [user?.id])

  const ready = session !== undefined && (!uid || (!loadingProfile && !waitingBootstrap && (!user || ((roleReady || roleWaited) && !loadingRoles))))

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      user,
      role,
      member,
      message,
      async login(emailInput, password) {
        setMessage('')
        await signIn(emailInput, password)
      },
      switchUser: () => undefined,
      logout() {
        setMessage('')
        void signOutNow()
      },
      can: (module, action = 'view') => hasPermission(effectivePermissions(user, role), module, action),
    }),
    [ready, user, role, member, message],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const AuthProvider = cloudEnabled ? CloudAuthProvider : LocalAuthProvider

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return value
}
