import { useMemo } from 'react'
import { Clock, ListChecks, MapPin, Settings2, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/Misc'
import { useAuth } from '../../contexts/AuthContext'
import { useMemberNames, useWorshipServices } from '../../hooks/useData'
import { compareDateTime, dayMonth, formatDateShort, formatTime, todayISO, weekdayShort } from '../../utils/date'

export function WorshipSchedule() {
  const { can } = useAuth()
  const { items } = useWorshipServices()
  const { nameOf } = useMemberNames()
  const today = todayISO()

  const upcoming = useMemo(() => items.filter((s) => s.date >= today).sort(compareDateTime), [items, today])

  return (
    <div className="space-y-4">
      {can('cultos', 'edit') && (
        <div className="flex justify-end">
          <Link to="/cultos">
            <Button variant="outline" icon={Settings2}>
              Gerenciar cultos
            </Button>
          </Link>
        </div>
      )}
      {upcoming.length === 0 ? (
        <EmptyState icon={ListChecks} title="Nenhum culto programado" description="As próximas programações aparecem aqui." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {upcoming.map((service) => (
            <li key={service.id}>
              <Card className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-[60px] shrink-0 flex-col items-center justify-center rounded-xl bg-navy-900 text-white">
                    <span className="text-xs">{weekdayShort(service.date)}</span>
                    <span className="text-[15px] font-semibold leading-tight">{dayMonth(service.date)}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold leading-tight text-navy-900">{service.title}</h3>
                    {service.theme && <p className="text-sm italic text-royal-600">{service.theme}</p>}
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-ink">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-4 text-navy-800" />
                        {formatDateShort(service.date)} • {formatTime(service.time)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-4 text-navy-800" />
                        {service.location}
                      </span>
                    </p>
                    {service.leaderId && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink">
                        <UserRound className="size-4 text-navy-800" />
                        Dirigente: {nameOf(service.leaderId)}
                      </p>
                    )}
                  </div>
                  <Badge tone="info">{service.kind}</Badge>
                </div>

                {service.program.length > 0 && (
                  <ol className="mt-4 space-y-0 border-l-2 border-royal-100 pl-4">
                    {service.program.map((item) => (
                      <li key={item.id} className="relative py-1.5">
                        <span className="absolute -left-[21px] top-3 size-2.5 rounded-full bg-royal-600 ring-2 ring-white" />
                        <p className="text-sm">
                          <span className="font-semibold text-navy-900">{formatTime(item.time)}</span>
                          <span className="ml-2 text-ink">{item.title}</span>
                        </p>
                        {item.responsibleId && <p className="text-xs text-muted">{nameOf(item.responsibleId)}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
