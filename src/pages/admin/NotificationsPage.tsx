import { useState } from 'react'
import {
  Bell,
  BellRing,
  CalendarCheck,
  CalendarDays,
  CheckCheck,
  HandHeart,
  Megaphone,
  Plus,
  Settings2,
  Trash2,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Switch } from '../../components/forms/Controls'
import { DevicePush } from '../../components/notifications/DevicePush'
import { Badge } from '../../components/ui/Badge'
import { Button, IconButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/Misc'
import { SegmentedTabs } from '../../components/ui/Tabs'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { useNotifications, useSettings } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import type { AppSettings, NotificationKind } from '../../models'
import { notificationsService, settingsService } from '../../services'
import { timeAgo } from '../../utils/date'
import { NOTIFICATION_KIND } from '../../utils/labels'
import { cn } from '../../utils/misc'

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  evento: CalendarDays,
  escala: CalendarCheck,
  oracao: HandHeart,
  aviso: Megaphone,
  sistema: Wrench,
}

const PREFERENCES: Array<{ key: 'notifyEvents' | 'notifyRosters' | 'notifyPrayers' | 'notifyNotices'; label: string; hint: string }> = [
  { key: 'notifyEvents', label: 'Eventos', hint: 'Avisar sobre cancelamentos e mudanças na agenda.' },
  { key: 'notifyRosters', label: 'Escalas', hint: 'Avisar os integrantes quando uma nova escala for criada.' },
  { key: 'notifyPrayers', label: 'Pedidos de oração', hint: 'Avisar quando houver novos pedidos de oração.' },
  { key: 'notifyNotices', label: 'Avisos gerais', hint: 'Comunicados enviados pela secretaria e pela liderança.' },
]


export function NotificationsPage() {
  const { user, can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { items } = useNotifications()
  const { settings } = useSettings()
  const [tab, setTab] = useState<'central' | 'preferencias'>('central')

  const canCreate = can('notificacoes', 'create')
  const canDelete = can('notificacoes', 'delete')
  const canConfigure = can('notificacoes', 'edit')

  const sorted = [...items].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  const unread = sorted.filter((n) => user && !n.readBy.includes(user.id)).length

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const remove = async (id: string, title: string) => {
    const ok = await confirm({ title: 'Excluir notificação?', message: `“${title}” será removida para todos.` })
    if (ok) await run(() => notificationsService.remove(id), 'Notificação excluída.')
  }

  const toggle = (key: keyof AppSettings, value: boolean) =>
    run(() => settingsService.save({ [key]: value }), 'Preferência salva.')

  return (
    <Page title="Notificações" subtitle="Configure as notificações do app" icon={Bell}>
      <div className="space-y-4">
        {canConfigure && (
          <SegmentedTabs<'central' | 'preferencias'>
            className="lg:max-w-md"
            value={tab}
            onChange={setTab}
            items={[
              { key: 'central', label: 'Central', icon: BellRing, count: unread },
              { key: 'preferencias', label: 'Preferências', icon: Settings2 },
            ]}
          />
        )}

        {tab === 'central' || !canConfigure ? (
          <>
            <DevicePush />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                {unread > 0 ? `${unread} não lida(s)` : 'Tudo em dia — nenhuma notificação pendente.'}
              </p>
              <div className="flex gap-2">
                {unread > 0 && user && (
                  <Button size="sm" variant="outline" icon={CheckCheck} onClick={() => run(() => notificationsService.markAllRead(user.id))}>
                    Marcar todas como lidas
                  </Button>
                )}
                {canCreate && (
                  <Button size="sm" icon={Plus} onClick={() => navigate('/notificacoes/nova')}>
                    Nova notificação
                  </Button>
                )}
              </div>
            </div>

            {sorted.length === 0 ? (
              <EmptyState icon={Bell} title="Nenhuma notificação" />
            ) : (
              <ul className="space-y-2.5">
                {sorted.map((n) => {
                  const Icon = KIND_ICONS[n.kind]
                  const isUnread = Boolean(user && !n.readBy.includes(user.id))
                  return (
                    <li key={n.id}>
                      <Card className={cn('flex items-start gap-3 p-3.5', isUnread && 'ring-2 ring-royal-100')}>
                        <button
                          type="button"
                          onClick={() => user && void notificationsService.markRead(n.id, user.id)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          aria-label={isUnread ? `Marcar “${n.title}” como lida` : n.title}
                        >
                          <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-navy-900 text-white">
                            <Icon className="size-5" />
                            {isUnread && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-red-500 ring-2 ring-white" />}
                          </span>
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className={cn('font-semibold text-navy-900', !isUnread && 'font-medium')}>{n.title}</span>
                              <Badge tone="info">{NOTIFICATION_KIND[n.kind]}</Badge>
                            </span>
                            <span className="mt-0.5 block text-sm text-ink">{n.body}</span>
                            <span className="mt-1 block text-xs text-muted">{n.createdAt ? timeAgo(n.createdAt) : ''}</span>
                          </span>
                        </button>
                        {canDelete && <IconButton icon={Trash2} label="Excluir notificação" tone="danger" onClick={() => remove(n.id, n.title)} />}
                      </Card>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        ) : (
          <Card className="divide-y divide-line">
            {PREFERENCES.map(({ key, label, hint }) => (
              <div key={key} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <p className="font-medium text-navy-900">{label}</p>
                  <p className="text-sm text-muted">{hint}</p>
                </div>
                <Switch checked={Boolean(settings?.[key])} onChange={(v) => void toggle(key, v)} label={label} />
              </div>
            ))}
          </Card>
        )}
      </div>

    </Page>
  )
}
