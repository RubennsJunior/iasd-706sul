import type { HTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/misc'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-3xl bg-white shadow-card', className)} {...rest} />
}

interface SectionHeaderProps {
  title: string
  icon?: LucideIcon
  iconClassName?: string
  to?: string
  linkLabel?: string
  action?: ReactNode
}

export function SectionHeader({ title, icon: Icon, iconClassName, to, linkLabel, action }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2.5 text-lg font-semibold text-navy-900">
        {Icon && <Icon className={cn('size-6 text-navy-800', iconClassName)} />}
        {title}
      </h2>
      {action ??
        (to && (
          <Link
            to={to}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-royal-600 hover:underline"
          >
            {linkLabel ?? 'Ver tudo'}
            <ArrowRight className="size-4" />
          </Link>
        ))}
    </div>
  )
}
