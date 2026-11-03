import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Filter, ChevronDown, Inbox, Plus, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/misc'
import type { Option } from '../../utils/labels'
import { Select } from '../forms/Select'
import { Button } from './Button'

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-white px-6 py-12 text-center shadow-card">
      <span className="grid size-14 place-items-center rounded-full bg-royal-50 text-royal-600">
        <Icon className="size-7" />
      </span>
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ProgressBar({ value, tone = 'royal' }: { value: number; tone?: 'royal' | 'success' | 'gold' }) {
  const color = { royal: 'bg-royal-600', success: 'bg-emerald-500', gold: 'bg-gold-500' }[tone]
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-royal-100"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

export function StatTile({
  icon: Icon,
  label,
  value,
  to,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  to?: string
  hint?: string
}) {
  const body = (
    <>
      <Icon className="size-8 text-navy-800" strokeWidth={1.8} />
      <span className="flex min-h-[2.4em] items-center text-[13px] leading-tight text-ink">{label}</span>
      <span className="mt-auto text-2xl font-bold leading-none text-navy-900">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </>
  )
  const classes = 'flex flex-1 flex-col items-center gap-1.5 px-2 py-4 text-center'
  return to ? (
    <Link to={to} className={cn(classes, 'rounded-2xl transition-colors hover:bg-royal-50')}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  )
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  children,
  className,
}: {
  value: string
  onChange(value: string): void
  placeholder: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-white px-4 py-2.5 shadow-sm focus-within:border-royal-500">
        <Search className="size-5 shrink-0 text-navy-800" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        {value && (
          <button type="button" aria-label="Limpar busca" onClick={() => onChange('')} className="text-muted">
            <X className="size-4" />
          </button>
        )}
      </label>
      {children}
    </div>
  )
}

export interface FilterDef {
  key: string
  label: string
  options: Option[]
}

/** Botão "Filtros" com painel de seleção; cada filtro tem a opção "Todos". */
export function FilterMenu({
  filters,
  values,
  onChange,
}: {
  filters: FilterDef[]
  values: Record<string, string>
  onChange(key: string, value: string): void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = filters.filter((f) => values[f.key]).length

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element
      // a lista suspensa dos filtros é desenhada fora deste painel
      if (!ref.current?.contains(target) && !target.closest('[data-select-popup]')) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (filters.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-navy-900 shadow-sm hover:bg-royal-50"
      >
        <Filter className="size-4 fill-navy-900" />
        Filtros
        {active > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-navy-900 text-[11px] text-white">
            {active}
          </span>
        )}
        <ChevronDown className="size-4" />
      </button>
      {open && (
        <div className="anim-fade absolute right-0 z-30 mt-2 w-72 space-y-3 rounded-3xl border border-line bg-white p-4 shadow-float">
          {filters.map((filter) => (
            <div key={filter.key} className="text-sm">
              <span className="mb-1 block font-medium text-navy-900">{filter.label}</span>
              <Select
                aria-label={filter.label}
                value={values[filter.key] ?? ''}
                onChange={(value) => onChange(filter.key, value)}
                options={filter.options}
                emptyOption="Todos"
              />
            </div>
          ))}
          {active > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => filters.forEach((f) => onChange(f.key, ''))}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Botão flutuante no celular; no computador o botão fica na barra de ferramentas. */
export function Fab({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-24 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-navy-900 px-5 py-3.5 text-sm font-semibold text-white shadow-float transition-transform active:scale-95 lg:hidden"
    >
      <Plus className="size-5" />
      {label}
    </button>
  )
}
