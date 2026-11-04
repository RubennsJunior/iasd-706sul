import type { ReactNode } from 'react'
import { BookOpen, CheckCircle2, Clock, HandHelping, ListChecks, Sparkles, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { useMemberNames } from '../../hooks/useData'
import type { ChurchEvent, EventAction } from '../../models'
import { acceptsActions, actionState, eventsService, planOf } from '../../services'
import { formatTime, todayISO } from '../../utils/date'
import { Select } from '../forms/Select'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, SectionHeader } from '../ui/Card'

/** Bloco de uma lista do evento: só aparece quando tem conteúdo; quem pode editar vê o convite para preencher. */
function Block({
  title,
  icon,
  count,
  canEdit,
  eventId,
  tab,
  emptyHint,
  children,
}: {
  title: string
  icon: typeof Clock
  count: number
  canEdit: boolean
  eventId: string
  tab: string
  emptyHint: string
  children: ReactNode
}) {
  if (count === 0 && !canEdit) return null
  return (
    <section aria-label={title}>
      <SectionHeader title={count > 0 ? `${title} (${count})` : title} icon={icon} />
      {count === 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted">
          <span>{emptyHint}</span>
          <Link to={`/eventos/${eventId}/editar?aba=${tab}`} className="font-semibold text-royal-600 hover:underline">
            Preencher
          </Link>
        </Card>
      ) : (
        children
      )}
    </section>
  )
}

function Responsible({ name }: { name: string }) {
  if (name === '—') return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <UserRound className="size-3.5 shrink-0" />
      <span className="wrap-anywhere">{name}</span>
    </span>
  )
}

function ActionCard({ event, action, canManage }: { event: ChurchEvent; action: EventAction; canManage: boolean }) {
  const toast = useToast()
  const { member, user, can } = useAuth()
  const { members, nameOf } = useMemberNames()
  const open = acceptsActions(event, todayISO())
  const state = actionState(action, member?.id)

  const run = async (work: () => Promise<unknown>, success?: string) => {
    try {
      await work()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  const set = (memberId: string, take: boolean, success?: string) =>
    run(() => eventsService.chooseAction(event.id, action.id, memberId, take), success)

  const candidates = members.filter((m) => m.status !== 'inativo' && !action.memberIds.includes(m.id))

  return (
    <li>
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="wrap-anywhere text-base font-semibold text-navy-900">{action.title}</h3>
            {action.description && <p className="wrap-anywhere mt-0.5 text-sm text-ink">{action.description}</p>}
          </div>
          <Badge tone={state.full ? 'warning' : 'info'}>
            {action.slots === undefined
              ? state.taken === 1
                ? '1 pessoa'
                : `${state.taken} pessoas`
              : state.full
                ? 'Vagas esgotadas'
                : `${state.taken} de ${action.slots} vagas`}
          </Badge>
        </div>

        {action.memberIds.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Quem escolheu">
            {action.memberIds.map((memberId) => (
              <li key={memberId} className="inline-flex items-center gap-1.5 rounded-full bg-royal-50 py-1 pl-1 pr-2.5 text-xs font-medium text-ink">
                <Avatar name={nameOf(memberId)} size="xs" />
                <span className="wrap-anywhere">{memberId === member?.id ? 'Você' : nameOf(memberId)}</span>
                {canManage && (
                  <button
                    type="button"
                    aria-label={`Remover ${nameOf(memberId)} desta ação`}
                    onClick={() => void set(memberId, false, 'Pessoa removida da ação.')}
                    className="grid size-4 place-items-center rounded-full text-red-600 hover:bg-red-50"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {member ? (
            state.mine ? (
              <Button size="sm" variant="outline" icon={X} onClick={() => void set(member.id, false, 'Você saiu desta ação.')}>
                Sair desta ação
              </Button>
            ) : (
              <Button
                size="sm"
                icon={HandHelping}
                disabled={!open || state.full}
                onClick={() => void set(member.id, true, 'Pronto! Você escolheu esta ação.')}
              >
                {!open ? 'Escolhas encerradas' : state.full ? 'Sem vagas' : 'Quero fazer'}
              </Button>
            )
          ) : (
            <p className="text-xs text-muted">
              Seu usuário ainda não está ligado a um cadastro de membro, e é por ele que se escolhe uma ação.{' '}
              {user && can('usuarios', 'edit') ? (
                <>
                  <Link to={`/usuarios/${encodeURIComponent(user.id)}/editar`} className="font-semibold text-royal-600 hover:underline">
                    Abrir meu usuário
                  </Link>{' '}
                  e salvar: o cadastro de membro é criado ou ligado na hora.
                </>
              ) : (
                'Peça à secretaria para ligar o seu usuário a um membro.'
              )}
            </p>
          )}
          {canManage && open && candidates.length > 0 && !state.full && (
            <div className="min-w-48 flex-1 sm:max-w-xs">
              <Select
                aria-label={`Adicionar pessoa em ${action.title}`}
                value=""
                onChange={(memberId) => memberId && void set(memberId, true, 'Pessoa adicionada à ação.')}
                options={candidates.map((m) => ({ value: m.id, label: m.fullName }))}
                placeholder="Adicionar pessoa…"
              />
            </div>
          )}
        </div>
      </Card>
    </li>
  )
}

/** Cronograma, liturgia, dinâmicas e ações do evento, na página de detalhes. */
export function EventPlanView({ event, canEdit }: { event: ChurchEvent; canEdit: boolean }) {
  const { nameOf } = useMemberNames()
  const plan = planOf(event)
  const block = { canEdit, eventId: event.id }

  return (
    <>
      <Block {...block} title="Cronograma" icon={Clock} count={plan.schedule.length} tab="cronograma" emptyHint="O cronograma deste evento ainda não foi preenchido.">
        <Card className="p-2">
          <ol className="divide-y divide-line">
            {plan.schedule.map((item) => (
              <li key={item.id} className="flex gap-3 px-3 py-3">
                <span className="mt-0.5 h-fit shrink-0 rounded-lg bg-navy-900 px-2 py-1 text-sm font-semibold tabular-nums text-white">
                  {formatTime(item.time)}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="wrap-anywhere font-semibold text-navy-900">{item.title}</p>
                  {item.notes && <p className="wrap-anywhere text-sm text-ink">{item.notes}</p>}
                  <Responsible name={nameOf(item.responsibleId)} />
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </Block>

      <Block {...block} title="Liturgia" icon={BookOpen} count={plan.liturgy.length} tab="liturgia" emptyHint="A liturgia deste evento ainda não foi preenchida.">
        <Card className="p-2">
          <ol className="divide-y divide-line">
            {plan.liturgy.map((item, index) => (
              <li key={item.id} className="flex gap-3 px-3 py-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-royal-50 text-sm font-semibold text-navy-900">{index + 1}</span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{item.kind}</Badge>
                    <p className="wrap-anywhere font-semibold text-navy-900">{item.title}</p>
                  </div>
                  {item.details && <p className="wrap-anywhere text-sm text-ink">{item.details}</p>}
                  <Responsible name={nameOf(item.responsibleId)} />
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </Block>

      <Block {...block} title="Dinâmicas" icon={Sparkles} count={plan.dynamics.length} tab="dinamicas" emptyHint="Nenhuma dinâmica cadastrada para este evento.">
        <ul className="space-y-2.5">
          {plan.dynamics.map((item) => (
            <li key={item.id}>
              <Card className="space-y-1.5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="wrap-anywhere min-w-0 flex-1 text-base font-semibold text-navy-900">{item.title}</h3>
                  {item.minutes && <Badge tone="gold" icon={Clock}>{item.minutes} min</Badge>}
                </div>
                {item.description && <p className="wrap-anywhere whitespace-pre-line text-sm text-ink">{item.description}</p>}
                {item.materials && (
                  <p className="wrap-anywhere text-sm text-ink">
                    <span className="font-semibold text-navy-900">Materiais: </span>
                    {item.materials}
                  </p>
                )}
                <Responsible name={nameOf(item.responsibleId)} />
              </Card>
            </li>
          ))}
        </ul>
      </Block>

      <Block {...block} title="Ações do evento" icon={ListChecks} count={plan.actions.length} tab="acoes" emptyHint="Nenhuma ação para escolher neste evento.">
        <>
          <p className="-mt-1 mb-2.5 flex items-center gap-1.5 text-sm text-muted">
            <CheckCircle2 className="size-4 shrink-0" /> Escolha a ação que você vai fazer neste evento.
          </p>
          <ul className="space-y-2.5">
            {plan.actions.map((action) => (
              <ActionCard key={action.id} event={event} action={action} canManage={canEdit} />
            ))}
          </ul>
        </>
      </Block>
    </>
  )
}
