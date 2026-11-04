import { useState } from 'react'
import { AlertTriangle, CheckCircle2, MessageCircle, Phone, Trash2, UserPlus, XCircle } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CheckboxList, FieldWrapper, controlClass } from '../../components/forms/Controls'
import { Select } from '../../components/forms/Select'
import { Avatar } from '../../components/ui/Avatar'
import { StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { useMembers, useRequests, useTeams } from '../../hooks/useData'
import { Page } from '../../layouts/PageMeta'
import type { MemberRequest, MemberStatus } from '../../models'
import { requestsService, sameEmail } from '../../services'
import { ageFrom, formatDate } from '../../utils/date'
import { MEMBER_STATUS_OPTIONS } from '../../utils/labels'

const BACK = '/solicitacoes'

const whatsapp = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-ink">{children || '—'}</dd>
    </div>
  )
}

function Decision({ request, approveBlocked }: { request: MemberRequest; approveBlocked: boolean }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items: teams } = useTeams()
  const [status, setStatus] = useState<MemberStatus>(request.baptized ? 'ativo' : 'visitante')
  const [teamIds, setTeamIds] = useState<string[]>(request.teamIds)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const reviewer = user?.name ?? 'Sistema'

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await action()
      toast.success(success)
      navigate(BACK, { replace: true })
    } catch (error) {
      toast.error(errorMessage(error))
      setBusy(false)
    }
  }

  const options = teams
    .filter((t) => t.status === 'ativa' || request.teamIds.includes(t.id))
    .map((t) => ({ value: t.id, label: request.teamIds.includes(t.id) ? `${t.name} (pedido pela pessoa)` : t.name }))

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <SectionHeader title="Decisão" icon={UserPlus} />
      {rejecting ? (
        <div className="space-y-3">
          <FieldWrapper id="reject-reason" label="Motivo da recusa" required hint="Fica registrado para consulta da secretaria.">
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={controlClass()}
              autoFocus
            />
          </FieldWrapper>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setRejecting(false)} disabled={busy}>
              Voltar
            </Button>
            <Button
              variant="danger"
              icon={XCircle}
              loading={busy}
              onClick={() => run(() => requestsService.reject(request.id, reason, reviewer), 'Solicitação recusada.')}
            >
              Confirmar recusa
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldWrapper id="member-status" label="Situação do novo membro" hint="Quem ainda não é batizado entra como visitante.">
              <Select id="member-status" value={status} onChange={(v) => setStatus(v as MemberStatus)} options={MEMBER_STATUS_OPTIONS} />
            </FieldWrapper>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-navy-900">Equipes que o membro vai integrar</p>
              <CheckboxList options={options} value={teamIds} onChange={setTeamIds} emptyText="Nenhuma equipe ativa." />
              <p className="mt-1 text-xs text-muted">Marque só as equipes confirmadas com a pessoa. Pode deixar em branco.</p>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" icon={XCircle} onClick={() => setRejecting(true)} disabled={busy}>
              Recusar
            </Button>
            <Button
              icon={CheckCircle2}
              loading={busy}
              disabled={approveBlocked}
              onClick={() =>
                run(() => requestsService.approve(request.id, { teamIds, status }, reviewer), `${request.fullName} agora é membro.`)
              }
            >
              Aprovar e cadastrar membro
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

/** Análise de uma solicitação: dados enviados, contato rápido e decisão (aprovar cria o membro). */
export function RequestReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { items, loading } = useRequests()
  const { items: teams } = useTeams()
  const { items: members } = useMembers()

  const request = items.find((r) => r.id === id)
  if (!request) return loading ? null : <Navigate to={BACK} replace />
  const duplicate = request.email ? members.find((m) => m.email && sameEmail(m.email, request.email)) : undefined

  const teamNames = request.teamIds.map((teamId) => teams.find((t) => t.id === teamId)?.name).filter(Boolean)
  const age = ageFrom(request.birthDate)
  const canDecide = can('membros', 'create') && request.status === 'pendente'

  const remove = async () => {
    const ok = await confirm({
      title: 'Excluir solicitação?',
      message: `O registro do pedido de ${request.fullName} será apagado. O membro já cadastrado, se houver, não é afetado.`,
    })
    if (!ok) return
    try {
      await requestsService.remove(request.id)
      toast.success('Solicitação excluída.')
      navigate(BACK, { replace: true })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Page title="Analisar solicitação" subtitle={request.fullName} icon={UserPlus} back={BACK}>
      <div className="mx-auto max-w-4xl space-y-4">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={request.fullName} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-navy-900">{request.fullName}</h2>
              <p className="text-sm text-muted">
                Enviada em {request.createdAt ? formatDate(request.createdAt.slice(0, 10)) : '—'}
              </p>
            </div>
            <StatusBadge kind="request" value={request.status} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`tel:${request.phone.replace(/\D/g, '')}`}>
              <Button size="sm" variant="outline" icon={Phone}>
                Ligar
              </Button>
            </a>
            <a href={whatsapp(request.phone)} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" icon={MessageCircle}>
                WhatsApp
              </Button>
            </a>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-2">
            <Row label="Telefone">{request.phone}</Row>
            <Row label="E-mail">{request.email}</Row>
            <Row label="Nascimento">
              {request.birthDate ? `${formatDate(request.birthDate)}${age !== null ? ` (${age} anos)` : ''}` : ''}
            </Row>
            <Row label="Batismo">
              {request.baptized ? `Batizado(a)${request.baptismDate ? ` em ${formatDate(request.baptismDate)}` : ''}` : 'Ainda não é batizado(a)'}
            </Row>
            <div className="sm:col-span-2">
              <Row label="Endereço">{request.address}</Row>
            </div>
            <div className="sm:col-span-2">
              <Row label="Equipes de interesse">{teamNames.join(', ')}</Row>
            </div>
            <div className="sm:col-span-2">
              <Row label="Recado">{request.message}</Row>
            </div>
          </dl>
        </Card>

        {request.status === 'pendente' && duplicate && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Este e-mail já está cadastrado</p>
              <p className="wrap-anywhere">
                {duplicate.fullName} já é membro com o e-mail {request.email}. Para não cadastrar a mesma pessoa duas vezes, recuse esta
                solicitação (ou corrija o e-mail do cadastro existente).
              </p>
              {can('membros', 'edit') && (
                <Link to={`/membros/${encodeURIComponent(duplicate.id)}/editar`} className="mt-1 inline-block font-semibold underline">
                  Abrir o cadastro de {duplicate.fullName}
                </Link>
              )}
            </div>
          </div>
        )}

        {canDecide && <Decision request={request} approveBlocked={Boolean(duplicate)} />}

        {request.status !== 'pendente' && (
          <Card className="space-y-2 p-5 text-sm text-ink">
            <p className="font-semibold text-navy-900">
              {request.status === 'aprovada' ? 'Solicitação aprovada' : 'Solicitação recusada'}
            </p>
            <p>
              Por {request.reviewedBy ?? '—'}
              {request.reviewedAt && ` em ${formatDate(request.reviewedAt.slice(0, 10))}`}.
            </p>
            {request.status === 'recusada' && request.reason && <p>Motivo: {request.reason}</p>}
            {request.status === 'aprovada' && request.memberId && can('membros', 'edit') && (
              <Link to={`/membros/${encodeURIComponent(request.memberId)}/editar`} className="inline-block font-semibold text-royal-600 hover:underline">
                Abrir o cadastro do membro
              </Link>
            )}
          </Card>
        )}

        {request.status !== 'pendente' && can('membros', 'delete') && (
          <div className="flex justify-end">
            <Button variant="outline" icon={Trash2} className="text-red-600" onClick={remove}>
              Excluir solicitação
            </Button>
          </div>
        )}
      </div>
    </Page>
  )
}
