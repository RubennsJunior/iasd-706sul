import { useSyncExternalStore } from 'react'
import { cloudEnabled } from './firebase'

/**
 * `off`: nuvem desligada · `connecting`: aguardando a primeira resposta · `online`: sincronizado ·
 * `cache`: usando os dados guardados no aparelho, sem confirmação do servidor · `local`: nuvem
 * inacessível, dados só neste aparelho.
 */
export type CloudState = 'off' | 'connecting' | 'online' | 'cache' | 'local'

export interface CloudStatus {
  state: CloudState
  reason?: string
}

const perRepo = new Map<string, CloudStatus>()
const listeners = new Set<() => void>()
let status: CloudStatus = { state: cloudEnabled ? 'connecting' : 'off' }

function compute(): CloudStatus {
  if (!cloudEnabled) return { state: 'off' }
  const all = [...perRepo.values()]
  const local = all.find((s) => s.state === 'local')
  if (local) return local
  if (all.some((s) => s.state === 'online')) return { state: 'online' }
  const cache = all.find((s) => s.state === 'cache')
  return cache ?? { state: 'connecting' }
}

/** Cada coleção informa como está; o estado geral resume todas. */
export function reportRepoState(name: string, next: CloudStatus) {
  perRepo.set(name, next)
  const merged = compute()
  if (merged.state === status.state && merged.reason === status.reason) return
  status = merged
  listeners.forEach((listener) => listener())
}

export const getCloudStatus = () => status

export function subscribeCloudStatus(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCloudStatus(): CloudStatus {
  return useSyncExternalStore(subscribeCloudStatus, getCloudStatus)
}

const REASONS: Record<string, string> = {
  'permission-denied': 'As regras de segurança do Firestore bloqueiam o acesso. Publique o arquivo firestore.rules do projeto.',
  unauthenticated: 'O Firestore exige login para acessar os dados.',
  'not-found': 'O banco de dados do Firestore ainda não foi criado neste projeto do Firebase.',
  'resource-exhausted': 'A cota gratuita do Firestore foi esgotada.',
  timeout: 'Sem resposta da nuvem. Verifique a conexão com a internet.',
}

export function explainCloudError(error: unknown): string {
  const code = typeof error === 'string' ? error : ((error as { code?: string } | undefined)?.code ?? '')
  return REASONS[code.replace('firestore/', '')] ?? `Falha ao falar com a nuvem${code ? ` (${code})` : ''}.`
}

/** Avisa as telas (ver `CloudNotices`) que uma gravação não foi aceita pela nuvem. */
export function reportWriteError(error: unknown) {
  // numa gravação, "sem permissão" é o perfil de quem está logado (as regras já estão publicadas e a nuvem responde)
  const denied = (error as { code?: string } | undefined)?.code === 'permission-denied'
  const detail = denied ? 'Seu perfil não tem permissão para esta ação.' : explainCloudError(error)
  window.dispatchEvent(new CustomEvent('cloud:write-error', { detail }))
}
