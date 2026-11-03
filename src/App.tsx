import { BrowserRouter } from 'react-router-dom'
import { CloudBanner, CloudNotices, DefaultPasswordNotice } from './components/CloudStatus'
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
            <DefaultPasswordNotice />
            <Splash>
              <AppRoutes />
            </Splash>
          </ConfirmProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
