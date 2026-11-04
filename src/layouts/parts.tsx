import { useMemo, useState } from 'react'
import { Bell, LogOut, Repeat } from 'lucide-react'
import { DEMO_MODE } from '../config'
import { ChangePassword } from '../components/account/ChangePassword'
import { cloudEnabled } from '../lib/firebase'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications, useRoles, useUsers } from '../hooks/useData'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { cn } from '../utils/misc'

/** Curva azul-marinho com filete dourado, usada na base dos cabeçalhos. */
export function HeaderWave({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 44"
      preserveAspectRatio="none"
      aria-hidden
      className={cn('absolute inset-x-0 bottom-0 h-8 w-full text-page sm:h-10', className)}
    >
      <path d="M0 44V30C110 40 250 28 400 3V44Z" fill="currentColor" />
      <path d="M0 30C110 40 250 28 400 3" fill="none" stroke="#d9a521" strokeWidth="2.5" />
    </svg>
  )
}

export function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuth()
  const { items } = useNotifications()
  const unread = useMemo(
    () => items.filter((n) => user && !n.readBy.includes(user.id)).length,
    [items, user],
  )
  return (
    <Link
      to="/notificacoes"
      aria-label={unread ? `Notificações: ${unread} não lidas` : 'Notificações'}
      className={cn('relative grid size-11 place-items-center rounded-full text-white hover:bg-white/10', className)}
    >
      <Bell className="size-7" strokeWidth={1.7} />
      {unread > 0 && (
        <span className="absolute right-1 top-0.5 grid size-5 place-items-center rounded-full bg-red-500 text-[11px] font-bold text-white ring-2 ring-navy-900">
          {unread}
        </span>
      )}
    </Link>
  )
}

/** Avatar que abre a conta: dados do usuário, troca de usuário de teste e saída. */
export function AccountButton({ showName, className }: { showName?: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  const { user, role, switchUser, logout } = useAuth()
  const { items: users } = useUsers()
  const { items: roles } = useRoles()
  const navigate = useNavigate()

  if (!user) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir minha conta"
        className={cn('flex items-center gap-3 rounded-full text-left', className)}
      >
        <Avatar name={user.name} photo={user.photo} size={showName ? 'md' : 'lg'} ring={!showName} />
        {showName && (
          <span className="hidden whitespace-nowrap leading-tight xl:block">
            <span className="block text-sm font-semibold text-navy-900">{user.name}</span>
            <span className="block text-xs text-muted">{role?.name}</span>
          </span>
        )}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Minha conta" size="sm">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} photo={user.photo} size="lg" />
          <div className="min-w-0">
            <p className="wrap-anywhere font-semibold text-navy-900">{user.name}</p>
            <p className="wrap-anywhere text-sm text-muted">{user.email}</p>
            <p className="text-xs font-semibold text-royal-600">{role?.name}</p>
          </div>
        </div>

        {DEMO_MODE && (
          <>
            <h3 className="mb-2 mt-6 flex items-center gap-2 text-sm font-semibold text-navy-900">
              <Repeat className="size-4" /> Testar outro perfil (demonstração)
            </h3>
            <ul className="space-y-1.5">
              {users
                .filter((u) => u.status === 'ativo')
                .map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={u.id === user.id}
                      onClick={() => {
                        switchUser(u.id)
                        setOpen(false)
                        navigate('/')
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-royal-50 disabled:bg-royal-50/60"
                    >
                      <Avatar name={u.name} photo={u.photo} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block wrap-anywhere text-sm font-medium text-ink">{u.name}</span>
                        <span className="block text-xs text-muted">{roles.find((r) => r.id === u.roleId)?.name}</span>
                      </span>
                      {u.id === user.id && <span className="text-xs font-semibold text-royal-600">Atual</span>}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}

        {cloudEnabled && <ChangePassword />}

        <Button
          variant="outline"
          icon={LogOut}
          className="mt-6 w-full"
          onClick={() => {
            setOpen(false)
            // na nuvem, primeiro o aparelho deixa de receber as notificações de quem sai; depois vai para a entrada
            void Promise.resolve(logout()).then(() => navigate('/login'))
          }}
        >
          Sair
        </Button>
      </Modal>
    </>
  )
}
