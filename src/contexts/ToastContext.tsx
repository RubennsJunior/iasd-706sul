import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn, uid } from '../utils/misc'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: string
  tone: ToastTone
  message: string
}

interface ToastApi {
  success(message: string): void
  error(message: string): void
  info(message: string): void
}

const ToastContext = createContext<ToastApi | null>(null)

const STYLES: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-royal-100 bg-white text-navy-900',
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = uid('toast')
    setItems((current) => [...current.slice(-3), { id, tone, message }])
    window.setTimeout(() => setItems((current) => current.filter((t) => t.id !== id)), 4000)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 safe-top lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-auto lg:items-end"
      >
        {items.map((toast) => {
          const Icon = ICONS[toast.tone]
          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                'anim-sheet pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-float',
                STYLES[toast.tone],
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0" />
              <span>{toast.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast precisa estar dentro de ToastProvider')
  return api
}

/** Mensagem amigável a partir de qualquer erro lançado por serviços. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
}
