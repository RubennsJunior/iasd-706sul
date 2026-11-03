import { useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  CalendarCheck,
  CalendarDays,
  Cake,
  ChartColumn,
  Download,
  ListChecks,
  UserCheck,
  UsersRound,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { ProgressBar } from '../../components/ui/Misc'
import { useToast } from '../../contexts/ToastContext'
import { useEvents, useMembers, useScopedRosters, useScopedTeams, useUsers, useWorshipServices, useMemberNames } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import { eventPhase } from '../../services'
import { attendanceRate, eventsByPhase, membersByStatus, rosterResponses, teamsBySize, upcomingBirthdays } from '../../services/reports'
import { dayMonth, formatDate, formatDateShort, formatTime, todayISO } from '../../utils/date'
import { EVENT_PHASE, MEMBER_STATUS } from '../../utils/labels'
import { downloadFile, toCSV } from '../../utils/misc'

function Metric({ icon: Icon, label, value, hint }: { icon: typeof UsersRound; label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-900 text-white">
        <Icon className="size-6" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-navy-900">{value}</p>
        <p className="mt-1 text-sm text-ink">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  )
}

function BarList({ rows, max }: { rows: Array<{ label: string; value: number; tone?: 'royal' | 'success' | 'gold' }>; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="wrap-anywhere text-ink">{row.label}</span>
            <span className="shrink-0 font-semibold text-navy-900">{row.value}</span>
          </div>
          <ProgressBar value={(row.value / top) * 100} tone={row.tone} />
        </li>
      ))}
    </ul>
  )
}

export function ReportsPage() {
  const toast = useToast()
  const { items: members } = useMembers()
  const { items: users } = useUsers()
  const { items: teams } = useScopedTeams()
  const { items: events } = useEvents()
  const { items: rosters } = useScopedRosters()
  const { items: services } = useWorshipServices()
  const { nameOf } = useMemberNames()
  const today = todayISO()

  const byStatus = useMemo(() => membersByStatus(members), [members])
  const sizes = useMemo(() => teamsBySize(teams), [teams])
  const phases = useMemo(() => eventsByPhase(events, today), [events, today])
  const responses = useMemo(() => rosterResponses(rosters, today), [rosters, today])
  const attendance = useMemo(() => attendanceRate(events, today), [events, today])
  const birthdays = useMemo(() => upcomingBirthdays(members, 30, today), [members, today])

  const exportCSV = (name: string, headers: string[], rows: Array<Array<string | number>>) => {
    downloadFile(`${name}-${today}.csv`, toCSV(headers, rows))
    toast.success(`Arquivo ${name}-${today}.csv gerado.`)
  }

  const exports = [
    {
      label: 'Membros',
      run: () =>
        exportCSV(
          'membros',
          ['Nome', 'Nascimento', 'Telefone', 'E-mail', 'Endereço', 'Batismo', 'Situação'],
          members.map((m) => [m.fullName, formatDate(m.birthDate), m.phone, m.email, m.address, formatDate(m.baptismDate), MEMBER_STATUS[m.status]]),
        ),
    },
    {
      label: 'Equipes',
      run: () =>
        exportCSV(
          'equipes',
          ['Equipe', 'Líder', 'Integrantes', 'Situação'],
          teams.map((t) => [t.name, nameOf(t.leaderId), t.memberIds.length, t.status === 'ativa' ? 'Ativa' : 'Inativa']),
        ),
    },
    {
      label: 'Eventos',
      run: () =>
        exportCSV(
          'eventos',
          ['Evento', 'Data', 'Horário', 'Local', 'Responsável', 'Participantes', 'Situação'],
          events.map((e) => [e.title, formatDate(e.date), formatTime(e.time), e.location, nameOf(e.responsibleId), e.participants.length, EVENT_PHASE[eventPhase(e, today)]]),
        ),
    },
    {
      label: 'Escalas',
      run: () =>
        exportCSV(
          'escalas',
          ['Escala', 'Data', 'Horário', 'Integrante', 'Função', 'Situação'],
          rosters.flatMap((r) => r.assignments.map((a) => [r.title, formatDate(r.date), formatTime(r.time), nameOf(a.memberId), a.role, a.status])),
        ),
    },
  ]

  return (
    <Page title="Relatórios Gerais" subtitle="Acesse relatórios e estatísticas" icon={ChartColumn}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={UsersRound} label="Membros ativos" value={byStatus.ativo ?? 0} hint={`${members.length} cadastrados`} />
          <Metric icon={UserCheck} label="Usuários do app" value={users.length} />
          <Metric icon={CalendarDays} label="Eventos na agenda" value={events.length} hint={`${phases.realizado ?? 0} realizados`} />
          <Metric icon={ListChecks} label="Cultos programados" value={services.filter((s) => s.date >= today).length} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <SectionHeader title="Membros por situação" icon={UsersRound} />
            <BarList
              rows={Object.entries(MEMBER_STATUS).map(([key, label]) => ({ label, value: byStatus[key] ?? 0 }))}
              max={Math.max(1, members.length)}
            />
          </Card>

          <Card className="p-5">
            <SectionHeader title="Integrantes por equipe" icon={UsersRound} />
            <BarList rows={sizes.map((s) => ({ label: s.name, value: s.members, tone: 'gold' as const }))} />
          </Card>

          <Card className="p-5">
            <SectionHeader title="Eventos por situação" icon={CalendarDays} />
            <BarList rows={Object.entries(EVENT_PHASE).map(([key, label]) => ({ label, value: phases[key] ?? 0 }))} max={Math.max(1, events.length)} />
          </Card>

          <Card className="space-y-5 p-5">
            <div>
              <SectionHeader title="Respostas das escalas" icon={CalendarCheck} />
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-ink">Confirmadas nas próximas escalas</span>
                <span className="font-semibold text-navy-900">{responses.rate}%</span>
              </div>
              <ProgressBar value={responses.rate} tone="success" />
              <p className="mt-2 text-xs text-muted">
                {responses.confirmado} confirmadas • {responses.pendente} pendentes • {responses.recusado} recusadas (de {responses.total})
              </p>
            </div>
            <div>
              <SectionHeader title="Presença em eventos realizados" icon={UsersRound} />
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-ink">Taxa de presença</span>
                <span className="font-semibold text-navy-900">{attendance.rate}%</span>
              </div>
              <ProgressBar value={attendance.rate} />
              <p className="mt-2 text-xs text-muted">
                {attendance.present} presenças • {attendance.absent} ausências registradas
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader title="Aniversariantes (30 dias)" icon={Cake} />
            {birthdays.length === 0 ? (
              <p className="text-sm text-muted">Nenhum aniversário nos próximos 30 dias.</p>
            ) : (
              <ul className="divide-y divide-line">
                {birthdays.slice(0, 8).map(({ member, date, inDays }) => (
                  <li key={member.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="wrap-anywhere font-medium text-ink">{member.fullName}</span>
                    <span className="shrink-0 text-muted">
                      {inDays === 0 ? 'Hoje!' : `${dayMonth(date)} • ${formatDateShort(date).split(',')[0]}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <SectionHeader title="Exportar dados" icon={Download} />
            <p className="mb-3 text-sm text-muted">Arquivos CSV, prontos para abrir no Excel.</p>
            <div className="flex flex-wrap gap-2">
              {exports.map((item) => (
                <Button key={item.label} variant="outline" size="sm" icon={Download} onClick={item.run}>
                  {item.label}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  )
}
