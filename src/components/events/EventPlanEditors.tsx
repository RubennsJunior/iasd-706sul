import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { EventAction, EventDynamic, EventLiturgyItem, EventScheduleItem } from '../../models'
import { moveItem } from '../../services/eventPlan'
import { LITURGY_KINDS } from '../../utils/labels'
import type { Option } from '../../utils/labels'
import { cn, uid } from '../../utils/misc'
import { controlClass } from '../forms/Controls'
import { Select } from '../forms/Select'
import { Button, IconButton } from '../ui/Button'

/* Editores das listas do evento. Cada um recebe a lista atual e devolve a nova inteira; o formulário só guarda o valor. */

/**
 * No celular cada linha é uma grade de duas colunas: o primeiro campo e os botões (subir, descer, remover) ficam juntos
 * no topo e os demais campos ocupam a largura toda. Do `sm` para cima valem a ordem do documento e as colunas de cada editor.
 */
const rowClass = 'grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-line bg-royal-50/40 p-3 sm:items-center'
const first = 'order-1 sm:order-none'
const controls = 'order-2 sm:order-none'
const second = 'order-3 col-span-2 sm:order-none sm:col-span-1'
const third = 'order-4 col-span-2 sm:order-none sm:col-span-1'
const rest = 'order-5 col-span-2 sm:order-none'
const rest2 = 'order-6 col-span-2 sm:order-none'

function Frame({
  empty,
  isEmpty,
  addLabel,
  onAdd,
  children,
}: {
  empty: string
  isEmpty: boolean
  addLabel: string
  onAdd(): void
  children: ReactNode
}) {
  return (
    <div className="space-y-2.5">
      {isEmpty && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">{empty}</p>}
      {children}
      <Button size="sm" variant="secondary" icon={Plus} onClick={onAdd}>
        {addLabel}
      </Button>
    </div>
  )
}

function RowControls({
  index,
  count,
  onMove,
  onRemove,
  what,
  orderClass = controls,
}: {
  index: number
  count: number
  onMove?(delta: -1 | 1): void
  onRemove(): void
  what: string
  orderClass?: string
}) {
  return (
    <div className={`flex items-center justify-self-end ${orderClass}`}>
      {onMove && (
        <>
          <IconButton icon={ArrowUp} label={`Subir ${what}`} disabled={index === 0} onClick={() => onMove(-1)} />
          <IconButton icon={ArrowDown} label={`Descer ${what}`} disabled={index === count - 1} onClick={() => onMove(1)} />
        </>
      )}
      <IconButton icon={Trash2} label={`Remover ${what}`} tone="danger" onClick={onRemove} />
    </div>
  )
}

const numberOrUndefined = (raw: string) => (raw.trim() === '' ? undefined : Number(raw))

/** Campo numérico com a unidade escrita dentro ("vagas", "min"), para o valor nunca ficar sem explicação. */
function NumberField({
  value,
  onChange,
  label,
  placeholder,
  suffix,
  className,
}: {
  value?: number
  onChange(value: number | undefined): void
  label: string
  placeholder: string
  suffix: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange(numberOrUndefined(e.target.value))}
        placeholder={placeholder}
        className={`${controlClass()} pr-14 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-muted">
        {suffix}
      </span>
    </div>
  )
}

function MemberSelect({ value, onChange, options }: { value?: string; onChange(value: string | undefined): void; options: Option[] }) {
  return (
    <div className={third}>
      <Select
        aria-label="Responsável"
        value={value ?? ''}
        onChange={(responsibleId) => onChange(responsibleId || undefined)}
        options={options}
        emptyOption="Sem responsável"
      />
    </div>
  )
}

interface EditorProps<T> {
  value: T[]
  onChange(value: T[]): void
  memberOptions: Option[]
}

export function ScheduleEditor({ value, onChange, memberOptions }: EditorProps<EventScheduleItem>) {
  const update = (index: number, patch: Partial<EventScheduleItem>) => onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  return (
    <Frame
      isEmpty={value.length === 0}
      empty="Nenhum momento no cronograma. Adicione o que acontece em cada horário do evento."
      addLabel="Adicionar horário"
      onAdd={() => onChange([...value, { id: uid('cron'), time: '', title: '' }])}
    >
      {value.map((item, index) => (
        <div key={item.id} className={`${rowClass} sm:grid-cols-[110px_1.6fr_1.2fr_auto]`}>
          <input
            type="time"
            aria-label="Horário"
            value={item.time}
            onChange={(e) => update(index, { time: e.target.value })}
            className={`${controlClass()} ${first}`}
          />
          <input
            aria-label="O que acontece neste horário"
            value={item.title}
            onChange={(e) => update(index, { title: e.target.value })}
            placeholder="Ex.: Recepção e boas-vindas"
            className={`${controlClass()} ${second}`}
          />
          <MemberSelect value={item.responsibleId} onChange={(responsibleId) => update(index, { responsibleId })} options={memberOptions} />
          <RowControls index={index} count={value.length} what="horário" onRemove={() => onChange(value.filter((_, i) => i !== index))} />
          <input
            aria-label="Observações do horário"
            value={item.notes ?? ''}
            onChange={(e) => update(index, { notes: e.target.value })}
            placeholder="Observações (opcional)"
            className={`${controlClass()} ${rest} sm:col-span-4`}
          />
        </div>
      ))}
    </Frame>
  )
}

export function LiturgyEditor({ value, onChange, memberOptions }: EditorProps<EventLiturgyItem>) {
  const update = (index: number, patch: Partial<EventLiturgyItem>) => onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  return (
    <Frame
      isEmpty={value.length === 0}
      empty="Nenhum item na liturgia. Monte a ordem do culto ou da programação: hinos, orações, leituras, mensagem…"
      addLabel="Adicionar item da liturgia"
      onAdd={() => onChange([...value, { id: uid('lit'), kind: LITURGY_KINDS[0].value, title: '' }])}
    >
      {value.map((item, index) => (
        <div key={item.id} className={`${rowClass} sm:grid-cols-[160px_1.6fr_1.2fr_auto]`}>
          <div className={first}>
            <Select aria-label="Tipo do item" value={item.kind} onChange={(kind) => update(index, { kind })} options={LITURGY_KINDS} />
          </div>
          <input
            aria-label="Título do item da liturgia"
            value={item.title}
            onChange={(e) => update(index, { title: e.target.value })}
            placeholder="Ex.: Hino 12 — Castelo Forte"
            className={`${controlClass()} ${second}`}
          />
          <MemberSelect value={item.responsibleId} onChange={(responsibleId) => update(index, { responsibleId })} options={memberOptions} />
          <RowControls
            index={index}
            count={value.length}
            what="item"
            onMove={(delta) => onChange(moveItem(value, index, delta))}
            onRemove={() => onChange(value.filter((_, i) => i !== index))}
          />
          <input
            aria-label="Detalhes do item"
            value={item.details ?? ''}
            onChange={(e) => update(index, { details: e.target.value })}
            placeholder="Detalhes (opcional): texto bíblico, tom, observações…"
            className={`${controlClass()} ${rest} sm:col-span-4`}
          />
        </div>
      ))}
    </Frame>
  )
}

export function DynamicsEditor({ value, onChange, memberOptions }: EditorProps<EventDynamic>) {
  const update = (index: number, patch: Partial<EventDynamic>) => onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  return (
    <Frame
      isEmpty={value.length === 0}
      empty="Nenhuma dinâmica. Registre as atividades do evento: quebra-gelo, brincadeiras, jogos, trabalhos em grupo…"
      addLabel="Adicionar dinâmica"
      onAdd={() => onChange([...value, { id: uid('din'), title: '' }])}
    >
      {value.map((item, index) => (
        <div key={item.id} className={`${rowClass} sm:grid-cols-[1.6fr_110px_1.2fr_auto]`}>
          <input
            aria-label="Nome da dinâmica"
            value={item.title}
            onChange={(e) => update(index, { title: e.target.value })}
            placeholder="Ex.: Quebra-gelo em duplas"
            className={`${controlClass()} order-1 col-span-2 sm:order-none sm:col-span-1`}
          />
          <NumberField
            label="Duração em minutos"
            placeholder="Duração"
            suffix="min"
            value={item.minutes}
            onChange={(minutes) => update(index, { minutes })}
            className="order-2 sm:order-none"
          />
          <MemberSelect value={item.responsibleId} onChange={(responsibleId) => update(index, { responsibleId })} options={memberOptions} />
          <RowControls
            index={index}
            count={value.length}
            orderClass="order-3 sm:order-none"
            what="dinâmica"
            onMove={(delta) => onChange(moveItem(value, index, delta))}
            onRemove={() => onChange(value.filter((_, i) => i !== index))}
          />
          <textarea
            aria-label="Como funciona a dinâmica"
            rows={2}
            value={item.description ?? ''}
            onChange={(e) => update(index, { description: e.target.value })}
            placeholder="Como funciona (opcional)"
            className={`${controlClass()} ${rest} sm:col-span-4`}
          />
          <input
            aria-label="Materiais necessários"
            value={item.materials ?? ''}
            onChange={(e) => update(index, { materials: e.target.value })}
            placeholder="Materiais necessários (opcional)"
            className={`${controlClass()} ${rest2} sm:col-span-4`}
          />
        </div>
      ))}
    </Frame>
  )
}

export function ActionsEditor({ value, onChange }: Omit<EditorProps<EventAction>, 'memberOptions'>) {
  const update = (index: number, patch: Partial<EventAction>) => onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  return (
    <Frame
      isEmpty={value.length === 0}
      empty="Nenhuma ação. Crie ações para as pessoas escolherem, como “Levar um prato”, “Recepção” ou “Som e projeção”."
      addLabel="Adicionar ação"
      onAdd={() => onChange([...value, { id: uid('acao'), title: '', memberIds: [] }])}
    >
      {value.map((item, index) => (
        <div key={item.id} className={`${rowClass} sm:grid-cols-[1.8fr_130px_auto]`}>
          <input
            aria-label="Nome da ação"
            value={item.title}
            onChange={(e) => update(index, { title: e.target.value })}
            placeholder="Ex.: Levar um prato para o lanche"
            className={`${controlClass()} order-1 col-span-2 sm:order-none sm:col-span-1`}
          />
          <NumberField
            label="Vagas da ação"
            placeholder="Sem limite"
            suffix="vagas"
            value={item.slots}
            onChange={(slots) => update(index, { slots })}
            className="order-2 sm:order-none"
          />
          <RowControls
            index={index}
            count={value.length}
            orderClass="order-3 sm:order-none"
            what="ação"
            onMove={(delta) => onChange(moveItem(value, index, delta))}
            onRemove={() => onChange(value.filter((_, i) => i !== index))}
          />
          <input
            aria-label="Descrição da ação"
            value={item.description ?? ''}
            onChange={(e) => update(index, { description: e.target.value })}
            placeholder="Detalhes (opcional): o que precisa ser feito ou levado"
            className={`${controlClass()} order-4 col-span-2 sm:order-none sm:col-span-3`}
          />
          {item.memberIds.length > 0 && (
            <p className={`text-xs text-muted ${rest} sm:col-span-3`}>
              {item.memberIds.length === 1 ? '1 pessoa já escolheu' : `${item.memberIds.length} pessoas já escolheram`} esta ação. Quem escolheu é
              gerenciado na página do evento.
            </p>
          )}
        </div>
      ))}
    </Frame>
  )
}
