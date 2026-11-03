import { Building2, Church, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../../contexts/AuthContext'
import { useChurch } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import { formatDate } from '../../utils/date'

export function ChurchPage() {
  const { can } = useAuth()
  const { church } = useChurch()

  const rows: Array<[string, string]> = church
    ? [
        ['Nome', church.name],
        ['Distrito', church.district],
        ['Pastor responsável', church.pastor],
        ['CNPJ', church.cnpj],
        ['Fundação', formatDate(church.foundedAt)],
        ['Endereço', church.address],
        ['Cidade / UF', [church.city, church.state].filter(Boolean).join(' / ')],
        ['Lema', church.motto],
      ]
    : []

  return (
    <Page title="Dados da Igreja" subtitle="Atualize as informações da sua igreja" icon={Church}>
      <Card className="mx-auto max-w-3xl p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-navy-900 text-white">
            <Building2 className="size-8" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-navy-900">{church?.name}</h2>
            <p className="text-sm italic text-muted">{church?.motto}</p>
          </div>
          {can('configuracoes', 'edit') && (
            <Link to="/igreja/editar">
              <Button icon={Pencil}>Editar</Button>
            </Link>
          )}
        </div>
        <dl className="grid gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
              <dd className="mt-0.5 text-sm text-ink">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </Page>
  )
}
