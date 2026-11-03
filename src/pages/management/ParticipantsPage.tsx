import { useMemo, useState } from 'react'
import { Plus, SearchX, Trash2, UsersRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { DataTable } from '../../components/crud/DataTable'
import { Select } from '../../components/forms/Select'
import { Avatar } from '../../components/ui/Avatar'
import { StatusBadge } from '../../components/ui/Badge'
import { Button, IconButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, Fab, FilterMenu, SearchBar } from '../../components/ui/Misc'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { useEvents, useMemberNames } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import type { ParticipantStatus } from '../../models'
import { eventsService } from '../../services'
import { compareDateTime, formatDateShort } from '../../utils/date'
import { PARTICIPANT_STATUS_OPTIONS } from '../../utils/labels'
import { matchesQuery } from '../../utils/misc'

interface Row {
  key: string
  eventId: string
  eventTitle: string
  eventDate: string
  memberId: string
  status: ParticipantStatus
}

export function ParticipantsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { items: events } = useEvents()
  const { nameOf } = useMemberNames()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const navigate = useNavigate()

  const canCreate = can('participantes', 'create')
  const canEdit = can('participantes', 'edit')
  const canDelete = can('participantes', 'delete')

  const rows = useMemo<Row[]>(
    () =>
      [...events]
        .sort((a, b) => compareDateTime(b, a))
        .flatMap((e) =>
          e.participants.map((p) => ({
            key: `${e.id}:${p.memberId}`,
            eventId: e.id,
            eventTitle: e.title,
            eventDate: e.date,
            memberId: p.memberId,
            status: p.status,
          })),
        ),
    [events],
  )

  const visible = rows.filter(
    (r) =>
      (!filters.event || r.eventId === filters.event) &&
      (!filters.status || r.status === filters.status) &&
      matchesQuery(query, nameOf(r.memberId), r.eventTitle),
  )

  const totals = {
    all: rows.length,
    confirmed: rows.filter((r) => r.status === 'confirmado').length,
    present: rows.filter((r) => r.status === 'presente').length,
  }

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const remove = async (row: Row) => {
    const ok = await confirm({
      title: 'Remover participante?',
      message: `${nameOf(row.memberId)} será removido(a) de “${row.eventTitle}”.`,
      confirmLabel: 'Remover',
    })
    if (ok) await run(() => eventsService.removeParticipant(row.eventId, row.memberId), 'Participante removido.')
  }

  const statusControl = (row: Row) =>
    canEdit ? (
      <Select
        variant="pill"
        aria-label={`Situação de ${nameOf(row.memberId)}`}
        value={row.status}
        onChange={(status) =>
          void run(() => eventsService.setParticipantStatus(row.eventId, row.memberId, status as ParticipantStatus))
        }
        options={PARTICIPANT_STATUS_OPTIONS}
      />
    ) : (
      <StatusBadge kind="participant" value={row.status} />
    )


  return (
    <Page title="Participantes" subtitle="Visualize e gerencie participantes" icon={UsersRound}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Inscrições', totals.all],
            ['Confirmados', totals.confirmed],
            ['Presentes', totals.present],
          ].map(([label, value]) => (
            <Card key={label} className="px-3 py-3 text-center">
              <p className="text-2xl font-bold text-navy-900">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </Card>
          ))}
        </div>

        <SearchBar value={query} onChange={setQuery} placeholder="Buscar participante ou evento…">
          <FilterMenu
            filters={[
              { key: 'event', label: 'Evento', options: events.map((e) => ({ value: e.id, label: e.title })) },
              { key: 'status', label: 'Situação', options: PARTICIPANT_STATUS_OPTIONS },
            ]}
            values={filters}
            onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
          />
          {canCreate && (
            <div className="hidden lg:block">
              <Button icon={Plus} onClick={() => navigate('/participantes/novo')}>
                Novo Participante
              </Button>
            </div>
          )}
        </SearchBar>

        {visible.length === 0 ? (
          <EmptyState
            icon={query || filters.event || filters.status ? SearchX : UsersRound}
            title="Nenhum participante encontrado"
            description="Adicione participantes aos eventos para acompanhar as inscrições."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <DataTable
                items={visible}
                rowKey={(r) => r.key}
                columns={[
                  {
                    header: 'Participante',
                    sortValue: (r) => nameOf(r.memberId),
                    cell: (r) => (
                      <div className="flex items-center gap-3">
                        <Avatar name={nameOf(r.memberId)} size="sm" />
                        <span className="font-medium text-navy-900">{nameOf(r.memberId)}</span>
                      </div>
                    ),
                  },
                  {
                    header: 'Evento',
                    sortValue: (r) => r.eventTitle,
                    cell: (r) => (
                      <Link to={`/eventos/${r.eventId}`} className="font-medium text-royal-600 hover:underline">
                        {r.eventTitle}
                      </Link>
                    ),
                  },
                  { header: 'Data', sortValue: (r) => r.eventDate, cell: (r) => formatDateShort(r.eventDate) },
                  { header: 'Situação', sortValue: (r) => r.status, cell: statusControl },
                ]}
                actions={
                  canDelete
                    ? (r) => <IconButton icon={Trash2} label="Remover participante" tone="danger" onClick={() => remove(r)} />
                    : undefined
                }
              />
            </div>
            <ul className="space-y-3 lg:hidden">
              {visible.slice(0, 40).map((r) => (
                <li key={r.key}>
                  <Card className="flex items-center gap-3 p-3.5">
                    <Avatar name={nameOf(r.memberId)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-navy-900">{nameOf(r.memberId)}</p>
                      <Link to={`/eventos/${r.eventId}`} className="block truncate text-sm text-royal-600">
                        {r.eventTitle} • {formatDateShort(r.eventDate)}
                      </Link>
                      <div className="mt-1.5">{statusControl(r)}</div>
                    </div>
                    {canDelete && <IconButton icon={Trash2} label="Remover participante" tone="danger" onClick={() => remove(r)} />}
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {canCreate && <Fab label="Novo Participante" onClick={() => navigate('/participantes/novo')} />}
    </Page>
  )
}
