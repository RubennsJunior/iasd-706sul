import type { ReactNode } from 'react'
import type { Option } from '../../utils/labels'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Values = Record<string, any>

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'password'
  | 'date'
  | 'time'
  | 'number'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'switch'
  | 'custom'

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  hint?: string
  options?: Option[]
  /** Opções que dependem de outros campos do formulário. */
  optionsFor?(values: Values): Option[]
  /** Aba onde o campo aparece (quando o formulário tem abas); padrão: a primeira. */
  tab?: string
  /** Título do bloco de campos; um novo título abre um novo bloco. */
  section?: string
  /** 2 ocupa a linha inteira em telas largas. */
  span?: 1 | 2
  rows?: number
  min?: number
  max?: number
  emptyOption?: string
  /** Mostra o valor, mas não deixa alterar. */
  readOnly?: boolean
  showIf?(values: Values): boolean
  validate?(value: unknown, values: Values): string | undefined
  /** Controle próprio, para campos que não são simples (ex.: lista de itens). */
  render?(props: {
    value: unknown
    onChange(value: unknown): void
    values: Values
    /** Altera vários campos de uma vez (ex.: preencher data e local ao escolher um evento). */
    setValues(patch: Values): void
    error?: string
  }): ReactNode
}

export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}
