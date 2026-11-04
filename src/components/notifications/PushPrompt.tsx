import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { cloudEnabled } from '../../lib/firebase'
import { enablePush, getPushState } from '../../lib/push'
import type { PushState } from '../../lib/push'
import { Banner } from '../ui/Banner'
import { Button } from '../ui/Button'

const DISMISSED = 'igreja-sda:push-prompt-dismissed'

const dismissed = () => {
  try {
    return window.localStorage.getItem(DISMISSED) === '1'
  } catch {
    return false
  }
}

/** Convite no Início para ligar as notificações no aparelho; some depois de ativar ou de "Agora não". */
export function PushPrompt() {
  const { user, can } = useAuth()
  const toast = useToast()
  const uid = user?.id
  const allowed = cloudEnabled && Boolean(uid) && can('notificacoes', 'view')
  const [state, setState] = useState<PushState | undefined>()
  const [hidden, setHidden] = useState(dismissed)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!allowed || !uid || hidden) return
    let live = true
    getPushState(uid).then(
      (next) => live && setState(next),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [allowed, uid, hidden])

  if (!allowed || hidden || !uid || (state?.kind !== 'off' && state?.kind !== 'install-ios')) return null

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED, '1')
    } catch {
      // sem armazenamento: some só até recarregar
    }
    setHidden(true)
  }

  const enable = async () => {
    setBusy(true)
    try {
      await enablePush(uid)
      toast.success('Notificações ativadas neste aparelho.')
      setHidden(true)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Banner
      icon={
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-900 text-white">
          <BellRing className="size-6" />
        </span>
      }
      title="Receba os avisos da igreja neste aparelho"
      description={
        state?.kind === 'install-ios'
          ? 'No iPhone, instale o aplicativo na tela de início para receber notificações.'
          : 'Eventos, escalas e comunicados aparecem na tela do aparelho, mesmo com o aplicativo fechado.'
      }
      actions={
        <>
          {state?.kind === 'install-ios' ? (
            <Link to="/notificacoes">
              <Button size="sm">Ver como</Button>
            </Link>
          ) : (
            <Button size="sm" loading={busy} onClick={() => void enable()}>
              Ativar notificações
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={dismiss}>
            Agora não
          </Button>
        </>
      }
    />
  )
}
