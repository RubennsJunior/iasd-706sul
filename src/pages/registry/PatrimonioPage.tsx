import { Package } from 'lucide-react'
import { CrudPage } from '../../components/crud/CrudPage'
import type { FieldDef } from '../../components/forms/types'
import { StatusBadge } from '../../components/ui/Badge'
import type { Asset } from '../../models'
import { assetsService } from '../../services'
import { formatDate, todayISO } from '../../utils/date'
import {
  ASSET_CATEGORY_OPTIONS,
  ASSET_CONDITION_OPTIONS,
} from '../../utils/labels'

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Nome do bem / objeto', type: 'text', required: true, span: 2 },
  { name: 'assetNumber', label: 'Número do patrimônio', type: 'text', placeholder: 'Ex.: 001, PAT-2024-001', required: true },
  {
    name: 'category',
    label: 'Categoria',
    type: 'select',
    required: true,
    options: ASSET_CATEGORY_OPTIONS,
  },
  {
    name: 'condition',
    label: 'Estado de conservação',
    type: 'select',
    required: true,
    options: ASSET_CONDITION_OPTIONS,
  },
  {
    name: 'purchaseDate',
    label: 'Data de aquisição',
    type: 'date',
    validate: (value) =>
      value && String(value) > todayISO() ? 'A data não pode ser futura.' : undefined,
  },
  { name: 'purchaseValue', label: 'Valor de aquisição (R$)', type: 'text', placeholder: 'Ex.: 1.500,00' },
  { name: 'location', label: 'Localização / Sala', type: 'text', span: 2, placeholder: 'Ex.: Sala de reunião, Templo principal' },
  {
    name: 'responsibleId',
    label: 'Responsável pelo bem',
    type: 'text',
    placeholder: 'Nome do responsável',
  },
  { name: 'description', label: 'Descrição', type: 'textarea', rows: 3, span: 2, placeholder: 'Marca, modelo, número de série, cor...' },
  { name: 'notes', label: 'Observações', type: 'textarea', rows: 2, span: 2 },
]

export function PatrimonioPage() {
  return (
    <CrudPage<Asset>
      module="patrimonio"
      basePath="/patrimonio"
      title="Patrimônio"
      subtitle="Gerencie os bens e patrimônios da igreja"
      icon={Package}
      service={assetsService}
      entityLabel="Patrimônio"
      fields={FIELDS}
      defaultValues={{
        name: '',
        assetNumber: '',
        category: 'equipamento',
        condition: 'bom',
        purchaseDate: '',
        purchaseValue: '',
        location: '',
        responsibleId: '',
        description: '',
        notes: '',
      }}
      searchText={(a) => [a.name, a.assetNumber, a.location, a.description, a.responsibleId]}
      sortBy={(a, b) => a.name.localeCompare(b.name, 'pt-BR')}
      filters={[
        {
          key: 'category',
          label: 'Categoria',
          options: ASSET_CATEGORY_OPTIONS,
          predicate: (a, value) => a.category === value,
        },
        {
          key: 'condition',
          label: 'Conservação',
          options: ASSET_CONDITION_OPTIONS,
          predicate: (a, value) => a.condition === value,
        },
      ]}
      fromForm={(values) => ({
        name: String(values.name).trim(),
        assetNumber: String(values.assetNumber ?? '').trim(),
        category: values.category,
        condition: values.condition,
        purchaseDate: values.purchaseDate ?? '',
        purchaseValue: String(values.purchaseValue ?? '').trim(),
        location: String(values.location ?? '').trim(),
        responsibleId: String(values.responsibleId ?? '').trim() || undefined,
        description: String(values.description ?? '').trim(),
        notes: String(values.notes ?? '').trim(),
      })}
      columns={[
        {
          header: 'Nº Patrimônio',
          sortValue: (a) => a.assetNumber,
          cell: (a) => (
            <span className="font-mono text-sm font-medium text-navy-900">
              {a.assetNumber || '—'}
            </span>
          ),
        },
        {
          header: 'Nome / Bem',
          sortValue: (a) => a.name,
          cell: (a) => <span className="font-medium text-navy-900">{a.name}</span>,
        },
        {
          header: 'Categoria',
          sortValue: (a) => a.category,
          cell: (a) => <StatusBadge kind="assetCategory" value={a.category} />,
        },
        {
          header: 'Conservação',
          sortValue: (a) => a.condition,
          cell: (a) => <StatusBadge kind="assetCondition" value={a.condition} />,
        },
        { header: 'Localização', cell: (a) => a.location || '—' },
        {
          header: 'Aquisição',
          sortValue: (a) => a.purchaseDate,
          cell: (a) => formatDate(a.purchaseDate),
        },
      ]}
      card={(a) => ({
        title: a.name,
        subtitle: a.location || 'Sem localização definida',
        badge: <StatusBadge kind="assetCondition" value={a.condition} />,
        meta: [
          a.assetNumber && `Nº ${a.assetNumber}`,
          a.purchaseDate && `Adquirido em ${formatDate(a.purchaseDate)}`,
        ]
          .filter(Boolean)
          .join(' • ') || undefined,
      })}
    />
  )
}
