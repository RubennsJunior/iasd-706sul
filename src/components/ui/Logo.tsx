import { CHURCH_NAME } from '../../config'
import { cn } from '../../utils/misc'

/**
 * Marca simplificada (chamas sobre livro aberto) desenhada para o projeto.
 * Para usar o logotipo oficial, substitua este componente pela imagem aprovada pela igreja.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <path
        d="M32 3c5.5 7 8.5 11.5 8.5 17.5 0 5-3.8 8.5-8.5 8.5s-8.5-3.5-8.5-8.5c0-3.4 1.8-6.1 3.4-8.6.4 2.4 2 4 3.6 4 1.4-3.6 1.5-7.4 1.5-12.4Z"
        fill="currentColor"
      />
      <path
        d="M17.5 14c4 3.6 6.8 7.6 6.8 12.6 0 3.6-2 6-4.8 7.2-1.2-2.8-1.4-5.4-3.4-8-1.2-1.6-1.4-4.6 1.4-11.8Z"
        fill="currentColor"
        opacity=".85"
      />
      <path
        d="M46.5 14c-4 3.6-6.8 7.6-6.8 12.6 0 3.6 2 6 4.8 7.2 1.2-2.8 1.4-5.4 3.4-8 1.2-1.6 1.4-4.6-1.4-11.8Z"
        fill="currentColor"
        opacity=".85"
      />
      <path
        d="M4 40c9-3 19-2 28 4 9-6 19-7 28-4v15c-9-3-19-2-28 4-9-6-19-7-28-4V40Z"
        fill="currentColor"
      />
      <path d="M32 44v15" stroke="#0a2468" strokeWidth="1.6" opacity=".55" />
    </svg>
  )
}

export function LogoLockup({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 text-white', className)}>
      <LogoMark className={compact ? 'size-9' : 'size-11'} />
      <span className="h-9 w-px bg-white/35" aria-hidden />
      <span className={cn('font-medium leading-tight', compact ? 'text-lg' : 'text-xl sm:text-2xl')}>{CHURCH_NAME}</span>
    </div>
  )
}
