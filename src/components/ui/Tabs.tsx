import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/misc'

export interface TabItem<K extends string = string> {
  key: K
  label: string
  icon?: LucideIcon
  to?: string
  end?: boolean
  count?: number
}

interface SegmentedTabsProps<K extends string> {
  items: TabItem<K>[]
  value?: K
  onChange?(key: K): void
  className?: string
}

const base =
  'flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-center text-xs font-medium leading-tight transition-colors sm:text-[13px] lg:flex-row lg:gap-2 lg:px-4 lg:text-sm'

/** Barra de abas em cartão, como nas telas de referência. Funciona com estado local ou com rotas. */
export function SegmentedTabs<K extends string>({ items, value, onChange, className }: SegmentedTabsProps<K>) {
  // Com muitas abas nenhuma é cortada: em telas estreitas quebram em linhas de três, nas largas ficam numa linha só.
  const many = items.length >= 5
  const itemClass = cn(
    base,
    many ? 'min-w-fit grow basis-[calc(33.333%-0.25rem)] whitespace-nowrap min-[560px]:basis-0' : 'min-w-0 flex-1',
  )
  return (
    <div role="tablist" className={cn('flex gap-1 rounded-3xl bg-white p-1.5 shadow-card', many && 'flex-wrap', className)}>
      {items.map(({ key, label, icon: Icon, to, end, count }) => {
        const content = (
          <>
            {Icon && <Icon className="size-5 shrink-0" />}
            <span>{label}</span>
            {count !== undefined && (
              <span className="hidden rounded-full bg-black/10 px-1.5 text-[11px] leading-5 lg:inline">{count}</span>
            )}
          </>
        )
        if (to) {
          return (
            <NavLink
              key={key}
              to={to}
              end={end}
              role="tab"
              className={({ isActive }) =>
                cn(itemClass, isActive ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-800 hover:bg-royal-50')
              }
            >
              {content}
            </NavLink>
          )
        }
        const active = key === value
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(key)}
            className={cn(itemClass, active ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-800 hover:bg-royal-50')}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
