import { useMemo, useState } from 'react'
import {
  Ban,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Pencil,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../../components/ui/Avatar'
import { StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { Cover } from '../../components/ui/Cover'
import { EmptyState } from '../../components/ui/Misc'
import { Select } from '../../components/forms/Select'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { useEvents, useMemberNames, useRosters } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import { eventPhase, eventsService } from '../../services'
import type { EventStatus, ParticipantStatus } from '../../models'
import { formatDateLong, formatTime } from '../../utils/date'
import { PARTICIPANT_STATUS_OPTIONS } from '../../utils/labels'

export function EventDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { items: events, loading } = useEvents()
  const { items: rosters } = useRosters()
  const { members, nameOf } = useMemberNames()
  const [newParticipant, setNewParticipant] = useState('')

  const event = events.find((e) => e.id === id)
  const linkedRosters = useMemo(
    () => rosters.filter((r) => r.linked === `evento:${id}`),
    [rosters, id],
  )

  if (!event) {
    return (
      <Page title="Evento" subtitle="Detalhes do evento" icon={CalendarDays} back="/eventos">
        {!loading && (
          <EmptyState
            icon={CalendarDays}
            title="Evento não encontrado"
            description="Ele pode ter sido excluído."
            action={
              <Link to="/eventos">
                <Button>Ver eventos</Button>
              </Link>
            }
          />
        )}
      </Page>
    )
  }

  const canEdit = can('eventos', 'edit')
  const available = members.filter(
    (m) => m.status !== 'inativo' && !event.participants.some((p) => p.memberId === m.id),
  )

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const changeStatus = (status: EventStatus, message: string) =>
    run(() => eventsService.update(event.id, { status }), message)

  const remove = async () => {
    const ok = await confirm({
      title: 'Excluir evento?',
      message: (
        <>
          <strong className="text-navy-900">{event.title}</strong> e a lista de participantes serão removidos. Esta
          ação não pode ser desfeita.
        </>
      ),
    })
    if (!ok) return
    await run(() => eventsService.remove(event.id), 'Evento excluído.')
    navigate('/eventos', { replace: true })
  }

  return (
    <Page title={event.title} subtitle={formatDateLong(event.date)} icon={CalendarDays} back="/eventos">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <Cover cover={event.cover} title={event.title} className="h-44 w-full lg:h-56" showTitle={false} />
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge kind="event" value={eventPhase(event)} />
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/eventos/${event.id}/editar`}>
                      <Button size="sm" variant="outline" icon={Pencil}>
                        Editar
                      </Button>
                    </Link>
                    {can('eventos', 'delete') && (
                      <Button size="sm" variant="outline" icon={Trash2} onClick={remove} className="text-red-600">
                        Excluir
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-bold text-navy-900">{event.title}</h2>
              <ul className="grid gap-2.5 text-sm text-ink sm:grid-cols-2">
                <li className="flex items-center gap-2.5">
                  <CalendarDays className="size-5 text-navy-800" />
                  {formatDateLong(event.date)}
                </li>
                <li className="flex items-center gap-2.5">
                  <Clock className="size-5 text-navy-800" />
                  {formatTime(event.time)}
                </li>
                <li className="flex items-center gap-2.5">
                  <MapPin className="size-5 text-navy-800" />
                  {event.location || 'Local a definir'}
                </li>
                <li className="flex items-center gap-2.5">
                  <UserRound className="size-5 text-navy-800" />
                  Responsável: {nameOf(event.responsibleId)}
                </li>
              </ul>
              {event.description && <p className="whitespace-pre-line text-ink">{event.description}</p>}

              {canEdit && event.status !== 'realizado' && event.status !== 'cancelado' && (
                <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                  {event.status === 'planejado' && (
                    <Button size="sm" variant="secondary" icon={CheckCircle2} onClick={() => changeStatus('confirmado', 'Evento confirmado.')}>
                      Confirmar evento
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" icon={CalendarCheck} onClick={() => changeStatus('realizado', 'Evento marcado como realizado.')}>
                    Marcar como realizado
                  </Button>
                  <Button size="sm" variant="secondary" icon={Ban} onClick={() => changeStatus('cancelado', 'Evento cancelado.')}>
                    Cancelar evento
                  </Button>
                </div>
              )}
              {canEdit && (event.status === 'cancelado' || event.status === 'realizado') && (
                <div className="border-t border-line pt-4">
                  <Button size="sm" variant="secondary" onClick={() => changeStatus('planejado', 'Evento reaberto como planejado.')}>
                    Reabrir evento
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <section>
            <SectionHeader title={`Participantes (${event.participants.length})`} icon={UserPlus} />
            <Card className="p-2">
              {canEdit && (
                <form
                  className="flex gap-2 border-b border-line p-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!newParticipant) return
                    void run(() => eventsService.addParticipant(event.id, newParticipant), 'Participante adicionado.')
                    setNewParticipant('')
                  }}
                >
                  <Select
                    aria-label="Adicionar participante"
                    value={newParticipant}
                    onChange={setNewParticipant}
                    options={available.map((m) => ({ value: m.id, label: m.fullName }))}
                    placeholder="Adicionar participante…"
                  />
                  <Button type="submit" icon={UserPlus} disabled={!newParticipant}>
                    Adicionar
                  </Button>
                </form>
              )}
              {event.participants.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Nenhum participante cadastrado.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {event.participants.map((p) => (
                    <li key={p.memberId} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar name={nameOf(p.memberId)} size="sm" />
                      <span className="min-w-0 flex-1 wrap-anywhere text-sm font-medium text-ink">{nameOf(p.memberId)}</span>
                      {canEdit ? (
                        <Select
                          variant="pill"
                          aria-label={`Situação de ${nameOf(p.memberId)}`}
                          value={p.status}
                          onChange={(status) =>
                            void run(() =>
                              eventsService.setParticipantStatus(event.id, p.memberId, status as ParticipantStatus),
                            )
                          }
                          options={PARTICIPANT_STATUS_OPTIONS}
                        />
                      ) : (
                        <StatusBadge kind="participant" value={p.status} />
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          aria-label={`Remover ${nameOf(p.memberId)}`}
                          onClick={() => void run(() => eventsService.removeParticipant(event.id, p.memberId), 'Participante removido.')}
                          className="grid size-8 place-items-center rounded-full text-red-600 hover:bg-red-50"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>

        <aside className="space-y-4">
          <section>
            <SectionHeader title="Escalas do evento" icon={CalendarCheck} />
            {linkedRosters.length === 0 ? (
              <Card className="p-4 text-sm text-muted">Nenhuma escala vinculada a este evento.</Card>
            ) : (
              <ul className="space-y-2.5">
                {linkedRosters.map((r) => {
                  const confirmed = r.assignments.filter((a) => a.status === 'confirmado').length
                  return (
                    <li key={r.id}>
                      <Link to="/escalas" className="block rounded-2xl bg-white p-4 shadow-card hover:shadow-float">
                        <p className="font-semibold text-navy-900">{r.title}</p>
                        <p className="text-sm text-muted">
                          {confirmed} de {r.assignments.length} confirmados
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

    </Page>
  )
}
