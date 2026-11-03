import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { Pencil, Plus, SearchX, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { ActionKey, Entity, ModuleKey, NewEntity } from '../../models'
import type { CrudService } from '../../services'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { useCollection } from '../../hooks/useCollection'
import { Page } from '../../layouts/PageMeta'
import { matchesQuery } from '../../utils/misc'
import { DataTable } from './DataTable'
import type { Column } from './DataTable'
import { FormPage } from '../forms/FormPage'
import type { FieldDef, Values } from '../forms/types'
import { Button, IconButton } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState, Fab, FilterMenu, SearchBar } from '../ui/Misc'
import type { FilterDef } from '../ui/Misc'

export interface CardView {
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  badge?: ReactNode
  leading?: ReactNode
}

export interface CrudFilter<T> extends FilterDef {
  predicate(item: T, value: string): boolean
}

interface CrudPageProps<T extends Entity> {
  module: ModuleKey
  /**
   * Endereço da lista (ex.: "/usuarios"). O cadastro abre em `${basePath}/novo` e a edição em
   * `${basePath}/:id/editar`, como telas separadas; a rota precisa terminar em "/*".
   */
  basePath: string
  title: string
  subtitle: string
  icon: LucideIcon
  service: CrudService<T>
  /** "Membro", "Equipe"... usado nos títulos e mensagens. */
  entityLabel: string
  feminine?: boolean
  columns: Column<T>[]
  card(item: T): CardView
  /** Campos do formulário padrão (ignorado quando `formPage` é informado). */
  fields?: FieldDef[]
  defaultValues?: Values
  /** Tela de cadastro/edição própria, no lugar do formulário padrão. `item` vem vazio no cadastro. */
  formPage?(args: { item?: T; backTo: string }): ReactNode
  searchText(item: T): Array<string | undefined>
  filters?: CrudFilter<T>[]
  /** Ordena a lista; padrão: ordem de cadastro. */
  sortBy?(a: T, b: T): number
  toForm?(item: T): Values
  fromForm?(values: Values, editing?: T): NewEntity<T>
  validate?(values: Values, editing?: T): Record<string, string> | undefined
  canDelete?(item: T): boolean
  /** Texto de aviso mostrado na confirmação de exclusão. */
  deleteWarning?(item: T): Promise<string | undefined> | string | undefined
  rowActions?(item: T): ReactNode
  toolbar?: ReactNode
  header?: ReactNode
  newLabel?: string
  /** Quantos cards mostrar de uma vez no celular. */
  cardPage?: number
}

export function CrudPage<T extends Entity>({
  module,
  basePath,
  title,
  subtitle,
  icon,
  service,
  entityLabel,
  feminine,
  columns,
  card,
  fields = [],
  defaultValues = {},
  formPage,
  searchText,
  filters = [],
  sortBy,
  toForm,
  fromForm,
  validate,
  canDelete,
  deleteWarning,
  rowActions,
  toolbar,
  header,
  newLabel,
  cardPage = 20,
}: CrudPageProps<T>) {
  const { can: allowed, inScope, scope } = useAuth()
  // quem só enxerga equipes ou departamentos específicos consulta os departamentos dele, mas não os altera
  const readOnlyScope = module === 'departamentos' && !scope.all && scope.reach !== 'departamento'
  const can = (m: ModuleKey, action?: ActionKey) => allowed(m, action) && !(readOnlyScope && action && action !== 'view')
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { items, loading } = useCollection(service.repo)

  const [query, setQuery] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [visibleCards, setVisibleCards] = useState(cardPage)

  const the = feminine ? 'a' : 'o'
  const createLabel = newLabel ?? `${feminine ? 'Nova' : 'Novo'} ${entityLabel}`

  // A tela depende do endereço: lista, `/novo` ou `/:id/editar`.
  const tail = pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length + 1).replace(/\/$/, '') : ''
  const editId = tail.endsWith('/editar') ? decodeURIComponent(tail.slice(0, -'/editar'.length)) : null
  const mode = tail === 'novo' ? 'new' : editId ? 'edit' : 'list'
  const editing = editId ? items.find((item) => item.id === editId) : undefined

  const goNew = () => navigate(`${basePath}/novo`)
  const goEdit = (item: T) => navigate(`${basePath}/${encodeURIComponent(item.id)}/editar`)

  const initialValues = (item: T | null): Values => (item ? (toForm ? toForm(item) : { ...item }) : defaultValues)

  const save = async (values: Values) => {
    const payload = fromForm ? fromForm(values, editing) : (values as NewEntity<T>)
    if (mode === 'new') {
      await service.create(payload)
      toast.success(`${entityLabel} cadastrad${the} com sucesso.`)
    } else if (editing) {
      await service.update(editing.id, payload)
      toast.success(`${entityLabel} atualizad${the} com sucesso.`)
    }
  }

  const remove = async (item: T) => {
    const warning = await deleteWarning?.(item)
    const ok = await confirm({
      title: `Excluir ${entityLabel.toLowerCase()}?`,
      message: (
        <>
          <p>
            Você está prestes a excluir <strong className="text-navy-900">{service.nameOf(item)}</strong>. Esta ação não pode ser desfeita.
          </p>
          {warning && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-900">{warning}</p>}
        </>
      ),
    })
    if (!ok) return
    try {
      await service.remove(item.id)
      toast.success(`${entityLabel} excluíd${the}.`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  if (mode !== 'list') {
    if (!can(module, mode === 'new' ? 'create' : 'edit')) return <Navigate to={basePath} replace />
    if (mode === 'edit' && (!editing || !inScope(module, editing))) return loading ? null : <Navigate to={basePath} replace />
    if (formPage) return <Fragment key={editing?.id ?? 'new'}>{formPage({ item: editing, backTo: basePath })}</Fragment>
    return (
      <FormPage
        key={editing?.id ?? 'new'}
        backTo={basePath}
        icon={icon}
        title={mode === 'new' ? createLabel : `Editar ${entityLabel.toLowerCase()}`}
        subtitle={editing ? service.nameOf(editing) : title}
        fields={fields}
        initialValues={initialValues(editing ?? null)}
        validate={(values) => validate?.(values, editing)}
        onSubmit={save}
      />
    )
  }

  const filtered = items.filter(
    (item) =>
      inScope(module, item) &&
      matchesQuery(query, ...searchText(item)) &&
      filters.every((f) => !filterValues[f.key] || f.predicate(item, filterValues[f.key])),
  )
  const visible = sortBy ? [...filtered].sort(sortBy) : filtered

  const canEdit = can(module, 'edit')
  const canRemove = (item: T) => can(module, 'delete') && (!canDelete || canDelete(item))
  const hasActions = (item: T) => Boolean(rowActions) || canEdit || canRemove(item)

  const actions = (item: T) => (
    <>
      {rowActions?.(item)}
      {canEdit && <IconButton icon={Pencil} label="Editar" onClick={() => goEdit(item)} />}
      {canRemove(item) && <IconButton icon={Trash2} label="Excluir" tone="danger" onClick={() => remove(item)} />}
    </>
  )

  const filtering = query !== '' || Object.values(filterValues).some(Boolean)

  return (
    <Page title={title} subtitle={subtitle} icon={icon}>
      <div className="space-y-4">
        {header}
        <SearchBar value={query} onChange={setQuery} placeholder={`Buscar ${entityLabel.toLowerCase()}…`}>
          <FilterMenu
            filters={filters}
            values={filterValues}
            onChange={(key, value) => setFilterValues((current) => ({ ...current, [key]: value }))}
          />
          {toolbar}
          {can(module, 'create') && (
            <div className="hidden lg:block">
              <Button icon={Plus} onClick={goNew}>
                {createLabel}
              </Button>
            </div>
          )}
        </SearchBar>

        {loading ? null : visible.length === 0 ? (
          <EmptyState
            icon={filtering ? SearchX : icon}
            title={filtering ? 'Nada encontrado' : `Nenhum${feminine ? 'a' : ''} ${entityLabel.toLowerCase()} cadastrad${the}`}
            description={
              filtering
                ? 'Tente outra busca ou limpe os filtros.'
                : can(module, 'create')
                  ? `Use o botão “${createLabel}” para começar.`
                  : undefined
            }
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <DataTable
                items={visible}
                columns={columns}
                rowKey={(item) => item.id}
                actions={visible.some(hasActions) ? actions : undefined}
                onRowClick={canEdit ? goEdit : undefined}
              />
            </div>
            <div className="space-y-3 lg:hidden">
              {visible.slice(0, visibleCards).map((item) => {
                const view = card(item)
                return (
                  <Card key={item.id} className="p-4">
                    <button
                      type="button"
                      disabled={!canEdit}
                      className="flex w-full items-start gap-3 text-left disabled:cursor-default"
                      onClick={() => goEdit(item)}
                    >
                      {view.leading}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-navy-900">{view.title}</span>
                          {view.badge}
                        </span>
                        {view.subtitle && <span className="mt-0.5 block text-sm text-muted">{view.subtitle}</span>}
                        {view.meta && <span className="mt-1.5 block text-xs text-muted">{view.meta}</span>}
                      </span>
                    </button>
                    {hasActions(item) && (
                      <div className="mt-2 flex justify-end gap-0.5 border-t border-line pt-2">{actions(item)}</div>
                    )}
                  </Card>
                )
              })}
              {visible.length > visibleCards && (
                <Button variant="outline" className="w-full" onClick={() => setVisibleCards((n) => n + cardPage)}>
                  Mostrar mais ({visible.length - visibleCards})
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {can(module, 'create') && <Fab label={createLabel} onClick={goNew} />}
    </Page>
  )
}
