import { Check, Lock } from 'lucide-react'
import { ACTIONS, MODULES } from '../../models'
import type { ActionKey, ModuleKey, PermissionMatrix } from '../../models'
import { ACTION_LABELS, MODULE_LABELS, permissionSet } from '../../models/permissions'
import { cn } from '../../utils/misc'

interface Props {
  value: PermissionMatrix
  onChange?(value: PermissionMatrix): void
  /** Somente leitura (perfil do administrador ou consulta de permissões efetivas). */
  readOnly?: boolean
}

/** Marcar "Gerenciar" libera tudo; marcar qualquer ação libera também "Visualizar". */
export function updatePermission(
  matrix: PermissionMatrix,
  module: ModuleKey,
  action: ActionKey,
  checked: boolean,
): PermissionMatrix {
  const current = matrix[module]
  let next = { ...current, [action]: checked }
  if (action === 'manage' && checked) next = permissionSet(...ACTIONS)
  if (action === 'view' && !checked) next = permissionSet()
  if (action !== 'view' && action !== 'manage' && checked) next.view = true
  if (action !== 'manage' && !checked) next.manage = false
  return { ...matrix, [module]: next }
}

export function PermissionMatrixEditor({ value, onChange, readOnly }: Props) {
  const toggleRow = (module: ModuleKey) => {
    const all = ACTIONS.every((a) => value[module][a])
    onChange?.({ ...value, [module]: permissionSet(...(all ? [] : ACTIONS)) })
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      {readOnly && (
        <p className="flex items-center gap-2 bg-gold-100/70 px-3 py-2 text-xs font-medium text-ink">
          <Lock className="size-3.5" /> Somente leitura.
        </p>
      )}
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-royal-50 text-xs text-navy-800">
          <tr>
            <th className="px-3 py-2.5 text-left font-semibold">Módulo</th>
            {ACTIONS.map((action) => (
              <th key={action} className="px-2 py-2.5 text-center font-semibold">
                {ACTION_LABELS[action]}
              </th>
            ))}
            {!readOnly && <th className="px-2 py-2.5 text-center font-semibold">Tudo</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {MODULES.map((module) => (
            <tr key={module}>
              <th scope="row" className="px-3 py-2 text-left font-medium text-ink">
                {MODULE_LABELS[module]}
              </th>
              {ACTIONS.map((action) => {
                const checked = value[module][action]
                return (
                  <td key={action} className="px-2 py-2 text-center">
                    {readOnly ? (
                      <span
                        className={cn('inline-grid size-6 place-items-center rounded-md', checked ? 'bg-emerald-100 text-emerald-700' : 'text-slate-300')}
                        aria-label={checked ? 'Permitido' : 'Sem permissão'}
                      >
                        {checked ? <Check className="size-4" /> : '—'}
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={checked}
                        aria-label={`${ACTION_LABELS[action]} — ${MODULE_LABELS[module]}`}
                        onChange={(e) => onChange?.(updatePermission(value, module, action, e.target.checked))}
                        className="size-4 accent-navy-900"
                      />
                    )}
                  </td>
                )
              })}
              {!readOnly && (
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => toggleRow(module)}
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-royal-600 hover:bg-royal-50"
                  >
                    {ACTIONS.every((a) => value[module][a]) ? 'Limpar' : 'Marcar'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
