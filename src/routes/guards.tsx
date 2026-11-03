import type { ReactNode } from 'react'
import { Lock, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ActionKey, ModuleKey } from '../models'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/Misc'
import { Page } from '../layouts/PageMeta'

export function Guard({
  module,
  action = 'view',
  children,
}: {
  module?: ModuleKey
  action?: ActionKey
  children: ReactNode
}) {
  const { can } = useAuth()
  if (module && !can(module, action)) {
    return (
      <Page title="Acesso restrito" subtitle="Seu perfil não possui esta permissão" icon={Lock}>
        <EmptyState
          icon={Lock}
          title="Você não tem acesso a esta área"
          description="Peça ao administrador para ajustar as permissões do seu perfil."
          action={
            <Link to="/">
              <Button>Voltar ao início</Button>
            </Link>
          }
        />
      </Page>
    )
  }
  return <>{children}</>
}

export function NotFound() {
  return (
    <Page title="Página não encontrada" subtitle="O endereço informado não existe" icon={SearchX}>
      <EmptyState
        icon={SearchX}
        title="Não encontramos esta página"
        action={
          <Link to="/">
            <Button>Voltar ao início</Button>
          </Link>
        }
      />
    </Page>
  )
}
