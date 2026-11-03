import { useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import { Navigate, useParams } from 'react-router-dom'
import { ParticipantPicker } from '../../components/events/ParticipantPicker'
import { FormPage } from '../../components/forms/FormPage'
import type { FieldDef, Values } from '../../components/forms/types'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useEvents, useMemberNames, useTeams } from '../../hooks/useData'
import type { CoverKey, EventParticipant, EventStatus } from '../../models'
import { eventsService } from '../../services'
import { todayISO } from '../../utils/date'
import { COVER_OPTIONS, EVENT_STATUS_OPTIONS } from '../../utils/labels'

/** Cadastro (`/eventos/novo`) e edição (`/eventos/:id/editar`) de evento. */
export function EventFormPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const toast = useToast()
  const { items: events, loading } = useEvents()
  const { members } = useMemberNames()
  const { items: teams } = useTeams()

  const event = id ? events.find((e) => e.id === id) : undefined

  const memberOptions = useMemo(
    () => members.filter((m) => m.status !== 'inativo').map((m) => ({ value: m.id, label: m.fullName })),
    [members],
  )

  const backTo = id ? `/eventos/${id}` : '/eventos'
  if (!can('eventos', id ? 'edit' : 'create')) return <Navigate to="/eventos" replace />
  if (id && !event) return loading ? null : <Navigate to="/eventos" replace />

  const fields: FieldDef[] = [
    { name: 'title', label: 'Título do evento', type: 'text', required: true, span: 2 },
    { name: 'description', label: 'Descrição', type: 'textarea', rows: 3 },
    { name: 'date', label: 'Data', type: 'date', required: true },
    { name: 'time', label: 'Horário', type: 'time', required: true },
    { name: 'location', label: 'Local', type: 'text', required: true },
    { name: 'responsibleId', label: 'Responsável', type: 'select', options: memberOptions, emptyOption: 'Sem responsável' },
    { name: 'status', label: 'Situação', type: 'select', required: true, options: EVENT_STATUS_OPTIONS },
    { name: 'cover', label: 'Capa', type: 'select', required: true, options: COVER_OPTIONS },
    {
      name: 'participantIds',
      label: 'Participantes',
      type: 'custom',
      render: ({ value, onChange }) => (
        <ParticipantPicker
          value={(value as string[]) ?? []}
          onChange={onChange}
          memberOptions={memberOptions}
          teams={teams}
          initialMode={event && event.participants.length > 0 ? 'manual' : 'equipe'}
        />
      ),
    },
  ]

  const initialValues: Values = event
    ? { ...event, responsibleId: event.responsibleId ?? '', participantIds: event.participants.map((p) => p.memberId) }
    : {
        title: '',
        description: '',
        date: todayISO(),
        time: '19:00',
        location: '',
        responsibleId: '',
        status: 'planejado',
        cover: 'geral',
        participantIds: [],
      }

  const submit = async (values: Values) => {
    // Mantém a situação de quem já participava; novos entram como "inscrito".
    const previous = new Map((event?.participants ?? []).map((p) => [p.memberId, p]))
    const participants: EventParticipant[] = (values.participantIds as string[]).map(
      (memberId) => previous.get(memberId) ?? { memberId, status: 'inscrito' },
    )
    const payload = {
      title: String(values.title).trim(),
      description: String(values.description ?? '').trim(),
      date: values.date as string,
      time: values.time as string,
      location: String(values.location).trim(),
      responsibleId: (values.responsibleId as string) || undefined,
      participants,
      status: values.status as EventStatus,
      cover: values.cover as CoverKey,
    }
    if (event) await eventsService.update(event.id, payload)
    else await eventsService.create(payload)
    toast.success(event ? 'Evento atualizado com sucesso.' : 'Evento cadastrado com sucesso.')
  }

  return (
    <FormPage
      key={event?.id ?? 'new'}
      backTo={backTo}
      icon={CalendarDays}
      title={event ? 'Editar evento' : 'Novo evento'}
      subtitle={event?.title ?? 'Preencha os dados do evento'}
      fields={fields}
      initialValues={initialValues}
      onSubmit={submit}
    />
  )
}
