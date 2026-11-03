import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn, matchesQuery } from '../../utils/misc'
import type { Option } from '../../utils/labels'

export const controlClass = (error?: string) =>
  cn(
    'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-royal-500 focus:ring-2 focus:ring-royal-100 disabled:bg-slate-50',
    error ? 'border-red-400' : 'border-line',
  )

export function FieldWrapper({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-navy-900">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange(value: boolean): void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-royal-600' : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}

/** Lista de caixas de seleção com busca, para escolher vários itens (membros, por exemplo). */
export function CheckboxList({
  options,
  value,
  onChange,
  searchable = options.length > 8,
  emptyText = 'Nenhuma opção disponível.',
}: {
  options: Option[]
  value: string[]
  onChange(value: string[]): void
  searchable?: boolean
  emptyText?: string
}) {
  const [query, setQuery] = useState('')
  const listId = useId()
  const visible = options.filter((o) => matchesQuery(query, o.label))
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((v) => v !== key) : [...value, key])

  return (
    <div className="rounded-xl border border-line bg-white">
      {searchable && (
        <label className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Search className="size-4 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar…"
            aria-controls={listId}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <span className="text-xs text-muted">{value.length} selecionado(s)</span>
        </label>
      )}
      <ul id={listId} className="max-h-52 divide-y divide-line overflow-y-auto">
        {visible.length === 0 && <li className="px-3 py-3 text-sm text-muted">{emptyText}</li>}
        {visible.map((option) => (
          <li key={option.value}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-royal-50">
              <input
                type="checkbox"
                checked={value.includes(option.value)}
                onChange={() => toggle(option.value)}
                className="size-4 accent-navy-900"
              />
              {option.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
