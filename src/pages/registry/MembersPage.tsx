import { UsersRound } from 'lucide-react'
import { CrudPage } from '../../components/crud/CrudPage'
import type { FieldDef } from '../../components/forms/types'
import { Avatar } from '../../components/ui/Avatar'
import { StatusBadge } from '../../components/ui/Badge'
import type { Member } from '../../models'
import { membersService, memberUsage } from '../../services'
import { ageFrom, formatDate, todayISO } from '../../utils/date'
import { MEMBER_STATUS_OPTIONS } from '../../utils/labels'
import { pluralize } from '../../utils/misc'

const FIELDS: FieldDef[] = [
  { name: 'fullName', label: 'Nome completo', type: 'text', required: true, span: 2 },
  {
    name: 'birthDate',
    label: 'Data de nascimento',
    type: 'date',
    validate: (value) => (value && String(value) > todayISO() ? 'A data não pode ser futura.' : undefined),
  },
  { name: 'phone', label: 'Telefone', type: 'tel', placeholder: '(00) 00000-0000' },
  { name: 'email', label: 'E-mail', type: 'email', placeholder: 'nome@exemplo.com' },
  {
    name: 'baptismDate',
    label: 'Data de batismo',
    type: 'date',
    validate: (value, values) =>
      value && values.birthDate && String(value) < String(values.birthDate)
        ? 'O batismo não pode ser anterior ao nascimento.'
        : undefined,
  },
  { name: 'address', label: 'Endereço', type: 'text', span: 2 },
  { name: 'status', label: 'Situação do membro', type: 'select', required: true, options: MEMBER_STATUS_OPTIONS },
  { name: 'notes', label: 'Observações', type: 'textarea', rows: 3 },
]

export function MembersPage() {
  return (
    <CrudPage<Member>
      module="membros"
      basePath="/membros"
      title="Cadastro de Membros"
      subtitle="Gerencie os membros da igreja"
      icon={UsersRound}
      service={membersService}
      entityLabel="Membro"
      fields={FIELDS}
      defaultValues={{ fullName: '', birthDate: '', phone: '', email: '', address: '', baptismDate: '', status: 'ativo', notes: '' }}
      searchText={(m) => [m.fullName, m.email, m.phone, m.address]}
      sortBy={(a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')}
      filters={[
        {
          key: 'status',
          label: 'Situação',
          options: MEMBER_STATUS_OPTIONS,
          predicate: (m, value) => m.status === value,
        },
      ]}
      fromForm={(values) => ({
        fullName: String(values.fullName).trim(),
        birthDate: values.birthDate ?? '',
        phone: String(values.phone ?? '').trim(),
        email: String(values.email ?? '').trim(),
        address: String(values.address ?? '').trim(),
        baptismDate: values.baptismDate ?? '',
        status: values.status,
        notes: String(values.notes ?? '').trim(),
      })}
      deleteWarning={async (m) => {
        const usage = await memberUsage(m.id)
        const parts = [
          usage.teams && pluralize(usage.teams, 'equipe'),
          usage.rosters && pluralize(usage.rosters, 'escala'),
          usage.events && pluralize(usage.events, 'evento'),
          usage.users && 'acesso ao aplicativo',
        ].filter(Boolean)
        return parts.length ? `Os vínculos com ${parts.join(', ')} também serão removidos.` : undefined
      }}
      columns={[
        {
          header: 'Nome',
          sortValue: (m) => m.fullName,
          cell: (m) => (
            <div className="flex items-center gap-3">
              <Avatar name={m.fullName} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-medium text-navy-900">{m.fullName}</p>
                <p className="truncate text-xs text-muted">{m.email || 'Sem e-mail'}</p>
              </div>
            </div>
          ),
        },
        { header: 'Telefone', cell: (m) => m.phone || '—' },
        {
          header: 'Nascimento',
          sortValue: (m) => m.birthDate,
          cell: (m) => {
            const age = ageFrom(m.birthDate)
            return m.birthDate ? `${formatDate(m.birthDate)}${age !== null ? ` (${age} anos)` : ''}` : '—'
          },
        },
        { header: 'Batismo', sortValue: (m) => m.baptismDate, cell: (m) => formatDate(m.baptismDate) },
        { header: 'Situação', sortValue: (m) => m.status, cell: (m) => <StatusBadge kind="member" value={m.status} /> },
      ]}
      card={(m) => ({
        leading: <Avatar name={m.fullName} />,
        title: m.fullName,
        subtitle: m.phone || m.email || 'Sem contato',
        badge: <StatusBadge kind="member" value={m.status} />,
        meta: m.baptismDate ? `Batizado em ${formatDate(m.baptismDate)}` : 'Sem data de batismo',
      })}
    />
  )
}
