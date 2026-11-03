import { useMemo } from 'react'
import { CalendarCheck } from 'lucide-react'
import { Navigate, useParams } from 'react-router-dom'
import { FormPage } from '../../components/forms/FormPage'
import { Select } from '../../components/forms/Select'
import type { FieldDef, Values } from '../../components/forms/types'
import { AssignmentsEditor } from '../../components/rosters/AssignmentsEditor'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useEvents, useMemberNames, useRosters, useTeams, useWorshipServices } from '../../hooks/useData'
import type { RosterAssignment } from '../../models'
import { findRosterConflicts, rostersService } from '../../services'
import { compareDateTime, formatDateShort, todayISO } from '../../utils/date'

const BACK = '/escalas?aba=todas'

/** Cadastro (`/escalas/nova`) e edição (`/escalas/:id/editar`) de escala. */
export function RosterFormPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const toast = useToast()
  const { members, nameOf } = useMemberNames()
  const { items: teams } = useTeams()
  const { items: events } = useEvents()
  const { items: services } = useWorshipServices()
  const { items: rosters, loading } = useRosters()

  const roster = id ? rosters.find((r) => r.id === id) : undefined

  const memberOptions = useMemo(
    () => members.filter((m) => m.status !== 'inativo').map((m) => ({ value: m.id, label: m.fullName })),
    [members],
  )

  const linkables = useMemo(() => {
    const today = todayISO()
    return [
      ...events
        .filter((e) => e.date >= today && e.status !== 'cancelado')
        .map((e) => ({ key: `evento:${e.id}`, label: `Evento: ${e.title} — ${formatDateShort(e.date)}`, item: e })),
      ...services
        .filter((s) => s.date >= today)
        .map((s) => ({ key: `culto:${s.id}`, label: `Culto: ${s.title} — ${formatDateShort(s.date)}`, item: s })),
    ].sort((a, b) => compareDateTime(a.item, b.item))
  }, [events, services])

  if (!can('escalas', id ? 'edit' : 'create')) return <Navigate to="/escalas" replace />
  if (id && !roster) return loading ? null : <Navigate to="/escalas" replace />

  const teamOptions = teams.filter((t) => t.status === 'ativa').map((t) => ({ value: t.id, label: t.name }))

  const fields: FieldDef[] = [
    { name: 'teamId', label: 'Equipe', type: 'select', required: true, span: 2, options: teamOptions },
    {
      name: 'linked',
      label: 'Vincular a evento ou culto (opcional)',
      type: 'custom',
      render: ({ value, onChange, setValues }) => (
        <Select
          aria-label="Vincular a evento ou culto"
          value={(value as string) ?? ''}
          onChange={(key) => {
            onChange(key)
            const match = linkables.find((l) => l.key === key)
            if (match) {
              setValues({
                title: `Escala — ${match.item.title}`,
                date: match.item.date,
                time: match.item.time,
                location: match.item.location,
              })
            }
          }}
          options={linkables.map((l) => ({ value: l.key, label: l.label }))}
          emptyOption="Sem vínculo"
        />
      ),
    },
    { name: 'title', label: 'Título da escala', type: 'text', required: true, span: 2 },
    { name: 'date', label: 'Data', type: 'date', required: true },
    { name: 'time', label: 'Horário', type: 'time', required: true },
    { name: 'location', label: 'Local', type: 'text', span: 2 },
    {
      name: 'assignments',
      label: 'Integrantes escalados',
      type: 'custom',
      render: ({ value, onChange, values, error }) => {
        const rows = (value as RosterAssignment[]) ?? []
        const team = teams.find((t) => t.id === values.teamId)
        const warnings: Record<string, string> = {}
        const problems = findRosterConflicts(
          { id: roster?.id, date: values.date, time: values.time, assignments: rows },
          rosters,
          nameOf,
        )
        for (const row of rows) {
          const text = problems.find((p) => p.startsWith(nameOf(row.memberId)))
          if (text) warnings[row.memberId] = text
        }
        return (
          <AssignmentsEditor
            value={rows}
            onChange={onChange}
            memberOptions={memberOptions}
            warnings={warnings}
            error={error}
            onFillFromTeam={
              team
                ? () => {
                    const have = new Set(rows.map((r) => r.memberId))
                    const extra: RosterAssignment[] = team.memberIds
                      .filter((memberId) => !have.has(memberId))
                      .map((memberId) => ({ memberId, role: 'Integrante', status: 'pendente' }))
                    onChange([...rows, ...extra])
                  }
                : undefined
            }
          />
        )
      },
    },
    { name: 'notes', label: 'Observações', type: 'textarea', rows: 2 },
  ]

  const initialValues: Values = roster
    ? { ...roster, linked: roster.linked ?? '' }
    : {
        teamId: teamOptions.length === 1 ? teamOptions[0].value : '',
        linked: '',
        title: '',
        date: todayISO(),
        time: '19:00',
        location: '',
        assignments: [],
        notes: '',
      }

  const submit = async (values: Values) => {
    const assignments = (values.assignments as RosterAssignment[])
      .filter((a) => a.memberId)
      .map((a) => ({ ...a, role: a.role.trim() || 'Integrante' }))
    const payload = {
      title: String(values.title).trim(),
      date: values.date as string,
      time: values.time as string,
      location: String(values.location ?? '').trim(),
      teamId: values.teamId as string,
      linked: (values.linked as string) || undefined,
      notes: String(values.notes ?? '').trim(),
      assignments,
    }
    if (roster) await rostersService.update(roster.id, payload)
    else await rostersService.create(payload)
    toast.success(roster ? 'Escala atualizada com sucesso.' : 'Escala criada. Os integrantes foram avisados.')
  }

  return (
    <FormPage
      key={roster?.id ?? 'new'}
      backTo={BACK}
      icon={CalendarCheck}
      title={roster ? 'Editar escala' : 'Nova escala'}
      subtitle={roster?.title ?? 'Monte a escala da equipe'}
      fields={fields}
      initialValues={initialValues}
      validate={(values) =>
        (values.assignments as RosterAssignment[]).some((a) => a.memberId)
          ? undefined
          : { assignments: 'Inclua ao menos um integrante.' }
      }
      onSubmit={submit}
    />
  )
}
