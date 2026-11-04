import { useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock,
  List,
  ListChecks,
  MapPin,
  Music,
  Package,
  UserPlus,
  UsersRound,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../components/ui/Badge'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { Card, SectionHeader } from '../components/ui/Card'
import { Cover } from '../components/ui/Cover'
import { ProgressBar, StatTile } from '../components/ui/Misc'
import { useAuth } from '../contexts/AuthContext'
import { errorMessage, useToast } from '../contexts/ToastContext'
import {
  useActivity,
  useEvents,
  useMembers,
  useRequests,
  useRosters,
  useScopedTeams,
  useUsers,
  useWorshipServices,
} from '../hooks/useData'
import { Page } from '../layouts/PageMeta'
import { eventPhase, pendingRequests, rosterProgress, rostersService, upcomingRostersFor } from '../services'
import {
  addDays,
  compareDateTime,
  dayMonth,
  formatDateShort,
  formatTime,
  timeAgo,
  todayISO,
  weekdayLong,
  weekdayShort,
} from '../utils/date'

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  evento: CalendarDays,
  escala: CalendarCheck,
  membro: UserPlus,
  equipe: UsersRound,
  liturgia: BookOpen,
  culto: ListChecks,
  patrimonio: Package,
}

function DateChip({ date, className = '' }: { date: string; className?: string }) {
  return (
    <span
      className={`flex size-[60px] shrink-0 flex-col items-center justify-center rounded-xl bg-navy-900 text-white ${className}`}
    >
      <span className="text-xs">{weekdayShort(date)}</span>
      <span className="text-[15px] font-semibold leading-tight">{dayMonth(date)}</span>
    </span>
  )
}

interface WeekItem {
  key: string
  date: string
  time: string
  title: string
  place: string
  to: string
  badge: ReactNode
}

export function HomePage() {
  const { member, can, inScope } = useAuth()
  const toast = useToast()
  const { items: events } = useEvents()
  const { items: rosters } = useRosters()
  const { items: services } = useWorshipServices()
  const { items: teams } = useScopedTeams()
  const { items: members } = useMembers()
  const { items: users } = useUsers()
  const { items: activity } = useActivity()
  const { items: requests } = useRequests()
  const today = todayISO()
  const pending = can('membros', 'create') ? pendingRequests(requests).length : 0

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((e) => {
          const phase = eventPhase(e, today)
          return phase !== 'cancelado' && phase !== 'realizado'
        })
        .sort(compareDateTime),
    [events, today],
  )
  const nextEvent = upcomingEvents[0]
  const myRosters = useMemo(() => (member ? upcomingRostersFor(rosters, member.id, today) : []), [rosters, member, today])
  const nextRoster = myRosters[0]
  const myAssignment = nextRoster?.assignments.find((a) => a.memberId === member?.id)
  const upcomingServices = useMemo(
    () => services.filter((s) => s.date >= today).sort(compareDateTime),
    [services, today],
  )
  const teamRosters = useMemo(
    () => rosters.filter((r) => r.date >= today && inScope('escalas', r)).sort(compareDateTime),
    [rosters, today, inScope],
  )

  const weekItems = useMemo<WeekItem[]>(() => {
    const end = addDays(today, 6)
    const items: WeekItem[] = []
    for (const event of upcomingEvents) {
      if (event.date > end) continue
      const mine = event.participants.find((p) => p.memberId === member?.id)
      items.push({
        key: `ev-${event.id}`,
        date: event.date,
        time: event.time,
        title: event.title,
        place: event.location,
        to: `/eventos/${event.id}`,
        badge: mine ? (
          <StatusBadge kind="participant" value={mine.status} />
        ) : (
          <StatusBadge kind="event" value={eventPhase(event, today)} />
        ),
      })
    }
    for (const roster of myRosters) {
      if (roster.date > end) continue
      const slot = roster.assignments.find((a) => a.memberId === member?.id)
      items.push({
        key: `ro-${roster.id}`,
        date: roster.date,
        time: roster.time,
        title: roster.title,
        place: roster.location,
        to: '/escalas?aba=minhas',
        badge: slot && <StatusBadge kind="assignment" value={slot.status} />,
      })
    }
    return items.sort(compareDateTime).slice(0, 6)
  }, [upcomingEvents, myRosters, member, today])

  const confirm = async () => {
    if (!nextRoster || !member) return
    try {
      await rostersService.respond(nextRoster.id, member.id, 'confirmado')
      toast.success('Presença confirmada. Obrigado!')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const quickActions: Array<{ label: string; to: string; icon: LucideIcon; show: boolean }> = [
    { label: 'Agendar Evento', to: '/eventos/novo', icon: CalendarPlus, show: can('eventos', 'create') },
    { label: 'Minhas Escalas', to: '/escalas?aba=minhas', icon: CalendarCheck, show: can('escalas') },
    { label: 'Liturgias', to: '/liturgia', icon: Music, show: can('liturgia') },
    { label: 'Equipes', to: '/equipes', icon: UsersRound, show: can('equipes') },
    { label: 'Mais', to: '/menu', icon: List, show: true },
  ]

  return (
    <Page title="Início" subtitle="Visão geral da igreja" variant="home">
      <div className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
        <div className="space-y-4 lg:col-span-2">
          {pending > 0 && (
            <Banner
              icon={
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-royal-600 text-white">
                  <UserPlus className="size-6" />
                </span>
              }
              title={`${pending} ${pending === 1 ? 'solicitação de cadastro aguardando' : 'solicitações de cadastro aguardando'} análise`}
              description="Pessoas que pediram para ser membros e escolheram equipes."
              actions={
                <Link to="/solicitacoes">
                  <Button size="sm" trailingIcon={ArrowRight}>
                    Analisar
                  </Button>
                </Link>
              }
            />
          )}
          <Card className="flex divide-x divide-line p-1.5">
            <StatTile icon={CalendarDays} label="Eventos" value={upcomingEvents.length} to="/eventos" />
            <StatTile icon={UsersRound} label="Equipes" value={teams.filter((t) => t.status === 'ativa').length} to="/equipes" />
            <StatTile icon={CheckCircle2} label="Minhas Escalas" value={myRosters.length} to="/escalas?aba=minhas" />
            <StatTile icon={ListChecks} label="Cultos" value={upcomingServices.length} to="/liturgia/cultos" />
          </Card>

          {nextEvent ? (
            <section className="relative isolate min-h-[210px] overflow-hidden rounded-3xl p-5 text-white shadow-card">
              <Cover cover={nextEvent.cover} photo={nextEvent.photo} title={nextEvent.title} showTitle={false} className="absolute inset-0 -z-20" />
              <div className="absolute inset-0 -z-10 bg-linear-to-r/srgb from-navy-950/95 via-navy-950/70 to-navy-950/10" />
              <p className="flex items-center gap-2.5 font-semibold text-white/95">
                <CalendarClock className="size-7 text-gold-400" strokeWidth={1.6} />
                Próximo Evento
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight">{nextEvent.title}</h2>
              <p className="mt-2 flex items-center gap-2 text-white/95">
                <CalendarDays className="size-5" />
                {formatDateShort(nextEvent.date)} • {formatTime(nextEvent.time)}
              </p>
              <p className="mt-1 flex items-center gap-2 text-white/95">
                <MapPin className="size-5" />
                {nextEvent.location}
              </p>
              <Link to={`/eventos/${nextEvent.id}`} className="mt-4 inline-block">
                <Button variant="gold" trailingIcon={ArrowRight} className="text-gold-100">
                  Ver detalhes
                </Button>
              </Link>
            </section>
          ) : (
            <Card className="p-5 text-sm text-muted">Nenhum evento próximo na agenda.</Card>
          )}

          <Card className="p-4 sm:p-5">
            <SectionHeader title="Minha Semana" icon={CalendarClock} to="/eventos" linkLabel="Ver agenda" />
            {weekItems.length === 0 ? (
              <p className="py-4 text-sm text-muted">Sem compromissos nos próximos 7 dias.</p>
            ) : (
              <ul className="divide-y divide-line">
                {weekItems.map((item) => (
                  <li key={item.key}>
                    <Link to={item.to} className="flex items-center gap-3 py-3">
                      <DateChip date={item.date} />
                      <span className="min-w-0 flex-1">
                        <span className="block wrap-anywhere text-[17px] font-semibold text-navy-900">{item.title}</span>
                        <span className="block wrap-anywhere text-sm text-ink">
                          {formatTime(item.time)} • {item.place}
                        </span>
                      </span>
                      {item.badge ?? <ChevronRight className="size-5 text-navy-900" />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <section>
            <SectionHeader title="Ações Rápidas" icon={Zap} iconClassName="fill-gold-400 text-gold-400" />
            <ul className="grid grid-cols-5 gap-2">
              {quickActions
                .filter((a) => a.show)
                .map(({ label, to, icon: Icon }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="flex h-full flex-col items-center gap-1.5 rounded-2xl bg-white px-1 py-3 text-center shadow-card transition-shadow hover:shadow-float"
                    >
                      <Icon className="size-7 text-navy-800" strokeWidth={1.7} />
                      <span className="text-[12px] font-medium leading-tight text-navy-900">{label}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>

          {nextRoster && myAssignment && (
            <Banner
              icon={
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-full text-white ${
                    myAssignment.status === 'confirmado' ? 'bg-emerald-600' : 'bg-royal-600'
                  }`}
                >
                  {myAssignment.status === 'confirmado' ? <CheckCircle2 className="size-7" /> : <Clock className="size-7" />}
                </span>
              }
              title={`Sua ${nextRoster.title}`}
              description={`${
                myAssignment.status === 'confirmado'
                  ? `Confirmada para ${weekdayLong(nextRoster.date).toLowerCase()} (${dayMonth(nextRoster.date)})`
                  : myAssignment.status === 'pendente'
                    ? `Aguardando sua confirmação — ${weekdayLong(nextRoster.date).toLowerCase()} (${dayMonth(nextRoster.date)})`
                    : 'Você recusou esta escala'
              } • ${myAssignment.role}`}
              actions={
                <>
                  {myAssignment.status === 'pendente' && (
                    <Button size="sm" variant="secondary" onClick={confirm}>
                      Confirmar
                    </Button>
                  )}
                  <Link to="/escalas?aba=minhas">
                    <Button size="sm" trailingIcon={ArrowRight}>
                      Ver Escala
                    </Button>
                  </Link>
                </>
              }
            />
          )}

          {can('membros') && (
            <Card className="p-4">
              <SectionHeader title="Visão geral" icon={UsersRound} />
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['Membros', members.filter((m) => m.status === 'ativo').length, '/membros'],
                  ['Usuários', users.length, '/usuarios'],
                  ['Equipes', teams.length, '/equipes'],
                ].map(([label, value, to]) => (
                  <Link key={label} to={to as string} className="rounded-2xl bg-royal-50 px-2 py-3 hover:bg-royal-100">
                    <dd className="text-2xl font-bold text-navy-900">{value}</dd>
                    <dt className="text-xs text-ink">{label}</dt>
                  </Link>
                ))}
              </dl>
            </Card>
          )}

          <Card className="p-4">
            <SectionHeader title="Próximos cultos" icon={ListChecks} to="/liturgia/cultos" linkLabel="Programação" />
            {upcomingServices.length === 0 ? (
              <p className="text-sm text-muted">Nenhum culto programado.</p>
            ) : (
              <ul className="space-y-3">
                {upcomingServices.slice(0, 4).map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <DateChip date={s.date} className="size-12 text-[11px]" />
                    <span className="min-w-0">
                      <span className="block wrap-anywhere text-sm font-semibold text-navy-900">{s.title}</span>
                      <span className="block wrap-anywhere text-xs text-muted">
                        {formatTime(s.time)} • {s.location}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {can('escalas') && teamRosters.length > 0 && (
            <Card className="p-4">
              <SectionHeader title="Próximas escalas" icon={CalendarCheck} to="/escalas" linkLabel="Ver todas" />
              <ul className="space-y-3.5">
                {teamRosters.slice(0, 4).map((r) => {
                  const progress = rosterProgress(r)
                  const percent = progress.total ? (progress.confirmed / progress.total) * 100 : 0
                  return (
                    <li key={r.id}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="wrap-anywhere font-semibold text-navy-900">{r.title}</span>
                        <span className="shrink-0 text-xs text-muted">{dayMonth(r.date)}</span>
                      </div>
                      <div className="mt-1.5">
                        <ProgressBar value={percent} tone={progress.complete ? 'success' : 'royal'} />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {progress.confirmed}/{progress.total} confirmados
                      </p>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <Card className="p-4">
            <SectionHeader title="Atividades recentes" icon={Activity} />
            {activity.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma atividade registrada ainda.</p>
            ) : (
              <ul className="space-y-3">
                {[...activity]
                  .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
                  .slice(0, 6)
                  .map((log) => {
                    const Icon = ACTIVITY_ICONS[log.kind] ?? Activity
                    return (
                      <li key={log.id} className="flex items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-royal-50 text-royal-600">
                          <Icon className="size-[18px]" />
                        </span>
                        <span className="min-w-0 text-sm">
                          <span className="block text-ink">{log.message}</span>
                          <span className="block text-xs text-muted">
                            {log.actor} • {log.createdAt ? timeAgo(log.createdAt) : ''}
                          </span>
                        </span>
                      </li>
                    )
                  })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Page>
  )
}
