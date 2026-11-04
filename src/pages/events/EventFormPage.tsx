import { useMemo } from 'react'
import { BookOpen, CalendarDays, Clock, ListChecks, Sparkles } from 'lucide-react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ActionsEditor, DynamicsEditor, LiturgyEditor, ScheduleEditor } from '../../components/events/EventPlanEditors'
import { ParticipantPicker } from '../../components/events/ParticipantPicker'
import { FormPage } from '../../components/forms/FormPage'
import type { FormTab } from '../../components/forms/FormPage'
import { PhotoField } from '../../components/forms/PhotoField'
import type { FieldDef, Values } from '../../components/forms/types'
import { Cover } from '../../components/ui/Cover'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useEvents, useMemberNames, useTeams } from '../../hooks/useData'
import type { CoverKey, EventAction, EventDynamic, EventLiturgyItem, EventParticipant, EventScheduleItem, EventStatus } from '../../models'
import { cleanPlan, eventsService, planOf, validatePlan } from '../../services'
import { todayISO } from '../../utils/date'
import { PHOTO_PRESETS } from '../../utils/image'
import { COVER_OPTIONS, EVENT_STATUS_OPTIONS } from '../../utils/labels'

const TABS: FormTab[] = [
  { key: 'dados', label: 'Dados', icon: CalendarDays },
  { key: 'cronograma', label: 'Cronograma', icon: Clock },
  { key: 'liturgia', label: 'Liturgia', icon: BookOpen },
  { key: 'dinamicas', label: 'Dinâmicas', icon: Sparkles },
  { key: 'acoes', label: 'Ações', icon: ListChecks },
]

/** Cadastro (`/eventos/novo`) e edição (`/eventos/:id/editar`) de evento, com abas de cronograma, liturgia, dinâmicas e ações. */
export function EventFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
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
    {
      name: 'photo',
      label: 'Foto do evento',
      type: 'custom',
      tab: 'dados',
      render: ({ value, onChange, values }) => (
        <PhotoField
          shape="wide"
          label="foto"
          value={value as string | undefined}
          onChange={onChange}
          options={PHOTO_PRESETS.event}
          fallback={<Cover cover={values.cover as CoverKey} title={String(values.title || 'Evento')} showTitle={false} className="absolute inset-0" />}
        />
      ),
    },
    { name: 'title', label: 'Título do evento', type: 'text', required: true, span: 2, tab: 'dados' },
    { name: 'description', label: 'Descrição', type: 'textarea', rows: 3, tab: 'dados' },
    { name: 'date', label: 'Data', type: 'date', required: true, tab: 'dados' },
    { name: 'time', label: 'Horário', type: 'time', required: true, tab: 'dados' },
    { name: 'location', label: 'Local', type: 'text', required: true, tab: 'dados' },
    { name: 'responsibleId', label: 'Responsável', type: 'select', options: memberOptions, emptyOption: 'Sem responsável', tab: 'dados' },
    { name: 'status', label: 'Situação', type: 'select', required: true, options: EVENT_STATUS_OPTIONS, tab: 'dados' },
    { name: 'cover', label: 'Capa', type: 'select', required: true, options: COVER_OPTIONS, tab: 'dados', hint: 'Usada quando o evento não tem foto.' },
    {
      name: 'participantIds',
      label: 'Participantes',
      type: 'custom',
      tab: 'dados',
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
    {
      name: 'schedule',
      label: 'Cronograma do evento',
      type: 'custom',
      tab: 'cronograma',
      hint: 'O que acontece em cada horário. Ao salvar, os itens ficam em ordem de horário.',
      render: ({ value, onChange }) => (
        <ScheduleEditor value={(value as EventScheduleItem[]) ?? []} onChange={onChange} memberOptions={memberOptions} />
      ),
    },
    {
      name: 'liturgy',
      label: 'Liturgia',
      type: 'custom',
      tab: 'liturgia',
      hint: 'A ordem do culto ou da programação. Use as setas para reorganizar.',
      render: ({ value, onChange }) => (
        <LiturgyEditor value={(value as EventLiturgyItem[]) ?? []} onChange={onChange} memberOptions={memberOptions} />
      ),
    },
    {
      name: 'dynamics',
      label: 'Dinâmicas',
      type: 'custom',
      tab: 'dinamicas',
      hint: 'Atividades do evento, com duração, materiais e quem conduz.',
      render: ({ value, onChange }) => (
        <DynamicsEditor value={(value as EventDynamic[]) ?? []} onChange={onChange} memberOptions={memberOptions} />
      ),
    },
    {
      name: 'actions',
      label: 'Ações para as pessoas escolherem',
      type: 'custom',
      tab: 'acoes',
      hint: 'Cada pessoa escolhe, na página do evento, a ação que vai fazer. Deixe as vagas em branco para não limitar.',
      render: ({ value, onChange }) => <ActionsEditor value={(value as EventAction[]) ?? []} onChange={onChange} />,
    },
  ]

  const plan = planOf(event)
  const initialValues: Values = event
    ? {
        ...event,
        photo: event.photo,
        responsibleId: event.responsibleId ?? '',
        participantIds: event.participants.map((p) => p.memberId),
        ...plan,
      }
    : {
        title: '',
        description: '',
        date: todayISO(),
        time: '19:00',
        location: '',
        responsibleId: '',
        status: 'planejado',
        cover: 'geral',
        photo: undefined,
        participantIds: [],
        ...plan,
      }

  const submit = async (values: Values) => {
    // Mantém a situação de quem já participava; novos entram como "inscrito".
    const previous = new Map((event?.participants ?? []).map((p) => [p.memberId, p]))
    const participants: EventParticipant[] = (values.participantIds as string[]).map(
      (memberId) => previous.get(memberId) ?? { memberId, status: 'inscrito' },
    )
    // Quem já escolheu uma ação continua nela: o formulário não mexe nas escolhas, só nas ações.
    const chosen = new Map((event?.actions ?? []).map((a) => [a.id, a.memberIds]))
    const cleaned = cleanPlan({
      schedule: values.schedule as EventScheduleItem[],
      liturgy: values.liturgy as EventLiturgyItem[],
      dynamics: values.dynamics as EventDynamic[],
      actions: (values.actions as EventAction[]).map((a) => ({ ...a, memberIds: chosen.get(a.id) ?? a.memberIds ?? [] })),
    })
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
      photo: (values.photo as string) || undefined,
      ...cleaned,
    }
    if (event) await eventsService.update(event.id, payload)
    else await eventsService.create(payload)
    toast.success(event ? 'Evento atualizado com sucesso.' : 'Evento cadastrado com sucesso.')
  }

  const wanted = params.get('aba')

  return (
    <FormPage
      key={event?.id ?? 'new'}
      backTo={backTo}
      icon={CalendarDays}
      title={event ? 'Editar evento' : 'Novo evento'}
      subtitle={event?.title ?? 'Preencha os dados do evento'}
      tabs={TABS}
      initialTab={TABS.some((tab) => tab.key === wanted) ? (wanted as string) : 'dados'}
      fields={fields}
      initialValues={initialValues}
      validate={(values) =>
        validatePlan({
          schedule: values.schedule as EventScheduleItem[],
          liturgy: values.liturgy as EventLiturgyItem[],
          dynamics: values.dynamics as EventDynamic[],
          actions: values.actions as EventAction[],
        })
      }
      onSubmit={submit}
    />
  )
}
