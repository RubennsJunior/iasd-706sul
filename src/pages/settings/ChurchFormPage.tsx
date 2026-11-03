import { Church } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { FormPage } from '../../components/forms/FormPage'
import type { FieldDef } from '../../components/forms/types'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useChurch } from '../../hooks/useData'
import { churchService } from '../../services'

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Nome da igreja', type: 'text', required: true, span: 2 },
  { name: 'district', label: 'Distrito', type: 'text' },
  { name: 'pastor', label: 'Pastor responsável', type: 'text' },
  { name: 'cnpj', label: 'CNPJ', type: 'text', placeholder: '00.000.000/0000-00' },
  { name: 'foundedAt', label: 'Data de fundação', type: 'date' },
  { name: 'address', label: 'Endereço', type: 'text', span: 2 },
  { name: 'city', label: 'Cidade', type: 'text' },
  { name: 'state', label: 'UF', type: 'text', placeholder: 'SP' },
  { name: 'motto', label: 'Lema', type: 'text', span: 2 },
]

/** Edição dos dados da igreja (`/igreja/editar`). */
export function ChurchFormPage() {
  const { can } = useAuth()
  const toast = useToast()
  const { church, loading } = useChurch()

  if (!can('configuracoes', 'edit')) return <Navigate to="/igreja" replace />
  if (!church) return loading ? null : <Navigate to="/igreja" replace />

  return (
    <FormPage
      backTo="/igreja"
      icon={Church}
      title="Editar dados da igreja"
      subtitle={church.name}
      fields={FIELDS}
      initialValues={{ ...church }}
      onSubmit={async (values) => {
        await churchService.save({
          name: String(values.name).trim(),
          district: String(values.district ?? '').trim(),
          pastor: String(values.pastor ?? '').trim(),
          cnpj: String(values.cnpj ?? '').trim(),
          foundedAt: values.foundedAt ?? '',
          address: String(values.address ?? '').trim(),
          city: String(values.city ?? '').trim(),
          state: String(values.state ?? '').trim().toUpperCase(),
          motto: String(values.motto ?? '').trim(),
        })
        toast.success('Dados da igreja atualizados.')
      }}
    />
  )
}
