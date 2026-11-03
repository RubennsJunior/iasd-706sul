import { useMemo, useState } from 'react'
import { UserPlus, Users, X } from 'lucide-react'
import type { ID, Team } from '../../models'
import type { Option } from '../../utils/labels'
import { cn } from '../../utils/misc'
import { CheckboxList } from '../forms/Controls'
import { Button } from '../ui/Button'

type Mode = 'equipe' | 'manual'

const MODES: { key: Mode; label: string; icon: typeof Users }[] = [
  { key: 'equipe', label: 'Por equipe', icon: Users },
  { key: 'manual', label: 'Manualmente', icon: UserPlus },
]

interface ParticipantPickerProps {
  value: ID[]
  onChange(value: ID[]): void
  /** Membros que podem participar (já sem os inativos). */
  memberOptions: Option[]
  teams: Team[]
  initialMode?: Mode
}

/**
 * Escolha dos participantes de um evento: de uma vez só pela equipe (todos os integrantes entram)
 * ou um a um. As duas formas alteram a mesma lista, então dá para combinar e ajustar depois.
 */
export function ParticipantPicker({ value, onChange, memberOptions, teams, initialMode = 'equipe' }: ParticipantPickerProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const selected = useMemo(() => new Set(value), [value])
  const nameOf = useMemo(() => new Map(memberOptions.map((o) => [o.value, o.label])), [memberOptions])

  const rows = useMemo(
    () =>
      teams
        .filter((team) => team.status === 'ativa')
        .map((team) => {
          const ids = [...new Set([...team.memberIds, ...(team.leaderId ? [team.leaderId] : [])])].filter((id) => nameOf.has(id))
          return { team, ids, inside: ids.filter((id) => selected.has(id)).length }
        })
        .filter((row) => row.ids.length > 0),
    [teams, nameOf, selected],
  )

  const addTeam = (ids: ID[]) => onChange([...new Set([...value, ...ids])])
  const removeTeam = (ids: ID[]) => onChange(value.filter((id) => !ids.includes(id)))
  const people = value.filter((id) => nameOf.has(id))

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Como adicionar participantes" className="inline-flex rounded-full bg-royal-50 p-1">
        {MODES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              mode === key ? 'bg-navy-900 text-white shadow-sm' : 'text-navy-800 hover:bg-white',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {mode === 'equipe' ? (
        <>
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
              Nenhuma equipe ativa com integrantes. Use a opção “Manualmente”.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map(({ team, ids, inside }) => (
                <li key={team.id} className="flex items-center gap-3 rounded-2xl border border-line bg-royal-50/40 p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-navy-800">
                    <Users className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy-900">{team.name}</span>
                    <span className="block text-xs text-muted">
                      {ids.length} integrante{ids.length === 1 ? '' : 's'}
                      {inside > 0 && ` · ${inside} já incluído${inside === 1 ? '' : 's'}`}
                    </span>
                  </span>
                  {inside === ids.length ? (
                    <Button size="sm" variant="outline" icon={X} onClick={() => removeTeam(ids)} aria-label={`Remover equipe ${team.name}`}>
                      Remover
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => addTeam(ids)} aria-label={`Adicionar equipe ${team.name}`}>
                      Adicionar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-navy-900">Participantes selecionados ({people.length})</p>
              {people.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="text-xs font-medium text-royal-600 hover:underline">
                  Limpar todos
                </button>
              )}
            </div>
            {people.length === 0 ? (
              <p className="text-sm text-muted">Ninguém selecionado ainda.</p>
            ) : (
              <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {people.map((id) => (
                  <li key={id} className="inline-flex items-center gap-1 rounded-full bg-royal-50 py-1 pl-3 pr-1.5 text-xs font-medium text-navy-900">
                    {nameOf.get(id)}
                    <button
                      type="button"
                      aria-label={`Remover ${nameOf.get(id)}`}
                      onClick={() => onChange(value.filter((v) => v !== id))}
                      className="grid size-5 place-items-center rounded-full text-navy-800 hover:bg-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <CheckboxList options={memberOptions} value={value} onChange={onChange} searchable />
      )}
    </div>
  )
}
