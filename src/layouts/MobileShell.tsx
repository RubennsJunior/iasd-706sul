import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { RouteErrorBoundary } from '../components/ErrorBoundary'
import { useAuth } from '../contexts/AuthContext'
import { useKeyboardOpen } from '../hooks/useKeyboardOpen'
import { LogoLockup } from '../components/ui/Logo'
import { MAIN_NAV, canOpen } from '../routes/navigation'
import { cn, firstName } from '../utils/misc'
import { PageLoading } from './PageLoading'
import { usePageMeta } from './PageMeta'
import { AccountButton, HeaderWave, NotificationBell } from './parts'

function MobileHeader() {
  const meta = usePageMeta()
  const { user } = useAuth()
  const Icon = meta.icon
  const home = meta.variant === 'home'

  return (
    <header className="relative isolate overflow-hidden bg-linear-to-br/srgb from-navy-950 via-navy-900 to-navy-800 pb-12 text-white safe-top">
      <div
        aria-hidden
        className="absolute -right-10 top-8 -z-10 size-72 rounded-full opacity-70"
        style={{ background: 'radial-gradient(circle, rgba(217,165,33,0.45) 0%, transparent 62%)' }}
      />
      <div className="flex items-center justify-between px-5 pt-4">
        <Link to="/" aria-label="Ir para o início">
          <LogoLockup compact />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <AccountButton />
        </div>
      </div>

      <div className="px-5 pt-5">
        {home ? (
          <>
            <h1 className="text-[26px] font-bold leading-tight">Olá, {firstName(user?.name ?? '')}!</h1>
            <p className="mt-1 text-[15px] text-white/85">Que Deus abençoe seu dia!</p>
          </>
        ) : (
          <div className="flex items-center gap-3.5">
            {meta.back ? (
              <Link
                to={meta.back}
                aria-label="Voltar"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
              >
                <ArrowLeft className="size-6" />
              </Link>
            ) : (
              Icon && <Icon className="size-12 shrink-0 text-gold-400" strokeWidth={1.5} />
            )}
            <div className="min-w-0">
              <h1 className="wrap-anywhere text-[28px] font-bold leading-tight">{meta.title}</h1>
              {meta.subtitle && <p className="text-sm text-white/85">{meta.subtitle}</p>}
            </div>
          </div>
        )}
      </div>
      <HeaderWave />
    </header>
  )
}

function BottomNav() {
  const { can } = useAuth()
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 shadow-[0_-6px_24px_rgba(15,47,125,0.08)] backdrop-blur safe-bottom"
    >
      <ul className="mx-auto flex max-w-xl">
        {MAIN_NAV.filter((item) => canOpen(can, item)).map(({ label, to, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-1 px-1 pb-2.5 pt-2.5 text-[13px] font-medium transition-colors',
                  isActive ? 'font-semibold text-royal-600' : 'text-navy-900/80',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('size-7', isActive ? 'text-navy-900' : 'text-navy-800')} strokeWidth={isActive ? 2.2 : 1.7} />
                  {label}
                  {isActive && <span className="absolute inset-x-3 bottom-0 h-1 rounded-full bg-royal-600" />}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function MobileShell() {
  const typing = useKeyboardOpen()
  return (
    <div className="min-h-dvh bg-page">
      <div aria-hidden className="status-strip pointer-events-none fixed inset-x-0 top-0 z-[60] bg-navy-950" />
      <MobileHeader />
      <main className="relative -mt-5 px-4 pb-nav">
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>
      {!typing && <BottomNav />}
    </div>
  )
}
