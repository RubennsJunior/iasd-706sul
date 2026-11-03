import { AlertTriangle, Plus, Trash2, Users } from 'lucide-react'
import type { RosterAssignment } from '../../models'
import { ASSIGNMENT_STATUS_OPTIONS } from '../../utils/labels'
import type { Option } from '../../utils/labels'
import { controlClass } from '../forms/Controls'
import { Select } from '../forms/Select'
import { Button, IconButton } from '../ui/Button'

interface AssignmentsEditorProps {
  value: RosterAssignment[]
  onChange(value: RosterAssignment[]): void
  memberOptions: Option[]
  /** Mensagem de conflito por membro (ex.: já escalado no mesmo horário). */
  warnings: Record<string, string>
  onFillFromTeam?(): void
  error?: string
}

export function AssignmentsEditor({ value, onChange, memberOptions, warnings, onFillFromTeam, error }: AssignmentsEditorProps) {
  const update = (index: number, patch: Partial<RosterAssignment>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  return (
    <div className="space-y-2.5">
      {value.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
          Nenhum integrante escalado ainda.
        </p>
      )}
      {value.map((row, index) => (
        <div key={index} className="space-y-1.5 rounded-2xl border border-line bg-royal-50/40 p-3">
          <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto_auto] sm:items-center">
            <Select
              aria-label="Integrante"
              value={row.memberId}
              onChange={(memberId) => update(index, { memberId })}
              options={memberOptions}
              placeholder="Selecione o integrante…"
            />
            <input
              aria-label="Função"
              value={row.role}
              onChange={(e) => update(index, { role: e.target.value })}
              placeholder="Função (ex.: Vocal)"
              className={controlClass()}
            />
            <Select
              aria-label="Situação"
              value={row.status}
              onChange={(status) => update(index, { status: status as RosterAssignment['status'] })}
              options={ASSIGNMENT_STATUS_OPTIONS}
            />
            <IconButton
              icon={Trash2}
              label="Remover integrante"
              tone="danger"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="justify-self-end"
            />
          </div>
          {row.memberId && warnings[row.memberId] && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="size-3.5 shrink-0" />
              {warnings[row.memberId]}
            </p>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={Plus}
          onClick={() => onChange([...value, { memberId: '', role: '', status: 'pendente' }])}
        >
          Adicionar integrante
        </Button>
        {onFillFromTeam && (
          <Button size="sm" variant="outline" icon={Users} onClick={onFillFromTeam}>
            Incluir integrantes da equipe
          </Button>
        )}
      </div>
    </div>
  )
}
