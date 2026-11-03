import { dayMonth, weekdayShort } from '../../utils/date'
import { cn } from '../../utils/misc'

/** Quadro azul com o dia da semana e a data (Sáb / 07/11). */
export function DateChip({ date, className }: { date: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-[60px] shrink-0 flex-col items-center justify-center rounded-xl bg-navy-900 text-white',
        className,
      )}
    >
      <span className="text-xs">{weekdayShort(date)}</span>
      <span className="text-[15px] font-semibold leading-tight">{dayMonth(date)}</span>
    </span>
  )
}
