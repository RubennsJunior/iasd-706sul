import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { RouteErrorBoundary } from '../components/ErrorBoundary'
import { CHURCH_NAME } from '../config'
import { useAuth } from '../contexts/AuthContext'
import { LogoLockup } from '../components/ui/Logo'
import { PendingBadge } from '../components/ui/PendingBadge'
import { MAIN_NAV, MENU_SECTIONS, canOpen } from '../routes/navigation'
import type { NavItem } from '../routes/navigation'
import { formatDateLong, todayISO } from '../utils/date'
import { cn } from '../utils/misc'
import { PageLoading } from './PageLoading'
import { usePageMeta } from './PageMeta'
import { AccountButton, HeaderWave, NotificationBell } from './parts'

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-2 text-sm transition-colors',
          isActive
            ? 'border-gold-500 bg-white/12 font-semibold text-white'
            : 'border-transparent text-white/75 hover:bg-white/8 hover:text-white',
        )
      }
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
      {item.label}
      {item.badge === 'requests' && <PendingBadge className="ml-auto" />}
    </NavLink>
  )
}

function Sidebar() {
  const { can } = useAuth()
  const allowed = (item: NavItem) => canOpen(can, item)
  const main = MAIN_NAV.filter((i) => i.to !== '/menu' && allowed(i))
  const sections = MENU_SECTIONS.map((s) => ({ ...s, items: s.items.filter(allowed) })).filter(
    (s) => s.items.length > 0,
  )
  // Itens que já aparecem no bloco principal não se repetem nas seções.
  const mainPaths = new Set(main.map((i) => i.to))

  return (
    <aside className="sticky top-0 flex h-dvh w-72 shrink-0 flex-col overflow-y-auto bg-linear-to-b/srgb from-navy-950 via-navy-900 to-navy-950 px-4 py-6 text-white">
      <Link to="/" className="mb-8 px-2">
        <LogoLockup />
      </Link>
      <nav aria-label="Navegação principal" className="flex-1 space-y-6">
        <div className="space-y-1">
          {main.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
        {sections.map((section) => {
          const items = section.items.filter((i) => !mainPaths.has(i.to))
          if (items.length === 0) return null
          return (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-400">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <SidebarLink key={item.to} item={item} />
                ))}
              </div>
            </div>
          )
        })}
      </nav>
      <div className="mt-8 h-1 rounded-full bg-linear-to-r/srgb from-gold-500 to-transparent" />
    </aside>
  )
}

function PageBanner() {
  const meta = usePageMeta()
  const Icon = meta.icon
  if (meta.variant === 'home' || !meta.title) return null
  return (
    <section className="relative isolate mb-6 overflow-hidden rounded-3xl bg-linear-to-br/srgb from-navy-950 via-navy-900 to-navy-800 px-8 pb-12 pt-7 text-white shadow-card">
      <div
        aria-hidden
        className="absolute -right-10 -top-10 -z-10 size-72 rounded-full opacity-60"
        style={{ background: 'radial-gradient(circle, rgba(217,165,33,0.5) 0%, transparent 62%)' }}
      />
      <div className="flex items-center gap-4">
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
        <div>
          <h1 className="text-3xl font-bold leading-tight">{meta.title}</h1>
          {meta.subtitle && <p className="text-white/85">{meta.subtitle}</p>}
        </div>
      </div>
      <HeaderWave className="h-9 text-page" />
    </section>
  )
}

export function DesktopShell() {
  const { user } = useAuth()
  const meta = usePageMeta()
  return (
    <div className="flex min-h-dvh bg-page">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-line bg-white/85 px-8 backdrop-blur">
          <div>
            <p className="text-sm font-semibold text-navy-900">
              {meta.variant === 'home' ? `Olá, ${user?.name.split(' ')[0]}!` : CHURCH_NAME}
            </p>
            <p className="text-xs text-muted">
              {meta.variant === 'home' ? 'Que Deus abençoe seu dia!' : formatDateLong(todayISO())}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell className="rounded-full bg-navy-900 hover:bg-navy-800" />
            <AccountButton showName />
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] px-8 py-6">
          <PageBanner />
          <RouteErrorBoundary>
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  )
}
