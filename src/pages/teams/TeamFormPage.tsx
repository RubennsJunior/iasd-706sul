import { useMemo } from 'react'
import { UsersRound } from 'lucide-react'
import { Navigate, useParams } from 'react-router-dom'
import { FormPage } from '../../components/forms/FormPage'
import type { FieldDef, Values } from '../../components/forms/types'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDepartments, useMemberNames, useTeams } from '../../hooks/useData'
import type { ActiveStatus } from '../../models'
import { teamsService } from '../../services'
import { todayISO } from '../../utils/date'
import { ACTIVE_STATUS_OPTIONS, TEAM_ICON_OPTIONS } from '../../utils/labels'

/** Cadastro (`/equipes/nova`) e edição (`/equipes/:id/editar`) de equipe. */
export function TeamFormPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const toast = useToast()
  const { items: teams, loading } = useTeams()
  const { items: departments } = useDepartments()
  const { members } = useMemberNames()

  const team = id ? teams.find((t) => t.id === id) : undefined

  const memberOptions = useMemo(
    () => members.filter((m) => m.status !== 'inativo').map((m) => ({ value: m.id, label: m.fullName })),
    [members],
  )

  const backTo = id ? `/equipes/${id}` : '/equipes'
  if (!can('equipes', id ? 'edit' : 'create')) return <Navigate to="/equipes" replace />
  if (id && !team) return loading ? null : <Navigate to="/equipes" replace />

  const fields: FieldDef[] = [
    { name: 'name', label: 'Nome da equipe', type: 'text', required: true, span: 2 },
    { name: 'description', label: 'Descrição', type: 'textarea', rows: 2 },
    {
      name: 'departmentId',
      label: 'Departamento',
      type: 'select',
      required: true,
      options: departments.map((d) => ({ value: d.id, label: d.name })),
    },
    { name: 'leaderId', label: 'Líder responsável', type: 'select', options: memberOptions, emptyOption: 'Sem líder' },
    { name: 'foundedAt', label: 'Data de criação', type: 'date', required: true },
    { name: 'status', label: 'Situação', type: 'select', required: true, options: ACTIVE_STATUS_OPTIONS },
    { name: 'icon', label: 'Ícone', type: 'select', required: true, options: TEAM_ICON_OPTIONS },
    {
      name: 'memberIds',
      label: 'Integrantes',
      type: 'multiselect',
      options: memberOptions,
      hint: 'O líder responsável é incluído automaticamente.',
    },
  ]

  const initialValues: Values = team
    ? { ...team, departmentId: team.departmentId ?? '', leaderId: team.leaderId ?? '' }
    : {
        name: '',
        description: '',
        departmentId: '',
        leaderId: '',
        foundedAt: todayISO(),
        status: 'ativa',
        icon: 'users',
        memberIds: [],
      }

  const submit = async (values: Values) => {
    const leaderId = (values.leaderId as string) || undefined
    const memberIds = new Set<string>(values.memberIds as string[])
    if (leaderId) memberIds.add(leaderId)
    const payload = {
      name: String(values.name).trim(),
      description: String(values.description ?? '').trim(),
      departmentId: (values.departmentId as string) || undefined,
      leaderId,
      memberIds: [...memberIds],
      foundedAt: values.foundedAt as string,
      status: values.status as ActiveStatus,
      icon: values.icon as string,
    }
    if (team) await teamsService.update(team.id, payload)
    else await teamsService.create(payload)
    toast.success(team ? 'Equipe atualizada com sucesso.' : 'Equipe cadastrada com sucesso.')
  }

  return (
    <FormPage
      key={team?.id ?? 'new'}
      backTo={backTo}
      icon={UsersRound}
      title={team ? 'Editar equipe' : 'Nova equipe'}
      subtitle={team?.name ?? 'Preencha os dados da equipe'}
      fields={fields}
      initialValues={initialValues}
      onSubmit={submit}
    />
  )
}
