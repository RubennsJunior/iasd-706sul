import { useState } from 'react'
import { CheckCheck, HandHeart, Plus, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/Misc'
import { SegmentedTabs } from '../../components/ui/Tabs'
import { useAuth } from '../../contexts/AuthContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { usePrayers } from '../../hooks/useData'
import type { PrayerKind } from '../../models'
import { prayersService } from '../../services'
import { formatDate } from '../../utils/date'

export function PrayerPage() {
  const { user, can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { items } = usePrayers()
  const [tab, setTab] = useState<PrayerKind>('pedido')

  const canCurate = can('liturgia', 'edit')
  const visible = items
    .filter((p) => p.kind === tab)
    .sort((a, b) => (a.status === b.status ? b.date.localeCompare(a.date) : a.status === 'aberto' ? -1 : 1))

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs<PrayerKind>
          className="flex-1 lg:max-w-md"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'pedido', label: 'Pedidos de oração', icon: HandHeart },
            { key: 'oracao', label: 'Orações', icon: CheckCheck },
          ]}
        />
        <Button icon={Plus} onClick={() => navigate('/liturgia/oracao/novo')}>
          Novo pedido
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={HandHeart} title="Nada por aqui ainda" description="Os pedidos e orações cadastrados aparecem nesta lista." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((prayer) => {
            const prayed = Boolean(user && prayer.prayedBy.includes(user.id))
            return (
              <li key={prayer.id}>
                <Card className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-navy-900">{prayer.title}</h3>
                    <StatusBadge kind="prayer" value={prayer.status} />
                  </div>
                  <p className="text-sm leading-relaxed text-ink">{prayer.text}</p>
                  <p className="text-xs text-muted">
                    {prayer.author} • {formatDate(prayer.date)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant={prayed ? 'secondary' : 'primary'}
                      icon={HandHeart}
                      onClick={() => user && run(() => prayersService.togglePrayed(prayer.id, user.id))}
                    >
                      {prayed ? 'Você orou' : 'Eu orei'} ({prayer.prayedBy.length})
                    </Button>
                    {canCurate && (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={prayer.status === 'atendido' ? RotateCcw : CheckCheck}
                        onClick={() =>
                          run(
                            () => prayersService.markAnswered(prayer.id, prayer.status !== 'atendido'),
                            prayer.status === 'atendido' ? 'Pedido reaberto.' : 'Pedido marcado como atendido.',
                          )
                        }
                      >
                        {prayer.status === 'atendido' ? 'Reabrir' : 'Marcar atendido'}
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

    </div>
  )
}
