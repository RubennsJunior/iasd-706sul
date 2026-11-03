import { useSyncExternalStore } from 'react'
import { deleteApp, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { doc, onSnapshot, setDoc, waitForPendingWrites } from 'firebase/firestore'
import type { AppUser, Entity, NewEntity } from '../models'
import { FIREBASE_TENANT, cloudEnabled, emulatorHost, firebaseConfig, getDb, getFirebaseAuth, usingEmulator } from './firebase'

/**
 * Sessão do Firebase Authentication (só com a nuvem ligada). `undefined` = ainda não sabemos se há alguém
 * logado; `null` = ninguém; objeto = usuário logado (a sessão volta sozinha ao reabrir o app, até sem internet).
 */
export interface Session {
  uid: string
  email: string
}

let session: Session | null | undefined
/**
 * Quem acabou de entrar só tem acesso aos dados depois que o perfil dele está confirmado no servidor (as regras
 * do Firestore leem o perfil). Até lá as coleções esperam; sem ninguém logado não há o que esperar.
 */
let accessReady = true
let started = false
const listeners = new Set<() => void>()

export function startSession() {
  if (started || !cloudEnabled) return
  started = true
  onAuthStateChanged(getFirebaseAuth(), (user) => {
    session = user ? { uid: user.uid, email: user.email ?? '' } : null
    accessReady = !user
    listeners.forEach((listener) => listener())
  })
}

export const getSession = () => session

export function subscribeSession(listener: () => void) {
  startSession()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSession = () => useSyncExternalStore(subscribeSession, getSession)

export function setAccessReady(ready: boolean) {
  if (accessReady === ready) return
  accessReady = ready
  listeners.forEach((listener) => listener())
}

/**
 * Primeiro acesso do administrador: grava o perfil direto no Firestore, sem passar dos repositórios (que ainda
 * esperam o acesso ser confirmado — e é este perfil que o confirma). Só termina quando o servidor aceita.
 */
export function createFirstProfile(uid: string, data: NewEntity<AppUser>) {
  const now = new Date().toISOString()
  return setDoc(doc(getDb(), 'igrejas', FIREBASE_TENANT, 'users', uid), { ...data, id: uid, createdAt: now, updatedAt: now })
}

/** Aguarda o servidor aceitar tudo o que está pendente (ex.: o perfil recém-criado). */
export const settleWrites = () => waitForPendingWrites(getDb())

/** Executa `run` assim que a sessão for conhecida e o acesso de quem está logado estiver confirmado. */
export function whenSessionKnown(run: () => void) {
  const ok = () => session !== undefined && accessReady
  if (ok()) return run()
  const stop = subscribeSession(() => {
    if (!ok()) return
    stop()
    run()
  })
}

const accessListeners = new Set<() => void>()

/**
 * O que a pessoa logada pode ler mudou sem trocar de conta (o perfil foi criado, o perfil de acesso ou as permissões
 * foram alterados): os dados são lidos de novo, porque as regras do Firestore passam a liberar outras coleções.
 */
export const accessChanged = () => accessListeners.forEach((listener) => listener())

/** Avisa quando quem está logado muda (entrar, sair, trocar de conta) ou o acesso dele muda; a primeira resolução não conta. */
export function onSessionChange(callback: () => void) {
  accessListeners.add(callback)
  let last: string | null | undefined = session === undefined ? undefined : (session?.uid ?? null)
  const stop = subscribeSession(() => {
    if (session === undefined) return
    const uid = session?.uid ?? null
    if (last === undefined) {
      last = uid
      return
    }
    if (uid !== last) {
      last = uid
      callback()
    }
  })
  return () => {
    stop()
    accessListeners.delete(callback)
  }
}

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'Informe um e-mail válido.',
  'auth/missing-password': 'Informe a senha.',
  'auth/user-disabled': 'Este acesso foi desativado.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos ou use “Esqueci minha senha”.',
  'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
  'auth/email-already-in-use':
    'Já existe um acesso com este e-mail (talvez de um usuário que foi excluído). Use outro e-mail ou remova o acesso antigo no console do Firebase.',
  'auth/requires-recent-login': 'Por segurança, saia e entre de novo antes de trocar a senha.',
  'auth/operation-not-allowed': 'O login por e-mail e senha não está habilitado no Firebase Authentication.',
}

export function authMessage(error: unknown): string {
  const code = (error as { code?: string } | undefined)?.code ?? ''
  return MESSAGES[code] ?? `Não foi possível concluir (${code || 'erro desconhecido'}).`
}

export async function signIn(email: string, password: string) {
  try {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
  } catch (error) {
    throw new Error(authMessage(error))
  }
}

export const signOutNow = () => signOut(getFirebaseAuth())

/**
 * Cria o acesso (e-mail e senha) de outra pessoa sem deslogar quem está cadastrando: usa um segundo "app"
 * do Firebase só para isso. Devolve o uid, que passa a ser o `id` do perfil do usuário.
 */
export async function createLoginFor(email: string, password: string): Promise<string> {
  const secondary = initializeApp(firebaseConfig, `cadastro-${Date.now()}`)
  const auth = getAuth(secondary)
  if (usingEmulator) connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true })
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await signOut(auth)
    return user.uid
  } catch (error) {
    throw new Error(authMessage(error))
  } finally {
    await deleteApp(secondary)
  }
}

export async function changeMyPassword(newPassword: string) {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('Você não está logado.')
  try {
    await updatePassword(user, newPassword)
  } catch (error) {
    throw new Error(authMessage(error))
  }
}

export async function sendReset(email: string) {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim())
  } catch (error) {
    throw new Error(authMessage(error))
  }
}

/** Acompanha um único documento (o perfil e o cadastro de quem está logado), mesmo sem poder listar a coleção. */
export function watchDoc<T extends Entity>(
  collectionName: string,
  id: string,
  onData: (value: T | null) => void,
  onError: (code: string) => void,
) {
  return onSnapshot(
    doc(getDb(), 'igrejas', FIREBASE_TENANT, collectionName, id),
    (snapshot) => onData(snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as T) : null),
    (error) => onError(error.code),
  )
}
