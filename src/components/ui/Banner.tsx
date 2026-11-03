import type { ReactNode } from 'react'
import { cn } from '../../utils/misc'

/** Faixa de destaque: ícone e texto em cima; ações embaixo no celular e à direita em telas maiores. */
export function Banner({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    // sm:flex-wrap: em colunas estreitas os botões descem para a linha de baixo em vez de vazar do cartão
    <section className={cn('rounded-2xl bg-royal-100/80 px-4 py-3.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3', className)}>
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-tight text-navy-900 sm:text-lg">{title}</p>
          {description && <p className="mt-0.5 text-sm text-ink">{description}</p>}
        </div>
      </div>
      {actions && <div className="mt-3 flex flex-wrap gap-2 sm:mt-0 sm:max-w-full sm:shrink-0">{actions}</div>}
    </section>
  )
}
