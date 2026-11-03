import { HandHeart } from 'lucide-react'
import { FormPage } from '../../components/forms/FormPage'
import type { FieldDef } from '../../components/forms/types'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import type { PrayerKind } from '../../models'
import { prayersService } from '../../services'
import { todayISO } from '../../utils/date'
import { PRAYER_KIND_OPTIONS } from '../../utils/labels'

/** Novo pedido de oração (`/liturgia/oracao/novo`); quem pode editar a liturgia também cadastra orações. */
export function PrayerFormPage() {
  const { user, can } = useAuth()
  const toast = useToast()
  const canCurate = can('liturgia', 'edit')

  const fields: FieldDef[] = [
    {
      name: 'kind',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: canCurate ? PRAYER_KIND_OPTIONS : PRAYER_KIND_OPTIONS.filter((o) => o.value === 'pedido'),
    },
    { name: 'title', label: 'Título', type: 'text', required: true },
    { name: 'text', label: 'Descrição', type: 'textarea', required: true, rows: 4 },
  ]

  return (
    <FormPage
      backTo="/liturgia/oracao"
      icon={HandHeart}
      title="Novo pedido de oração"
      subtitle="A igreja vai orar por você"
      fields={fields}
      initialValues={{ kind: 'pedido', title: '', text: '' }}
      onSubmit={async (values) => {
        await prayersService.create({
          kind: values.kind as PrayerKind,
          title: String(values.title).trim(),
          text: String(values.text).trim(),
          author: user?.name ?? 'Anônimo',
          date: todayISO(),
          status: 'aberto',
          prayedBy: [],
        })
        toast.success('Pedido registrado. A igreja vai orar por você.')
      }}
    />
  )
}
