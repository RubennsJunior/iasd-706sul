import { useEffect } from 'react'
import { CloudOff } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useCloudStatus } from '../lib/cloudStatus'
import type { CloudState } from '../lib/cloudStatus'
import { cn } from '../utils/misc'

export const CLOUD_LABEL: Record<CloudState, string> = {
  off: 'Somente neste dispositivo',
  connecting: 'Conectando à nuvem…',
  online: 'Sincronizado com a nuvem',
  cache: 'Sem internet — usando os dados guardados no aparelho',
  local: 'Nuvem indisponível — dados somente neste dispositivo',
}

const DOT: Record<CloudState, string> = {
  off: 'bg-slate-400',
  connecting: 'bg-gold-500 animate-pulse',
  online: 'bg-emerald-500',
  cache: 'bg-gold-500',
  local: 'bg-red-500',
}

export function CloudStatusDot({ state }: { state: CloudState }) {
  return <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', DOT[state])} />
}

/** Aviso fixo quando a nuvem está inacessível: ninguém grava dados achando que foram para o servidor. */
export function CloudBanner() {
  const { state, reason } = useCloudStatus()
  if (state !== 'local') return null
  return (
    <div role="status" className="flex items-start gap-2.5 bg-red-50 px-4 py-2.5 text-xs text-red-900">
      <CloudOff className="mt-0.5 size-4 shrink-0" />
      <p>
        <strong className="font-semibold">Modo local.</strong> {reason ?? CLOUD_LABEL.local}{' '}
        <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">
          Tentar novamente
        </button>
      </p>
    </div>
  )
}

/** Mostra um aviso quando o Firestore recusa uma gravação (ex.: regras de segurança). */
export function CloudNotices() {
  const toast = useToast()
  useEffect(() => {
    const onError = (event: Event) => toast.error(`Não foi possível salvar na nuvem. ${(event as CustomEvent<string>).detail}`)
    window.addEventListener('cloud:write-error', onError)
    return () => window.removeEventListener('cloud:write-error', onError)
  }, [toast])
  return null
}
