import { ArrowRight, Eye, LogIn, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../../contexts/AuthContext'
import { Page } from '../../layouts/PageMeta'

function Option({
  icon: Icon,
  title,
  text,
  to,
  action,
  primary,
}: {
  icon: LucideIcon
  title: string
  text: string
  to: string
  action: string
  primary?: boolean
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <span className="grid size-12 place-items-center rounded-full bg-navy-900 text-white">
        <Icon className="size-6" strokeWidth={1.8} />
      </span>
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink">{text}</p>
      </div>
      <Link to={to}>
        <Button variant={primary ? 'primary' : 'outline'} trailingIcon={ArrowRight} className="w-full">
          {action}
        </Button>
      </Link>
    </Card>
  )
}

/** Primeira tela: quem não tem login entra como visitante ou pede o cadastro; quem tem, vai para "Entrar". */
export function WelcomePage() {
  const { user } = useAuth()
  const location = useLocation()
  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />

  return (
    <Page title="Bem-vindo(a)!" subtitle="Acompanhe a agenda da igreja ou faça parte dela.">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Option
            primary
            icon={Eye}
            title="Sou visitante"
            text="Veja os próximos eventos e confira se o seu nome está nas escalas das equipes. Não precisa de cadastro."
            to="/visitante"
            action="Entrar como visitante"
          />
          <Option
            icon={UserPlus}
            title="Quero me cadastrar"
            text="Faça o seu cadastro como membro e escolha em quais equipes gostaria de participar. A secretaria analisa e entra em contato."
            to="/cadastro"
            action="Fazer meu cadastro"
          />
        </div>

        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-royal-50 text-royal-600">
              <LogIn className="size-6" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-navy-900">Tem login?</h2>
              <p className="text-sm text-ink">Liderança, secretaria e membros com acesso entram com e-mail e senha.</p>
            </div>
          </div>
          <Link to="/entrar" state={location.state}>
            <Button variant="secondary" icon={LogIn} className="w-full sm:w-auto">
              Entrar
            </Button>
          </Link>
        </Card>
      </div>
    </Page>
  )
}
