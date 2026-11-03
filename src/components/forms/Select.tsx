import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn, matchesQuery } from '../../utils/misc'
import type { Option } from '../../utils/labels'
import { controlClass } from './Controls'

interface SelectProps {
  value: string
  onChange(value: string): void
  options: Option[]
  /** Acrescenta uma opção com valor vazio (ex.: "Sem responsável", "Todos"). */
  emptyOption?: string
  /** Texto exibido quando nada está selecionado. */
  placeholder?: string
  id?: string
  disabled?: boolean
  error?: string
  className?: string
  'aria-label'?: string
  /** `field` ocupa a largura do formulário; `pill` é a versão compacta, em formato de pílula. */
  variant?: 'field' | 'pill'
  /** Mostra uma busca no topo da lista; por padrão, só com mais de 10 opções. */
  searchable?: boolean
}

const MAX_HEIGHT = 320
const GAP = 6
const MARGIN = 8

/**
 * Lista suspensa própria no lugar do `<select>` nativo, cujo painel de opções não aceita estilo:
 * campo e painel compartilham o mesmo desenho (cantos arredondados, cores e tamanhos).
 */
export function Select({
  value,
  onChange,
  options,
  emptyOption,
  placeholder = 'Selecione…',
  id,
  disabled,
  error,
  className,
  variant = 'field',
  searchable,
  'aria-label': ariaLabel,
}: SelectProps) {
  const listId = `${useId()}-list`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState<CSSProperties | null>(null)

  const items = useMemo(
    () => (emptyOption === undefined ? options : [{ value: '', label: emptyOption }, ...options]),
    [options, emptyOption],
  )
  const showSearch = searchable ?? options.length > 10
  const visible = useMemo(
    () => (showSearch && query ? items.filter((o) => matchesQuery(query, o.label)) : items),
    [items, query, showSearch],
  )
  const selected = items.find((o) => o.value === value)
  const pill = variant === 'pill'

  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom - MARGIN - GAP
    const above = rect.top - MARGIN - GAP
    const down = below >= Math.min(MAX_HEIGHT, 200) || below >= above
    const room = Math.max(120, Math.min(MAX_HEIGHT, down ? below : above))
    const vertical = down ? { top: rect.bottom + GAP } : { bottom: window.innerHeight - rect.top + GAP }
    setPosition(
      pill
        ? { ...vertical, right: Math.max(MARGIN, window.innerWidth - rect.right), minWidth: Math.max(rect.width, 176), maxWidth: window.innerWidth - 2 * MARGIN, maxHeight: room }
        : { ...vertical, left: Math.max(MARGIN, rect.left), width: rect.width, maxWidth: window.innerWidth - 2 * MARGIN, maxHeight: room },
    )
  }, [pill])

  const openList = () => {
    if (disabled) return
    setQuery('')
    setActive(Math.max(0, items.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  const closeList = useCallback(() => {
    setOpen(false)
    setPosition(null)
  }, [])

  const pick = (option?: Option) => {
    if (!option) return
    onChange(option.value)
    closeList()
    triggerRef.current?.focus()
  }

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !popupRef.current?.contains(target)) closeList()
    }
    // Escape (teclado ou botão Voltar do Android) fecha só a lista, sem fechar a janela por trás.
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      event.preventDefault()
      closeList()
      triggerRef.current?.focus()
    }
    const onScroll = (event: Event) => {
      if (!popupRef.current?.contains(event.target as Node)) place()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onEscape, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onEscape, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, place, closeList])

  // Com mouse a busca já recebe o foco; no toque ela só abre o teclado se a pessoa tocar nela.
  useEffect(() => {
    if (open && position && showSearch && window.matchMedia('(pointer: fine)').matches) searchRef.current?.focus()
  }, [open, position, showSearch])

  // Mantém a opção ativa visível ao navegar pelo teclado.
  useEffect(() => {
    const list = listRef.current
    const row = list?.children[active] as HTMLElement | undefined
    if (!open || !list || !row) return
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight
    }
  }, [open, active, position])

  const onKeyDown = (event: KeyboardEvent) => {
    const onTrigger = event.target === triggerRef.current
    if (!open) {
      if (onTrigger && ['ArrowDown', 'ArrowUp', ' '].includes(event.key)) {
        event.preventDefault()
        openList()
      }
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive((i) => Math.min(visible.length - 1, i + 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((i) => Math.max(0, i - 1))
        break
      case 'Home':
        if (onTrigger) {
          event.preventDefault()
          setActive(0)
        }
        break
      case 'End':
        if (onTrigger) {
          event.preventDefault()
          setActive(visible.length - 1)
        }
        break
      case 'Enter':
        event.preventDefault()
        pick(visible[active])
        break
      case ' ':
        if (onTrigger) {
          event.preventDefault()
          pick(visible[active])
        }
        break
      case 'Tab':
        closeList()
        break
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && visible[active] ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKeyDown}
        // a barra de espaço também aciona o clique ao soltar a tecla; o teclado já tratou o evento
        onKeyUp={(event) => event.key === ' ' && event.preventDefault()}
        className={cn(
          // min-w-0: dentro de uma linha flexível o campo pode encolher abaixo da largura do texto (que quebra em linhas)
          pill
            ? 'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-line bg-white py-1.5 pl-3 pr-2.5 text-xs font-medium text-ink transition-colors hover:bg-royal-50 focus-visible:border-royal-500 disabled:opacity-60'
            : cn(controlClass(error), 'flex min-w-0 items-center justify-between gap-2 text-left disabled:cursor-not-allowed'),
          open && (pill ? 'border-royal-500 bg-royal-50' : 'border-royal-500 ring-2 ring-royal-100'),
          className,
        )}
      >
        {/* o texto escolhido quebra em mais de uma linha em vez de ser cortado com "…" */}
        <span className={cn('min-w-0 flex-1 wrap-anywhere', !selected && 'text-muted')}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn('shrink-0 text-muted transition-transform', pill ? 'size-3.5' : 'size-4', open && 'rotate-180')} />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={popupRef}
            data-select-popup
            style={{ position: 'fixed', zIndex: 80, ...position }}
            className="anim-fade flex flex-col overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-float"
          >
            {showSearch && (
              <label className="mb-1.5 flex items-center gap-2 rounded-xl border border-line bg-page px-3 py-2">
                <Search className="size-4 shrink-0 text-muted" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActive(0)
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Buscar…"
                  aria-label="Buscar opção"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                />
              </label>
            )}
            <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className="relative min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
              {visible.length === 0 && <li className="px-3 py-3 text-sm text-muted">Nenhum resultado.</li>}
              {visible.map((option, index) => {
                const isSelected = option.value === value
                return (
                  <li
                    key={option.value || '__vazio'}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-active={index === active}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(option)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 text-ink transition-colors',
                      pill ? 'rounded-full px-3.5 py-2 text-xs font-medium' : 'rounded-xl px-3 py-2.5 text-sm',
                      index === active && 'bg-royal-50',
                      isSelected && 'font-semibold text-navy-900',
                      !option.value && !isSelected && 'text-muted',
                    )}
                  >
                    <span className="min-w-0 break-words">{option.label}</span>
                    {isSelected && <Check className="size-4 shrink-0 text-royal-600" />}
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
