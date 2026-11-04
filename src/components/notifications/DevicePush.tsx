import { useCallback, useEffect, useState } from 'react'
import { BellOff, BellRing, CheckCircle2, Share, Smartphone } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { cloudEnabled } from '../../lib/firebase'
import { disablePush, enablePush, getPushState, testPush } from '../../lib/push'
import type { PushState } from '../../lib/push'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  )
}

/** Cartão "Notificações neste aparelho": liga, desliga e explica o que fazer em cada situação (Android, iPhone, navegador). */
export function DevicePush() {
  const { user } = useAuth()
  const toast = useToast()
  const uid = user?.id
  const [state, setState] = useState<PushState | undefined>()
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!uid) return
    try {
      setState(await getPushState(uid))
    } catch {
      setState({ kind: 'unsupported', reason: 'Não foi possível verificar as notificações deste aparelho.' })
    }
  }, [uid])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!cloudEnabled || !uid) return null

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true)
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  const on = state?.kind === 'on'

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <span className={`grid size-12 shrink-0 place-items-center rounded-full text-white ${on ? 'bg-emerald-600' : 'bg-navy-900'}`}>
          {on ? <CheckCircle2 className="size-6" /> : state?.kind === 'blocked' ? <BellOff className="size-6" /> : <BellRing className="size-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-navy-900">Notificações neste aparelho</h2>
          {!state && <p className="text-sm text-muted">Verificando…</p>}
          {state?.kind === 'on' && <p className="text-sm text-ink">Ativadas. Os avisos da igreja aparecem aqui mesmo com o aplicativo fechado.</p>}
          {state?.kind === 'off' && (
            <p className="text-sm text-ink">Receba os avisos da igreja (eventos, escalas, orações e comunicados) na tela do aparelho, mesmo com o aplicativo fechado.</p>
          )}
          {state?.kind === 'unsupported' && <p className="text-sm text-ink">{state.reason}</p>}
          {state?.kind === 'blocked' && <p className="text-sm text-ink">As notificações estão bloqueadas para o IASD neste aparelho. Libere e depois toque em “Verificar de novo”.</p>}
          {state?.kind === 'install-ios' && (
            <p className="text-sm text-ink">No iPhone e no iPad as notificações funcionam com o aplicativo instalado na tela de início (iOS 16.4 ou mais novo).</p>
          )}
        </div>
      </div>

      {state?.kind === 'install-ios' && (
        <div className="rounded-xl bg-royal-50 p-3.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <Smartphone className="size-4" /> Como instalar
          </p>
          <Steps
            items={[
              'No Safari, toque no botão Compartilhar (o quadrado com a seta para cima).',
              'Escolha “Adicionar à Tela de Início” e confirme.',
              'Abra o IASD pelo ícone novo, entre na sua conta e volte a esta tela para ativar.',
            ]}
          />
        </div>
      )}

      {state?.kind === 'blocked' && (
        <div className="rounded-xl bg-royal-50 p-3.5">
          <p className="text-sm font-semibold text-navy-900">Como liberar</p>
          <Steps
            items={[
              'Aplicativo Android: Configurações do Android → Apps → IASD → Notificações → Permitir.',
              'iPhone (app na tela de início): Ajustes → Notificações → IASD → Permitir notificações.',
              'Navegador: toque no cadeado ao lado do endereço → Permissões → Notificações → Permitir.',
            ]}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {state?.kind === 'off' && (
          <Button icon={BellRing} loading={busy} onClick={() => void run(() => enablePush(uid))}>
            Ativar notificações
          </Button>
        )}
        {state?.kind === 'on' && (
          <>
            {'Notification' in window && (
              <Button variant="secondary" size="sm" loading={busy} onClick={() => void run(testPush)}>
                Enviar um teste
              </Button>
            )}
            <Button variant="outline" size="sm" icon={BellOff} loading={busy} onClick={() => void run(() => disablePush(uid), 'Notificações desativadas neste aparelho.')}>
              Desativar
            </Button>
          </>
        )}
        {(state?.kind === 'blocked' || state?.kind === 'install-ios') && (
          <Button variant="secondary" size="sm" icon={state.kind === 'install-ios' ? Share : undefined} loading={busy} onClick={() => void run(async () => undefined)}>
            Verificar de novo
          </Button>
        )}
      </div>
    </Card>
  )
}
