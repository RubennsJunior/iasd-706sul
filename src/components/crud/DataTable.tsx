import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../utils/misc'
import { IconButton } from '../ui/Button'

export interface Column<T> {
  header: string
  cell(item: T): ReactNode
  /** Quando informado, a coluna pode ser ordenada. */
  sortValue?(item: T): string | number
  className?: string
}

interface DataTableProps<T> {
  items: T[]
  columns: Column<T>[]
  rowKey(item: T): string
  actions?(item: T): ReactNode
  pageSize?: number
  onRowClick?(item: T): void
}

export function DataTable<T>({ items, columns, rowKey, actions, pageSize = 10, onRowClick }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ index: number; dir: 1 | -1 } | null>(null)
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sort) return items
    const getter = columns[sort.index]?.sortValue
    if (!getter) return items
    return [...items].sort((a, b) => {
      const x = getter(a)
      const y = getter(b)
      const result = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')
      return result * sort.dir
    })
  }, [items, columns, sort])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages - 1)
  const rows = sorted.slice(current * pageSize, current * pageSize + pageSize)

  const toggleSort = (index: number) => {
    setSort((s) => (s?.index === index ? (s.dir === 1 ? { index, dir: -1 } : null) : { index, dir: 1 }))
    setPage(0)
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-royal-50 text-xs uppercase tracking-wide text-navy-800">
            <tr>
              {columns.map((column, index) => (
                <th key={column.header} className={cn('whitespace-nowrap px-4 py-3 font-semibold', column.className)}>
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(index)}
                      className="inline-flex items-center gap-1 uppercase hover:text-royal-600"
                    >
                      {column.header}
                      {sort?.index === index &&
                        (sort.dir === 1 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right font-semibold">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((item) => (
              <tr
                key={rowKey(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn('hover:bg-royal-50/60', onRowClick && 'cursor-pointer')}
              >
                {columns.map((column) => (
                  <td key={column.header} className={cn('px-4 py-3 align-middle text-ink', column.className)}>
                    {column.cell(item)}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-2 text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="inline-flex items-center gap-0.5">{actions(item)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm text-muted">
          <span>
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} de {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <IconButton icon={ChevronLeft} label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)} />
            <span className="px-1">
              {current + 1} / {pages}
            </span>
            <IconButton icon={ChevronRight} label="Próxima página" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} />
          </div>
        </div>
      )}
    </div>
  )
}
