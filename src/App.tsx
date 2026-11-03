import { BrowserRouter } from 'react-router-dom'
import { RouteErrorBoundary } from './components/ErrorBoundary'
import { CloudBanner, CloudNotices } from './components/CloudStatus'
import { NativeBackButton } from './components/NativeBackButton'
import { Splash } from './components/Splash'
import { AuthProvider } from './contexts/AuthContext'
import { ConfirmProvider } from './contexts/ConfirmContext'
import { ToastProvider } from './contexts/ToastContext'
import { AppRoutes } from './routes'

export default function App() {
  return (
    <BrowserRouter>
      <NativeBackButton />
      <ToastProvider>
        <CloudNotices />
        <AuthProvider>
          <ConfirmProvider>
            <CloudBanner />
            <Splash>
              {/* última barreira: falha fora das telas-base (entrada, rotas) não deixa a tela branca */}
              <RouteErrorBoundary>
                <AppRoutes />
              </RouteErrorBoundary>
            </Splash>
          </ConfirmProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
