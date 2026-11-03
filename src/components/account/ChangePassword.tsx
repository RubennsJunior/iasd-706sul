import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { BOOTSTRAP_ADMIN_EMAIL } from '../../config'
import { useAuth } from '../../contexts/AuthContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { changeMyPassword } from '../../lib/cloudSession'
import { repos } from '../../repositories'
import { Button } from '../ui/Button'
import { controlClass } from '../forms/Controls'

/** "Minha conta" na nuvem: cada pessoa troca a própria senha (o administrador pode ser avisado para trocar a inicial). */
export function ChangePassword() {
  const { user, can } = useAuth()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    try {
      await changeMyPassword(password)
      // o aviso de "troque a senha inicial" some quando o administrador de partida troca a dele
      if (user && user.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() && can('usuarios', 'edit')) {
        await repos.users.update(user.id, { passwordChangedAt: new Date().toISOString() })
      }
      setPassword('')
      setConfirm('')
      toast.success('Senha alterada.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
        <KeyRound className="size-4" /> Alterar minha senha
      </h3>
      <input
        type="password"
        autoComplete="new-password"
        aria-label="Nova senha"
        placeholder="Nova senha (mínimo de 6 caracteres)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={controlClass()}
      />
      <input
        type="password"
        autoComplete="new-password"
        aria-label="Confirmar nova senha"
        placeholder="Confirmar nova senha"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className={controlClass()}
      />
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" className="w-full" loading={busy}>
        Salvar nova senha
      </Button>
    </form>
  )
}
