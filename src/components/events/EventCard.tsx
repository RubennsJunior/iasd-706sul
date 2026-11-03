import { CalendarDays, ChevronRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ChurchEvent } from '../../models'
import { eventPhase } from '../../services'
import { formatDateShort, formatTime } from '../../utils/date'
import { Cover } from '../ui/Cover'
import { StatusBadge } from '../ui/Badge'

export function EventCard({ event }: { event: ChurchEvent }) {
  return (
    <Link
      to={`/eventos/${event.id}`}
      className="flex items-center gap-3.5 rounded-3xl bg-white p-3 shadow-card transition-shadow hover:shadow-float"
    >
      <Cover cover={event.cover} title={event.title} className="size-28 shrink-0 rounded-2xl sm:size-32" />
      <div className="min-w-0 flex-1 space-y-1">
        <StatusBadge kind="event" value={eventPhase(event)} />
        <h3 className="wrap-anywhere text-lg font-semibold leading-tight text-navy-900">{event.title}</h3>
        <p className="flex items-center gap-1.5 text-sm text-ink">
          <CalendarDays className="size-4 shrink-0 text-navy-800" />
          {formatDateShort(event.date)} • {formatTime(event.time)}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-ink">
          <MapPin className="size-4 shrink-0 text-navy-800" />
          <span className="wrap-anywhere">{event.location || 'Local a definir'}</span>
        </p>
        {event.description && <p className="text-sm text-muted">{event.description}</p>}
      </div>
      <ChevronRight className="size-5 shrink-0 text-royal-600" />
    </Link>
  )
}
