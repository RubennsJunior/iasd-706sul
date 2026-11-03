import { Check, Lock } from 'lucide-react'
import { ACTIONS, MODULES } from '../../models'
import type { ActionKey, ModuleKey, PermissionMatrix } from '../../models'
import { ACTION_LABELS, MODULE_LABELS, normalizeMatrix, permissionSet } from '../../models/permissions'
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
  const current = matrix[module] ?? permissionSet()
  let next = { ...current, [action]: checked }
  if (action === 'manage' && checked) next = permissionSet(...ACTIONS)
  if (action === 'view' && !checked) next = permissionSet()
  if (action !== 'view' && action !== 'manage' && checked) next.view = true
  if (action !== 'manage' && !checked) next.manage = false
  return { ...matrix, [module]: next }
}

// Largura das colunas no computador: módulo + uma coluna por ação
const COLUMNS = 'md:grid-cols-[minmax(9rem,1.6fr)_repeat(5,minmax(4rem,1fr))]'

export function PermissionMatrixEditor({ value: stored, onChange, readOnly }: Props) {
  // matrizes gravadas antes de um módulo existir não têm a entrada dele: o que falta aparece sem permissão
  const value = normalizeMatrix(stored)
  const columns = COLUMNS

  // No celular cada módulo vira um bloco com as ações lado a lado (nada fica fora da tela); do tamanho "md" em diante
  // as mesmas linhas formam a tabela de colunas.
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      {readOnly && (
        <p className="flex items-center gap-2 bg-gold-100/70 px-3 py-2 text-xs font-medium text-ink">
          <Lock className="size-3.5" /> Somente leitura.
        </p>
      )}
      <div className={cn('hidden gap-0 bg-royal-50 px-3 py-2.5 text-xs font-semibold text-navy-800 md:grid', columns)}>
        <span>Módulo</span>
        {ACTIONS.map((action) => (
          <span key={action} className="text-center">
            {ACTION_LABELS[action]}
          </span>
        ))}
      </div>
      <div className="divide-y divide-line">
        {MODULES.map((module) => (
          <div key={module} className={cn('grid gap-2 px-3 py-2.5 md:items-center md:gap-0', columns)}>
            <p className="wrap-anywhere text-sm font-semibold text-navy-900 md:font-medium md:text-ink">{MODULE_LABELS[module]}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:contents">
              {ACTIONS.map((action) => {
                const checked = value[module][action]
                return readOnly ? (
                  <span key={action} className="inline-flex items-center gap-1.5 text-xs text-ink md:justify-center">
                    <span
                      className={cn('inline-grid size-6 place-items-center rounded-md', checked ? 'bg-emerald-100 text-emerald-700' : 'text-slate-300')}
                      aria-label={checked ? 'Permitido' : 'Sem permissão'}
                    >
                      {checked ? <Check className="size-4" /> : '—'}
                    </span>
                    <span className="md:sr-only">{ACTION_LABELS[action]}</span>
                  </span>
                ) : (
                  <label key={action} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink md:justify-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      aria-label={`${ACTION_LABELS[action]} — ${MODULE_LABELS[module]}`}
                      onChange={(e) => onChange?.(updatePermission(value, module, action, e.target.checked))}
                      className="size-4 shrink-0 accent-navy-900"
                    />
                    <span aria-hidden="true" className="md:sr-only">
                      {ACTION_LABELS[action]}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
