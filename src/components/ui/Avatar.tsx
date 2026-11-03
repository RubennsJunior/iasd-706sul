import { cn, initials } from '../../utils/misc'

const PALETTE = [
  'from-navy-800 to-royal-600',
  'from-royal-600 to-sky-500',
  'from-navy-900 to-navy-700',
  'from-gold-500 to-amber-600',
  'from-emerald-600 to-teal-500',
  'from-violet-600 to-indigo-500',
]

const SIZES = {
  xs: 'size-7 text-[10px]',
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-14 text-lg',
}

export function Avatar({
  name,
  size = 'md',
  ring,
  className,
}: {
  name: string
  size?: keyof typeof SIZES
  ring?: boolean
  className?: string
}) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full bg-linear-to-br/srgb font-semibold text-white',
        PALETTE[hash % PALETTE.length],
        SIZES[size],
        ring && 'ring-2 ring-white/80',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
