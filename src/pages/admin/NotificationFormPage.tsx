import { Bell } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { FormPage } from '../../components/forms/FormPage'
import type { FieldDef } from '../../components/forms/types'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import type { NotificationKind } from '../../models'
import { notificationsService } from '../../services'
import { NOTIFICATION_KIND_OPTIONS } from '../../utils/labels'

const FIELDS: FieldDef[] = [
  { name: 'kind', label: 'Tipo', type: 'select', required: true, options: NOTIFICATION_KIND_OPTIONS },
  { name: 'title', label: 'Título', type: 'text', required: true },
  { name: 'body', label: 'Mensagem', type: 'textarea', required: true, rows: 4 },
]

/** Envio de uma nova notificação (`/notificacoes/nova`). */
export function NotificationFormPage() {
  const { can } = useAuth()
  const toast = useToast()

  if (!can('notificacoes', 'create')) return <Navigate to="/notificacoes" replace />

  return (
    <FormPage
      backTo="/notificacoes"
      icon={Bell}
      title="Nova notificação"
      subtitle="Será enviada a todos os usuários"
      fields={FIELDS}
      initialValues={{ kind: 'aviso', title: '', body: '' }}
      onSubmit={async (values) => {
        await notificationsService.create({
          kind: values.kind as NotificationKind,
          title: String(values.title).trim(),
          body: String(values.body).trim(),
          readBy: [],
        })
        toast.success('Notificação enviada.')
      }}
    />
  )
}
