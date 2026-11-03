import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/misc'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-navy-900 text-white shadow-sm hover:bg-navy-800 active:bg-navy-950',
  secondary: 'bg-royal-50 text-navy-900 hover:bg-royal-100',
  outline: 'border border-line bg-white text-navy-900 hover:bg-royal-50',
  ghost: 'text-royal-600 hover:bg-royal-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  gold: 'border-2 border-gold-500 bg-navy-950/70 text-white hover:bg-navy-950',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: LucideIcon
  trailingIcon?: LucideIcon
  loading?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  trailingIcon: TrailingIcon,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'px-3.5 py-1.5 text-sm' : 'px-5 py-2.5 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" />}
      {children}
      {TrailingIcon && <TrailingIcon className="size-4" />}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  tone?: 'default' | 'danger'
}

export function IconButton({ icon: Icon, label, tone = 'default', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'grid size-9 place-items-center rounded-full transition-colors disabled:opacity-50',
        tone === 'danger'
          ? 'text-red-600 hover:bg-red-50'
          : 'text-navy-800 hover:bg-royal-50',
        className,
      )}
      {...rest}
    >
      <Icon className="size-[18px]" />
    </button>
  )
}
