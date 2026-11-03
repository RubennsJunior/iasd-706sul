import { useMemo, useState } from 'react'
import { CheckCheck, ChevronRight, Clock, ListFilter, SearchX, UserPlus, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '../../components/crud/DataTable'
import { Avatar } from '../../components/ui/Avatar'
import { StatusBadge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState, SearchBar } from '../../components/ui/Misc'
import { SegmentedTabs } from '../../components/ui/Tabs'
import { useRequests, useTeams } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import type { MemberRequest, RequestStatus } from '../../models'
import { formatDate } from '../../utils/date'
import { matchesQuery } from '../../utils/misc'

type Tab = RequestStatus | 'todas'

/** Fila de pedidos de cadastro enviados pela tela pública. Clicar abre a análise. */
export function RequestsPage() {
  const navigate = useNavigate()
  const { items } = useRequests()
  const { items: teams } = useTeams()
  const [tab, setTab] = useState<Tab>('pendente')
  const [query, setQuery] = useState('')

  const teamNames = (request: MemberRequest) =>
    request.teamIds.map((id) => teams.find((t) => t.id === id)?.name).filter(Boolean) as string[]
  const sentOn = (request: MemberRequest) => (request.createdAt ? formatDate(request.createdAt.slice(0, 10)) : '—')

  const counts = useMemo(
    () => ({
      pendente: items.filter((r) => r.status === 'pendente').length,
      aprovada: items.filter((r) => r.status === 'aprovada').length,
      recusada: items.filter((r) => r.status === 'recusada').length,
      todas: items.length,
    }),
    [items],
  )

  const visible = items
    .filter((r) => tab === 'todas' || r.status === tab)
    .filter((r) => matchesQuery(query, r.fullName, r.phone, r.email, ...teamNames(r)))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

  const open = (request: MemberRequest) => navigate(`/solicitacoes/${encodeURIComponent(request.id)}`)

  return (
    <Page title="Solicitações de Cadastro" subtitle="Analise os pedidos de novos membros" icon={UserPlus}>
      <div className="space-y-4">
        <SegmentedTabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { key: 'pendente', label: 'Pendentes', icon: Clock, count: counts.pendente },
            { key: 'aprovada', label: 'Aprovadas', icon: CheckCheck, count: counts.aprovada },
            { key: 'recusada', label: 'Recusadas', icon: XCircle, count: counts.recusada },
            { key: 'todas', label: 'Todas', icon: ListFilter, count: counts.todas },
          ]}
        />
        <SearchBar value={query} onChange={setQuery} placeholder="Buscar por nome, contato ou equipe…" />

        {visible.length === 0 ? (
          <EmptyState
            icon={query ? SearchX : UserPlus}
            title={query ? 'Nada encontrado' : tab === 'pendente' ? 'Nenhuma solicitação pendente' : 'Nenhuma solicitação nesta lista'}
            description={
              tab === 'pendente' && !query
                ? 'Quando alguém fizer o cadastro pela tela inicial, o pedido aparece aqui.'
                : undefined
            }
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <DataTable
                items={visible}
                rowKey={(r) => r.id}
                onRowClick={open}
                columns={[
                  {
                    header: 'Nome',
                    sortValue: (r) => r.fullName,
                    cell: (r) => (
                      <div className="flex items-center gap-3">
                        <Avatar name={r.fullName} size="sm" />
                        <span className="font-medium text-navy-900">{r.fullName}</span>
                      </div>
                    ),
                  },
                  {
                    header: 'Contato',
                    cell: (r) => (
                      <div>
                        <p>{r.phone}</p>
                        {r.email && <p className="text-xs text-muted">{r.email}</p>}
                      </div>
                    ),
                  },
                  { header: 'Equipes de interesse', cell: (r) => teamNames(r).join(', ') || <span className="text-muted">Nenhuma</span> },
                  { header: 'Enviada em', sortValue: (r) => r.createdAt ?? '', cell: sentOn },
                  { header: 'Situação', sortValue: (r) => r.status, cell: (r) => <StatusBadge kind="request" value={r.status} /> },
                ]}
                actions={() => <ChevronRight className="size-5 text-royal-600" />}
              />
            </div>
            <ul className="space-y-3 lg:hidden">
              {visible.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => open(r)} className="block w-full text-left">
                    <Card className="flex items-start gap-3 p-4">
                      <Avatar name={r.fullName} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-navy-900">{r.fullName}</span>
                          <StatusBadge kind="request" value={r.status} />
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">{r.phone}</span>
                        <span className="mt-1.5 block text-xs text-muted">
                          Enviada em {sentOn(r)}
                          {teamNames(r).length > 0 && ` • ${teamNames(r).join(', ')}`}
                        </span>
                      </span>
                    </Card>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Page>
  )
}
