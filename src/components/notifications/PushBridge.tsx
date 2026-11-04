import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { cloudEnabled } from '../../lib/firebase'
import { requestPush, syncPush } from '../../lib/push'

/** `/notificacoes?x=1` a partir de um endereço completo ou só do caminho. */
const pathOf = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return '/notificacoes'
  }
}

/**
 * Cola o app às notificações do aparelho (sem desenhar nada na tela):
 * - ao abrir logado, renova o cadastro do aparelho e pede ao servidor que envie o que ficou pendente (ex.: avisos
 *   criados sem internet);
 * - toque numa notificação com o app já aberto (navegador/iPhone: mensagem do service worker; Android: plugin) abre a tela.
 */
export function PushBridge() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const uid = user?.id

  useEffect(() => {
    if (!uid || !cloudEnabled) return
    void syncPush(uid)
    void requestPush()
  }, [uid])

  useEffect(() => {
    if (!cloudEnabled || !('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'push-open' && typeof event.data.url === 'string') navigate(pathOf(event.data.url))
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  useEffect(() => {
    if (!cloudEnabled || !Capacitor.isNativePlatform()) return
    let stop: (() => void) | undefined
    let cancelled = false
    void import('@capacitor/push-notifications').then(async ({ PushNotifications }) => {
      const handle = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        navigate(pathOf(String(action.notification.data?.url ?? '/notificacoes')))
      })
      if (cancelled) void handle.remove()
      else stop = () => void handle.remove()
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [navigate])

  return null
}
