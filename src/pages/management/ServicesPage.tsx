import { useMemo } from 'react'
import { ListChecks, Plus, Trash2 } from 'lucide-react'
import { CrudPage } from '../../components/crud/CrudPage'
import { controlClass } from '../../components/forms/Controls'
import { Select } from '../../components/forms/Select'
import type { FieldDef } from '../../components/forms/types'
import { Badge } from '../../components/ui/Badge'
import { Button, IconButton } from '../../components/ui/Button'
import { useMemberNames } from '../../hooks/useData'
import type { ProgramItem, WorshipService } from '../../models'
import { worshipService } from '../../services'
import { formatDate, formatDateShort, formatTime, todayISO } from '../../utils/date'
import { SERVICE_KINDS } from '../../utils/labels'
import type { Option } from '../../utils/labels'
import { uid } from '../../utils/misc'

function ProgramEditor({
  value,
  onChange,
  memberOptions,
}: {
  value: ProgramItem[]
  onChange(value: ProgramItem[]): void
  memberOptions: Option[]
}) {
  const update = (index: number, patch: Partial<ProgramItem>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  return (
    <div className="space-y-2.5">
      {value.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
          Nenhum item na programação. Adicione os momentos do culto na ordem em que acontecem.
        </p>
      )}
      {value.map((item, index) => (
        <div key={item.id} className="grid gap-2 rounded-2xl border border-line bg-royal-50/40 p-3 sm:grid-cols-[110px_1.6fr_1.2fr_auto] sm:items-center">
          <input
            type="time"
            aria-label="Horário"
            value={item.time}
            onChange={(e) => update(index, { time: e.target.value })}
            className={controlClass()}
          />
          <input
            aria-label="Momento da programação"
            value={item.title}
            onChange={(e) => update(index, { title: e.target.value })}
            placeholder="Ex.: Hino inicial"
            className={controlClass()}
          />
          <Select
            aria-label="Responsável"
            value={item.responsibleId ?? ''}
            onChange={(responsibleId) => update(index, { responsibleId: responsibleId || undefined })}
            options={memberOptions}
            emptyOption="Sem responsável"
          />
          <IconButton
            icon={Trash2}
            label="Remover item"
            tone="danger"
            className="justify-self-end"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <Button
        size="sm"
        variant="secondary"
        icon={Plus}
        onClick={() => onChange([...value, { id: uid('prog'), time: '', title: '' }])}
      >
        Adicionar item
      </Button>
    </div>
  )
}

export function ServicesPage() {
  const { members, nameOf } = useMemberNames()
  const memberOptions = useMemo(
    () => members.filter((m) => m.status !== 'inativo').map((m) => ({ value: m.id, label: m.fullName })),
    [members],
  )

  const fields = useMemo<FieldDef[]>(
    () => [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'kind', label: 'Tipo de programação', type: 'select', required: true, options: SERVICE_KINDS },
      { name: 'date', label: 'Data', type: 'date', required: true },
      { name: 'time', label: 'Horário', type: 'time', required: true },
      { name: 'location', label: 'Local', type: 'text', required: true },
      { name: 'leaderId', label: 'Dirigente', type: 'select', options: memberOptions, emptyOption: 'Sem dirigente' },
      { name: 'theme', label: 'Tema ou mensagem', type: 'text', span: 2 },
      {
        name: 'program',
        label: 'Programação',
        type: 'custom',
        render: ({ value, onChange }) => (
          <ProgramEditor value={(value as ProgramItem[]) ?? []} onChange={onChange} memberOptions={memberOptions} />
        ),
      },
    ],
    [memberOptions],
  )

  return (
    <CrudPage<WorshipService>
      module="cultos"
      basePath="/cultos"
      title="Cultos e Programações"
      subtitle="Configure os cultos e programações"
      icon={ListChecks}
      service={worshipService}
      entityLabel="Culto"
      newLabel="Novo Culto"
      fields={fields}
      defaultValues={{ title: '', kind: 'Culto Divino', date: todayISO(), time: '11:00', location: 'Templo Central', leaderId: '', theme: '', program: [] }}
      searchText={(s) => [s.title, s.kind, s.theme, s.location, nameOf(s.leaderId)]}
      sortBy={(a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)}
      toForm={(s) => ({ ...s, leaderId: s.leaderId ?? '' })}
      fromForm={(values) => ({
        title: String(values.title).trim(),
        kind: values.kind,
        date: values.date,
        time: values.time,
        location: String(values.location).trim(),
        leaderId: values.leaderId || undefined,
        theme: String(values.theme ?? '').trim(),
        program: (values.program as ProgramItem[])
          .filter((p) => p.title.trim())
          .map((p) => ({ ...p, title: p.title.trim() }))
          .sort((a, b) => a.time.localeCompare(b.time)),
      })}
      validate={(values) => {
        const rows = values.program as ProgramItem[]
        return rows.some((p) => p.title.trim() && !p.time) ? { program: 'Informe o horário de cada item da programação.' } : undefined
      }}
      filters={[
        { key: 'kind', label: 'Tipo', options: SERVICE_KINDS, predicate: (s, value) => s.kind === value },
        {
          key: 'when',
          label: 'Período',
          options: [
            { value: 'futuros', label: 'Próximos' },
            { value: 'passados', label: 'Anteriores' },
          ],
          predicate: (s, value) => (value === 'futuros' ? s.date >= todayISO() : s.date < todayISO()),
        },
      ]}
      columns={[
        { header: 'Data', sortValue: (s) => `${s.date}${s.time}`, cell: (s) => `${formatDateShort(s.date)} • ${formatTime(s.time)}` },
        { header: 'Culto', sortValue: (s) => s.title, cell: (s) => <span className="font-medium text-navy-900">{s.title}</span> },
        { header: 'Tipo', cell: (s) => <Badge tone="info">{s.kind}</Badge> },
        { header: 'Dirigente', cell: (s) => nameOf(s.leaderId) },
        { header: 'Programação', cell: (s) => `${s.program.length} item(ns)` },
      ]}
      card={(s) => ({
        title: s.title,
        subtitle: `${formatDate(s.date)} • ${formatTime(s.time)} • ${s.location}`,
        badge: <Badge tone="info">{s.kind}</Badge>,
        meta: `Dirigente: ${nameOf(s.leaderId)} • ${s.program.length} item(ns)`,
      })}
    />
  )
}
