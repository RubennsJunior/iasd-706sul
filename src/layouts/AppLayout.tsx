import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { PushBridge } from '../components/notifications/PushBridge'
import { LogoMark } from '../components/ui/Logo'
import { DesktopShell } from './DesktopShell'
import { MobileShell } from './MobileShell'
import { PageMetaProvider } from './PageMeta'

/** Exige login e escolhe entre o layout web (menu lateral) e o mobile (barra inferior). */
export function AppLayout() {
  const { ready, user } = useAuth()
  const desktop = useIsDesktop()
  const location = useLocation()

  // Telas novas (consulta, cadastro, edição) sempre abrem no topo.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-navy-900 text-white">
        <LogoMark className="anim-splash size-16" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <PageMetaProvider>
      <PushBridge />
      {desktop ? <DesktopShell /> : <MobileShell />}
    </PageMetaProvider>
  )
}
