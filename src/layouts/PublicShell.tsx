import { Suspense } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { RouteErrorBoundary } from '../components/ErrorBoundary'
import { LogoLockup } from '../components/ui/Logo'
import { useAuth } from '../contexts/AuthContext'
import { PageLoading } from './PageLoading'
import { PageMetaProvider, usePageMeta } from './PageMeta'
import { HeaderWave } from './parts'

const pill =
  'rounded-full border border-white/40 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/20'

function PublicFrame() {
  const meta = usePageMeta()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const Icon = meta.icon
  const onEntry = pathname === '/login' || pathname === '/entrar'

  return (
    <div className="min-h-dvh bg-page">
      <header className="relative isolate overflow-hidden bg-linear-to-br/srgb from-navy-950 via-navy-900 to-navy-800 pb-14 text-white safe-top">
        <div
          aria-hidden
          className="absolute -right-24 -top-16 -z-10 size-[26rem] rounded-full opacity-60"
          style={{ background: 'radial-gradient(circle, rgba(217,165,33,0.5) 0%, transparent 62%)' }}
        />
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 pt-4">
          <Link to="/login" aria-label="Ir para a tela inicial">
            <LogoLockup compact />
          </Link>
          {user ? (
            <Link to="/" className={pill}>
              Ir para o sistema
            </Link>
          ) : (
            !onEntry && (
              <Link to="/entrar" className={pill}>
                Tem login? Entrar
              </Link>
            )
          )}
        </div>

        <div className="mx-auto max-w-4xl px-5 pt-6">
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
              <h1 className="text-[28px] font-bold leading-tight sm:text-3xl">{meta.title}</h1>
              {meta.subtitle && <p className="text-sm text-white/85 sm:text-base">{meta.subtitle}</p>}
            </div>
          </div>
        </div>
        <HeaderWave />
      </header>

      <main className="relative -mt-5 mx-auto w-full max-w-4xl px-4 pb-16">
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>
    </div>
  )
}

/** Moldura das telas abertas, sem login: boas-vindas, entrar, cadastro e área do visitante. */
export function PublicShell() {
  return (
    <PageMetaProvider>
      <PublicFrame />
    </PageMetaProvider>
  )
}
