import { CHURCH_NAME } from '../../config'
import { cn } from '../../utils/misc'
import logoMask from './logo-mask.png'

/**
 * Logotipo da IASD (chama, Bíblia e cruz). A imagem (`logo-mask.png`, gerada por `npm run icons` a partir de
 * `assets/logo-iasd.jpg`) é só o formato do emblema: a tela o pinta com a cor do texto, então ele aparece branco nos
 * cabeçalhos azul-marinho e azul nos fundos claros, sempre com o desenho original.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0 bg-current', className)}
      style={{
        WebkitMaskImage: `url(${logoMask})`,
        maskImage: `url(${logoMask})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  )
}

export function LogoLockup({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 text-white', className)}>
      <LogoMark className={compact ? 'size-10' : 'size-12'} />
      <span className="h-9 w-px bg-white/35" aria-hidden />
      <span className={cn('font-medium leading-tight', compact ? 'text-lg' : 'text-xl sm:text-2xl')}>{CHURCH_NAME}</span>
    </div>
  )
}
