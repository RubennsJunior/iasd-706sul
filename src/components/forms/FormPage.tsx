import { Fragment, useId, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../layouts/PageMeta'
import { cn, isValidEmail } from '../../utils/misc'
import { errorMessage } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { SegmentedTabs } from '../ui/Tabs'
import type { TabItem } from '../ui/Tabs'
import { CheckboxList, FieldWrapper, GrowingText, Switch, controlClass } from './Controls'
import { Select } from './Select'
import { isEmpty } from './types'
import type { FieldDef, Values } from './types'

export type FormTab = TabItem

interface FormPageProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  /** Tela de consulta para onde voltar ao cancelar ou salvar. */
  backTo: string
  /** Para onde ir depois de salvar, quando for diferente de `backTo`. */
  afterSave?: string
  fields: FieldDef[]
  initialValues: Values
  /** Divide os campos em abas (`FieldDef.tab`). */
  tabs?: FormTab[]
  initialTab?: string
  /** Faixa acima das abas, que acompanha o que está sendo digitado. */
  header?(values: Values): ReactNode
  submitLabel?: string
  /** Regras que dependem de mais de um campo. Retorne { campo: 'mensagem' }. */
  validate?(values: Values): Record<string, string> | undefined
  /** Salva os dados; lance Error para mostrar a mensagem no formulário. Ao concluir, volta para `backTo`. */
  onSubmit(values: Values): Promise<void>
}

/** Tela própria de cadastro/edição, aberta no lugar da tela de consulta. */
export function FormPage({
  title,
  subtitle,
  icon,
  backTo,
  afterSave,
  fields,
  initialValues,
  tabs,
  initialTab,
  header,
  submitLabel = 'Salvar',
  validate,
  onSubmit,
}: FormPageProps) {
  const formId = useId()
  const navigate = useNavigate()
  const [values, setValues] = useState<Values>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(
    tabs?.some((t) => t.key === initialTab) ? (initialTab as string) : (tabs?.[0]?.key ?? ''),
  )

  const visibleFields = fields.filter((f) => !f.showIf || f.showIf(values))
  const tabOf = (field: FieldDef) => field.tab ?? tabs?.[0]?.key ?? ''
  // Só os campos da aba aberta aparecem, mas a validação olha o formulário inteiro.
  const shownFields = tabs ? visibleFields.filter((f) => tabOf(f) === activeTab) : visibleFields

  const setValue = (name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }))
    if (errors[name]) setErrors((current) => ({ ...current, [name]: '' }))
  }

  const runValidation = () => {
    const found: Record<string, string> = {}
    for (const field of visibleFields) {
      const value = values[field.name]
      if (field.required && isEmpty(value) && field.type !== 'switch') {
        found[field.name] = 'Campo obrigatório.'
      } else if (field.type === 'email' && !isEmpty(value) && !isValidEmail(String(value))) {
        found[field.name] = 'Informe um e-mail válido.'
      } else if (field.validate) {
        const message = field.validate(value, values)
        if (message) found[field.name] = message
      }
    }
    return { ...found, ...(Object.keys(found).length === 0 ? (validate?.(values) ?? {}) : {}) }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError('')
    const found = runValidation()
    setErrors(found)
    const firstError = Object.keys(found)[0]
    if (firstError) {
      const field = visibleFields.find((f) => f.name === firstError)
      if (tabs && field) setActiveTab(tabOf(field))
      window.setTimeout(() => document.getElementById(`${formId}-${firstError}`)?.focus(), 0)
      return
    }
    setSaving(true)
    try {
      await onSubmit(values)
      navigate(afterSave ?? backTo, { replace: true })
    } catch (error) {
      setFormError(errorMessage(error))
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const renderField = (field: FieldDef) => {
        const id = `${formId}-${field.name}`
        const value = values[field.name]
        const error = errors[field.name]
        const span =
          field.span === 2 || field.type === 'textarea' || field.type === 'multiselect' || field.type === 'custom'
        const wrapperClass = cn(span && 'sm:col-span-2')

        if (field.type === 'switch') {
          return (
            <div key={field.name} className={wrapperClass}>
              <div
                className={cn(
                  'flex items-center justify-between gap-4 rounded-xl border px-3.5 py-3',
                  error ? 'border-red-400' : 'border-line',
                )}
              >
                <div>
                  <span className="block text-sm font-medium text-navy-900">{field.label}</span>
                  {field.hint && <span className="text-xs text-muted">{field.hint}</span>}
                </div>
                <Switch checked={Boolean(value)} onChange={(v) => setValue(field.name, v)} label={field.label} />
              </div>
              {error && (
                <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                  {error}
                </p>
              )}
            </div>
          )
        }

        const options = field.optionsFor ? field.optionsFor(values) : (field.options ?? [])
        let control
        if (field.type === 'custom' && field.render) {
          control = field.render({
            value,
            onChange: (v) => setValue(field.name, v),
            values,
            setValues: (patch) => setValues((current) => ({ ...current, ...patch })),
            error,
          })
        } else if (field.type === 'textarea') {
          control = (
            <textarea
              id={id}
              rows={field.rows ?? 3}
              value={(value as string) ?? ''}
              placeholder={field.placeholder}
              onChange={(event) => setValue(field.name, event.target.value)}
              className={controlClass(error)}
            />
          )
        } else if (field.type === 'text') {
          control = (
            <GrowingText
              id={id}
              value={(value as string) ?? ''}
              placeholder={field.placeholder}
              disabled={field.readOnly}
              onChange={(v) => setValue(field.name, v)}
              error={error}
            />
          )
        } else if (field.type === 'select') {
          control = (
            <Select
              id={id}
              value={(value as string) ?? ''}
              onChange={(v) => setValue(field.name, v)}
              options={options}
              placeholder={field.emptyOption ?? 'Selecione…'}
              // campo obrigatório não precisa da opção vazia na lista
              emptyOption={field.required ? undefined : (field.emptyOption ?? 'Selecione…')}
              error={error}
            />
          )
        } else if (field.type === 'multiselect') {
          control = (
            <CheckboxList
              options={options}
              value={(value as string[]) ?? []}
              onChange={(v) => setValue(field.name, v)}
            />
          )
        } else {
          control = (
            <input
              id={id}
              type={field.type}
              value={(value as string | number) ?? ''}
              placeholder={field.placeholder}
              disabled={field.readOnly}
              min={field.min}
              max={field.max}
              autoComplete={field.type === 'password' ? 'new-password' : 'off'}
              onChange={(event) => setValue(field.name, event.target.value)}
              className={controlClass(error)}
            />
          )
        }

        return (
          <FieldWrapper
            key={field.name}
            id={id}
            label={field.label}
            required={field.required}
            hint={field.hint}
            error={error}
            className={wrapperClass}
          >
            {control}
          </FieldWrapper>
        )
  }

  return (
    <Page title={title} subtitle={subtitle} icon={icon} back={backTo}>
      <div className="mx-auto max-w-4xl space-y-4">
      {header?.(values)}
      {tabs && tabs.length > 1 && (
        <SegmentedTabs items={tabs} value={activeTab} onChange={setActiveTab} className="lg:max-w-md" />
      )}
      <Card className="p-5 sm:p-7">
        <form id={formId} onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800 sm:col-span-2"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {formError}
            </div>
          )}
          {shownFields.map((field, index) => (
            <Fragment key={field.name}>
              {field.section && field.section !== shownFields[index - 1]?.section && (
                <h2
                  className={cn(
                    'border-b border-line pb-2 text-base font-semibold text-navy-900 sm:col-span-2',
                    index > 0 && 'mt-3',
                  )}
                >
                  {field.section}
                </h2>
              )}
              {renderField(field)}
            </Fragment>
          ))}
        </form>

        <div className="mt-7 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => navigate(backTo)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {submitLabel}
          </Button>
        </div>
      </Card>
      </div>
    </Page>
  )
}
