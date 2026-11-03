import { useRequests } from '../../hooks/useData'
import { pendingRequests } from '../../services'
import { cn } from '../../utils/misc'

/** Contador de solicitações de cadastro aguardando análise; some quando não há nenhuma. */
export function PendingBadge({ className }: { className?: string }) {
  const { items } = useRequests()
  const count = pendingRequests(items).length
  if (count === 0) return null
  return (
    <span
      aria-label={`${count} aguardando análise`}
      className={cn('grid min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-5 text-white', className)}
    >
      {count}
    </span>
  )
}
