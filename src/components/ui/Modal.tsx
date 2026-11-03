import { useEffect, useId } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/misc'
import { IconButton } from './Button'

interface ModalProps {
  open: boolean
  onClose(): void
  title: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  footer?: ReactNode
}

const SIZES = { sm: 'lg:max-w-md', md: 'lg:max-w-2xl', lg: 'lg:max-w-4xl' }

let openCount = 0

/** Folha inferior no celular e janela centralizada no computador. */
export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    openCount += 1
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      openCount -= 1
      if (openCount === 0) document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6">
      <div className="anim-fade absolute inset-0 bg-navy-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-float lg:rounded-3xl',
          SIZES[size],
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-navy-900">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Fechar" onClick={onClose} className="-mr-2 -mt-1" />
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3 safe-bottom sm:flex-row sm:justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
