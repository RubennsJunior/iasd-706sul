import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/misc'
import {
  ACTIVE_STATUS,
  ASSET_CATEGORY,
  ASSET_CONDITION,
  ASSIGNMENT_STATUS,
  EVENT_PHASE,
  MEMBER_STATUS,
  PARTICIPANT_STATUS,
  PRAYER_STATUS,
  REQUEST_STATUS,
  USER_STATUS,
} from '../../utils/labels'

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'purple' | 'neutral' | 'gold'

const TONES: Record<Tone, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  info: 'bg-royal-100 text-royal-600',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  purple: 'bg-violet-100 text-violet-700',
  neutral: 'bg-slate-100 text-slate-600',
  gold: 'bg-gold-100 text-gold-600',
}

interface BadgeProps {
  tone?: Tone
  icon?: LucideIcon
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', icon: Icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  )
}

type StatusKind = 'event' | 'member' | 'user' | 'active' | 'assignment' | 'participant' | 'prayer' | 'request' | 'assetCondition' | 'assetCategory'

const STATUS_MAP: Record<StatusKind, Record<string, { label: string; tone: Tone }>> = {
  event: {
    'em-breve': { label: EVENT_PHASE['em-breve'], tone: 'info' },
    planejado: { label: EVENT_PHASE.planejado, tone: 'info' },
    confirmado: { label: EVENT_PHASE.confirmado, tone: 'success' },
    realizado: { label: EVENT_PHASE.realizado, tone: 'neutral' },
    cancelado: { label: EVENT_PHASE.cancelado, tone: 'purple' },
  },
  member: {
    ativo: { label: MEMBER_STATUS.ativo, tone: 'success' },
    inativo: { label: MEMBER_STATUS.inativo, tone: 'neutral' },
    afastado: { label: MEMBER_STATUS.afastado, tone: 'warning' },
    visitante: { label: MEMBER_STATUS.visitante, tone: 'info' },
  },
  user: {
    ativo: { label: USER_STATUS.ativo, tone: 'success' },
    inativo: { label: USER_STATUS.inativo, tone: 'neutral' },
    bloqueado: { label: USER_STATUS.bloqueado, tone: 'danger' },
  },
  active: {
    ativa: { label: ACTIVE_STATUS.ativa, tone: 'success' },
    inativa: { label: ACTIVE_STATUS.inativa, tone: 'neutral' },
  },
  assignment: {
    confirmado: { label: ASSIGNMENT_STATUS.confirmado, tone: 'success' },
    pendente: { label: ASSIGNMENT_STATUS.pendente, tone: 'info' },
    recusado: { label: ASSIGNMENT_STATUS.recusado, tone: 'danger' },
  },
  participant: {
    inscrito: { label: PARTICIPANT_STATUS.inscrito, tone: 'info' },
    confirmado: { label: PARTICIPANT_STATUS.confirmado, tone: 'success' },
    presente: { label: PARTICIPANT_STATUS.presente, tone: 'success' },
    ausente: { label: PARTICIPANT_STATUS.ausente, tone: 'danger' },
  },
  request: {
    pendente: { label: REQUEST_STATUS.pendente, tone: 'warning' },
    aprovada: { label: REQUEST_STATUS.aprovada, tone: 'success' },
    recusada: { label: REQUEST_STATUS.recusada, tone: 'danger' },
  },
  prayer: {
    aberto: { label: PRAYER_STATUS.aberto, tone: 'info' },
    atendido: { label: PRAYER_STATUS.atendido, tone: 'success' },
  },
  assetCondition: {
    otimo: { label: ASSET_CONDITION.otimo, tone: 'success' },
    bom: { label: ASSET_CONDITION.bom, tone: 'info' },
    regular: { label: ASSET_CONDITION.regular, tone: 'warning' },
    ruim: { label: ASSET_CONDITION.ruim, tone: 'danger' },
    inativo: { label: ASSET_CONDITION.inativo, tone: 'neutral' },
  },
  assetCategory: {
    movel: { label: ASSET_CATEGORY.movel, tone: 'info' },
    imovel: { label: ASSET_CATEGORY.imovel, tone: 'gold' },
    equipamento: { label: ASSET_CATEGORY.equipamento, tone: 'purple' },
    veiculo: { label: ASSET_CATEGORY.veiculo, tone: 'warning' },
    outro: { label: ASSET_CATEGORY.outro, tone: 'neutral' },
  },
}

export function StatusBadge({ kind, value, icon }: { kind: StatusKind; value: string; icon?: LucideIcon }) {
  const entry = STATUS_MAP[kind][value] ?? { label: value, tone: 'neutral' as Tone }
  return (
    <Badge tone={entry.tone} icon={icon}>
      {entry.label}
    </Badge>
  )
}
