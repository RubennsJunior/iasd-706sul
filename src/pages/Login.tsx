import { useState } from 'react'
import type { FormEvent } from 'react'
import { LogIn } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Card, SectionHeader } from '../components/ui/Card'
import { controlClass, FieldWrapper } from '../components/forms/Controls'
import { DEMO_MODE, DEMO_PASSWORD } from '../config'

const DEMO_EMAIL_DOMAIN = '@igreja.demo'
import { useAuth } from '../contexts/AuthContext'
import { cloudEnabled } from '../lib/firebase'
import { sendReset } from '../lib/cloudSession'
import { isValidEmail } from '../utils/misc'
import { errorMessage } from '../contexts/ToastContext'
import { useRoles, useUsers } from '../hooks/useData'
import { Page } from '../layouts/PageMeta'

/** Tela de login (`/entrar`), aberta em "Tem login?" na tela inicial. */
export function LoginPage() {
  const { user, login, message } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { items: users } = useUsers()
  const { items: roles } = useRoles()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={from} replace />

  const enter = async (mail: string, pass: string) => {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await login(mail, pass)
      // na nuvem a tela segue sozinha quando o perfil carrega (o acesso pode ser recusado: conta sem perfil, inativa)
      if (cloudEnabled) setBusy(false)
      else navigate(from, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const forgot = async () => {
    setError('')
    setInfo('')
    if (!isValidEmail(email.trim())) return setError('Digite o seu e-mail acima para receber o link de nova senha.')
    try {
      await sendReset(email)
      setInfo('Se este e-mail tem acesso, enviamos um link para criar uma nova senha. Confira também a caixa de spam.')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void enter(email, password)
  }

  return (
    <Page title="Entrar" subtitle="Acesse com o seu e-mail e senha" icon={LogIn} back="/login">
      <div className="mx-auto max-w-md space-y-4">
        <Card className="p-5">
          <form onSubmit={submit} noValidate className="space-y-4">
            <FieldWrapper id="login-email" label="E-mail">
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={cloudEnabled ? "voce@exemplo.com" : "voce@igreja.demo"}
                className={controlClass()}
              />
            </FieldWrapper>
            <FieldWrapper id="login-password" label="Senha">
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={controlClass()}
              />
            </FieldWrapper>
            {(error || message) && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error || message}
              </p>
            )}
            {info && (
              <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                {info}
              </p>
            )}
            <Button type="submit" icon={LogIn} loading={busy} className="w-full">
              Entrar
            </Button>
          </form>
          {cloudEnabled && (
            <p className="mt-3 text-center text-sm">
              <button type="button" onClick={() => void forgot()} className="font-semibold text-royal-600 hover:underline">
                Esqueci minha senha
              </button>
            </p>
          )}
          <p className="mt-4 text-center text-sm text-muted">
            Ainda não tem acesso?{' '}
            <Link to="/cadastro" className="font-semibold text-royal-600 hover:underline">
              Faça seu cadastro
            </Link>{' '}
            ou{' '}
            <Link to="/visitante" className="font-semibold text-royal-600 hover:underline">
              entre como visitante
            </Link>
            .
          </p>
        </Card>

        {DEMO_MODE && (
          <Card className="p-5">
            <SectionHeader title="Contas de demonstração" />
            <p className="-mt-1 mb-3 text-xs text-muted">
              Toque em um perfil para entrar e testar as permissões. Senha de todos: {DEMO_PASSWORD}.
            </p>
            <ul className="grid gap-1.5">
              {users
                .filter((u) => u.status === 'ativo' && u.email.endsWith(DEMO_EMAIL_DOMAIN))
                .map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void enter(u.email, DEMO_PASSWORD)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-royal-50 px-3 py-2 text-left hover:bg-royal-100 disabled:opacity-60"
                    >
                      <Avatar name={u.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block wrap-anywhere text-sm font-medium text-ink">{u.name}</span>
                        <span className="block text-xs text-muted">{roles.find((r) => r.id === u.roleId)?.name}</span>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </Card>
        )}
      </div>
    </Page>
  )
}
