import { UsersRound } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { FormPage } from '../../components/forms/FormPage'
import type { FieldDef } from '../../components/forms/types'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useEvents, useMemberNames } from '../../hooks/useData'
import { eventsService } from '../../services'
import { formatDateShort } from '../../utils/date'

/** Inscrição de membros em um evento (`/participantes/novo`). */
export function ParticipantFormPage() {
  const { can } = useAuth()
  const toast = useToast()
  const { items: events } = useEvents()
  const { members } = useMemberNames()

  if (!can('participantes', 'create')) return <Navigate to="/participantes" replace />

  const fields: FieldDef[] = [
    {
      name: 'eventId',
      label: 'Evento',
      type: 'select',
      required: true,
      span: 2,
      options: events
        .filter((e) => e.status !== 'cancelado')
        .map((e) => ({ value: e.id, label: `${e.title} — ${formatDateShort(e.date)}` })),
    },
    {
      name: 'memberIds',
      label: 'Membros',
      type: 'multiselect',
      required: true,
      options: members.filter((m) => m.status !== 'inativo').map((m) => ({ value: m.id, label: m.fullName })),
      hint: 'Quem já participa do evento é ignorado.',
    },
  ]

  return (
    <FormPage
      backTo="/participantes"
      icon={UsersRound}
      title="Novo participante"
      subtitle="Inscreva membros em um evento"
      fields={fields}
      initialValues={{ eventId: '', memberIds: [] }}
      onSubmit={async (values) => {
        const event = events.find((e) => e.id === values.eventId)
        const existing = new Set(event?.participants.map((p) => p.memberId))
        const fresh = (values.memberIds as string[]).filter((id) => !existing.has(id))
        if (fresh.length === 0) throw new Error('Todos os membros selecionados já participam deste evento.')
        for (const id of fresh) await eventsService.addParticipant(values.eventId, id)
        toast.success(`${fresh.length} participante(s) adicionado(s).`)
      }}
    />
  )
}
