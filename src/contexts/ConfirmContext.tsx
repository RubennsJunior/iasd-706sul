import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<Confirm>((next) => {
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (answer: boolean) => {
    resolver.current?.(answer)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={options !== null}
        onClose={() => close(false)}
        title={options?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>
              {options?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button
              variant={options?.tone === 'primary' ? 'primary' : 'danger'}
              onClick={() => close(true)}
              autoFocus
            >
              {options?.confirmLabel ?? 'Excluir'}
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          {options?.tone !== 'primary' && (
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="size-5" />
            </span>
          )}
          <div className="text-sm leading-relaxed text-muted">{options?.message}</div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm precisa estar dentro de ConfirmProvider')
  return confirm
}
