import { Globe, Mail, MapPin, MessageCircle, Phone, Share2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CrudPage } from '../../components/crud/CrudPage'
import type { FieldDef } from '../../components/forms/types'
import { Badge } from '../../components/ui/Badge'
import type { ContactInfo, ContactKind } from '../../models'
import { contactsService } from '../../services'
import { CONTACT_KIND, CONTACT_KIND_OPTIONS } from '../../utils/labels'

const ICONS: Record<ContactKind, LucideIcon> = {
  telefone: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  endereco: MapPin,
  site: Globe,
  'rede-social': Share2,
}

const FIELDS: FieldDef[] = [
  { name: 'kind', label: 'Tipo de contato', type: 'select', required: true, options: CONTACT_KIND_OPTIONS },
  { name: 'label', label: 'Identificação', type: 'text', required: true, placeholder: 'Ex.: Secretaria' },
  { name: 'value', label: 'Contato', type: 'text', required: true, span: 2 },
  { name: 'hours', label: 'Horário de atendimento', type: 'text', span: 2 },
]

function Icon({ kind }: { kind: ContactKind }) {
  const Component = ICONS[kind]
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-navy-900 text-white">
      <Component className="size-5" />
    </span>
  )
}

export function ContactsPage() {
  return (
    <CrudPage<ContactInfo>
      module="configuracoes"
      basePath="/contatos"
      title="Informações de Contato"
      subtitle="Gerencie os contatos da igreja"
      icon={Phone}
      service={contactsService}
      entityLabel="Contato"
      fields={FIELDS}
      defaultValues={{ kind: 'telefone', label: '', value: '', hours: '' }}
      searchText={(c) => [c.label, c.value, CONTACT_KIND[c.kind]]}
      sortBy={(a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label, 'pt-BR')}
      fromForm={(values) => ({
        kind: values.kind,
        label: String(values.label).trim(),
        value: String(values.value).trim(),
        hours: String(values.hours ?? '').trim(),
      })}
      filters={[{ key: 'kind', label: 'Tipo', options: CONTACT_KIND_OPTIONS, predicate: (c, value) => c.kind === value }]}
      columns={[
        {
          header: 'Contato',
          sortValue: (c) => c.label,
          cell: (c) => (
            <div className="flex items-center gap-3">
              <Icon kind={c.kind} />
              <div className="min-w-0">
                <p className="font-medium text-navy-900">{c.label}</p>
                <p className="text-xs text-muted">{c.value}</p>
              </div>
            </div>
          ),
        },
        { header: 'Tipo', sortValue: (c) => c.kind, cell: (c) => <Badge tone="info">{CONTACT_KIND[c.kind]}</Badge> },
        { header: 'Atendimento', cell: (c) => c.hours || '—' },
      ]}
      card={(c) => ({
        leading: <Icon kind={c.kind} />,
        title: c.label,
        subtitle: c.value,
        badge: <Badge tone="info">{CONTACT_KIND[c.kind]}</Badge>,
        meta: c.hours || undefined,
      })}
    />
  )
}
