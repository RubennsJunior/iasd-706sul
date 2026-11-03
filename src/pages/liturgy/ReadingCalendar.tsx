import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useReadings } from '../../hooks/useData'
import type { Reading } from '../../models'
import { formatMonthYear, monthKey, parseISODate, todayISO } from '../../utils/date'
import { cn } from '../../utils/misc'
import { ReadingModal } from './modals'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function shiftMonth(key: string, delta: number) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function ReadingCalendar() {
  const { items: readings } = useReadings()
  const today = todayISO()
  const [month, setMonth] = useState(monthKey(today))
  const [selected, setSelected] = useState<Reading | null>(null)

  const byDate = useMemo(() => new Map(readings.map((r) => [r.date, r])), [readings])

  const cells = useMemo(() => {
    const first = parseISODate(`${month}-01`)
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    return [
      ...Array.from({ length: first.getDay() }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
    ]
  }, [month])

  const monthReadings = readings.filter((r) => r.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <IconButton icon={ChevronLeft} label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))} />
          <h2 className="text-lg font-semibold capitalize text-navy-900">{formatMonthYear(month)}</h2>
          <IconButton icon={ChevronRight} label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))} />
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, index) => {
            if (!date) return <span key={`empty-${index}`} />
            const reading = byDate.get(date)
            return (
              <button
                key={date}
                type="button"
                disabled={!reading}
                onClick={() => reading && setSelected(reading)}
                aria-label={reading ? `${date.slice(8)} — ${reading.reference}` : date.slice(8)}
                className={cn(
                  'relative aspect-square rounded-xl text-sm transition-colors',
                  reading ? 'bg-royal-50 font-semibold text-navy-900 hover:bg-royal-100' : 'text-muted/60',
                  date === today && 'ring-2 ring-gold-500',
                )}
              >
                {Number(date.slice(8))}
                {reading && <span className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-royal-600" />}
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-lg font-semibold text-navy-900">Leituras do mês</h2>
        {monthReadings.length === 0 ? (
          <p className="py-3 text-sm text-muted">Nenhuma leitura cadastrada neste mês.</p>
        ) : (
          <ul className="divide-y divide-line">
            {monthReadings.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setSelected(r)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <span
                    className={cn(
                      'grid size-11 shrink-0 place-items-center rounded-xl text-sm font-semibold',
                      r.date === today ? 'bg-gold-500 text-white' : 'bg-navy-900 text-white',
                    )}
                  >
                    {r.date.slice(8)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-navy-900">{r.reference}</span>
                    <span className="block wrap-anywhere text-sm text-muted">{r.theme}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ReadingModal reading={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
