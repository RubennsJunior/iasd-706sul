import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, ChevronRight, Info, Music } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { useHymns, useMessages, useReadings, useWorshipServices } from '../../hooks/useData'
import { readingFor } from '../../services'
import { dayMonth, formatDateMedium, todayISO, weekdayShort } from '../../utils/date'
import { HymnModal, MessageModal, ReadingModal } from './modals'
import type { Hymn, Reading } from '../../models'

function dayOfYear(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000)
}

export function LiturgyToday() {
  const { items: readings } = useReadings()
  const { items: hymns } = useHymns()
  const { items: messages } = useMessages()
  const { items: services } = useWorshipServices()
  const today = todayISO()
  const [reading, setReading] = useState<Reading | null>(null)
  const [hymn, setHymn] = useState<Hymn | null>(null)
  const [messageOpen, setMessageOpen] = useState(false)

  const todays = readingFor(readings, today)
  const hymnOfDay = hymns.length ? hymns[dayOfYear(today) % hymns.length] : undefined
  const weekMessage = useMemo(
    () => [...messages].filter((m) => m.kind === 'mensagem').sort((a, b) => b.date.localeCompare(a.date))[0],
    [messages],
  )
  const nextService = (kind: string) =>
    services.filter((s) => s.kind === kind && s.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]

  const week = [
    todays && { key: 'leitura', date: todays.date, title: 'Leitura Bíblica', subtitle: todays.reference, onOpen: () => setReading(todays) },
    ...[
      ['Culto Divino', 'Mensagem'],
      ['Reunião de Oração', 'Oração'],
    ].map(([kind, label]) => {
      const service = nextService(kind)
      return service && { key: kind, date: service.date, title: label, subtitle: service.theme || service.title, onOpen: undefined }
    }),
  ].filter(Boolean) as Array<{ key: string; date: string; title: string; subtitle: string; onOpen?: () => void }>

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
      <div className="space-y-4">
        {todays ? (
          <button type="button" onClick={() => setReading(todays)} className="block w-full text-left">
            <Card className="flex items-center gap-4 p-3.5 transition-shadow hover:shadow-float">
              <div
                aria-hidden
                className="grid size-28 shrink-0 place-items-center rounded-2xl text-white sm:size-36"
                style={{
                  background:
                    'radial-gradient(circle at 30% 20%, #f5d27a 0%, transparent 50%), linear-gradient(160deg, #3b2a14, #7a5524 55%, #2a1a09)',
                }}
              >
                <BookOpen className="size-12 opacity-90 sm:size-16" strokeWidth={1.3} />
              </div>
              <div className="min-w-0 flex-1">
                <Badge tone="info">{todays.date === today ? 'Hoje' : 'Em destaque'}</Badge>
                <p className="mt-1 text-lg font-bold leading-tight text-navy-900 sm:text-xl">{formatDateMedium(todays.date)}</p>
                <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-royal-600">
                  <BookOpen className="size-5" /> Leitura Bíblica
                </p>
                <p className="text-lg font-semibold text-navy-900">{todays.reference}</p>
                <p className="mt-1 font-script text-[15px] italic leading-snug text-ink">“{todays.text}”</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-royal-600" />
            </Card>
          </button>
        ) : (
          <Card className="p-5 text-sm text-muted">Nenhuma leitura cadastrada.</Card>
        )}

        <Card className="p-4">
          <SectionHeader title="Liturgia da Semana" icon={CalendarDays} to="/liturgia/calendario" linkLabel="Ver calendário" />
          {week.length === 0 ? (
            <p className="py-2 text-sm text-muted">Nada programado para esta semana.</p>
          ) : (
            <ul className="divide-y divide-line">
              {week.map((row) => {
                const content = (
                  <>
                    <span className="flex size-[60px] shrink-0 flex-col items-center justify-center rounded-xl bg-navy-900 text-white">
                      <span className="text-xs">{weekdayShort(row.date)}</span>
                      <span className="text-[15px] font-semibold leading-tight">{dayMonth(row.date)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-semibold text-navy-900">{row.title}</span>
                      <span className="block wrap-anywhere text-ink">{row.subtitle}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-navy-900" />
                  </>
                )
                return (
                  <li key={row.key}>
                    {row.onOpen ? (
                      <button type="button" onClick={row.onOpen} className="flex w-full items-center gap-3 py-3 text-left">
                        {content}
                      </button>
                    ) : (
                      <Link to="/liturgia/cultos" className="flex items-center gap-3 py-3">
                        {content}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <section>
          <SectionHeader title="Hinos" icon={Music} to="/liturgia/hinos" linkLabel="Ver todos" />
          {hymnOfDay && (
            <button type="button" onClick={() => setHymn(hymnOfDay)} className="block w-full text-left">
              <Card className="flex items-center gap-4 p-2.5 transition-shadow hover:shadow-float">
                <span className="grid h-20 w-28 shrink-0 place-items-center rounded-xl bg-linear-to-br/srgb from-navy-950 to-royal-600 text-white">
                  <Music className="size-9" strokeWidth={1.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold text-navy-900">Hino do Dia</span>
                  <span className="block wrap-anywhere text-ink">{hymnOfDay.title}</span>
                </span>
                <span className="mr-2 grid size-12 place-items-center rounded-full bg-navy-900 text-white" aria-hidden>
                  <BookOpen className="size-5" />
                </span>
              </Card>
            </button>
          )}
        </section>

        {weekMessage && (
          <Banner
            icon={<Info className="size-8 shrink-0 text-royal-600" />}
            title="Mensagem da Semana"
            description={weekMessage.title}
            actions={
              <Button size="sm" trailingIcon={ArrowRight} onClick={() => setMessageOpen(true)}>
                Ler Mensagem
              </Button>
            }
          />
        )}
      </div>

      <ReadingModal reading={reading} onClose={() => setReading(null)} />
      <HymnModal hymn={hymn} onClose={() => setHymn(null)} />
      <MessageModal message={messageOpen ? weekMessage ?? null : null} onClose={() => setMessageOpen(false)} />
    </div>
  )
}
