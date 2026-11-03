import { CalendarCheck, CalendarDays, Eye, LogIn, UserPlus } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { SegmentedTabs } from '../../components/ui/Tabs'
import { Page } from '../../layouts/PageMeta'

const TABS = [
  { key: 'eventos', label: 'Eventos', icon: CalendarDays, to: '/visitante', end: true },
  { key: 'escalas', label: 'Escalas', icon: CalendarCheck, to: '/visitante/escalas' },
]

/** Área do visitante: só consulta de eventos e escalas, sem login. */
export function VisitorLayout() {
  return (
    <Page title="Área do visitante" subtitle="Eventos e escalas da igreja" icon={Eye} back="/login">
      <div className="space-y-4">
        <SegmentedTabs items={TABS} className="md:max-w-md" />
        <Outlet />
        <Card className="flex flex-wrap items-center gap-3 bg-royal-50 p-4 shadow-none">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-navy-900">Quer fazer parte da igreja?</p>
            <p className="text-sm text-ink">Cadastre-se como membro e escolha as equipes em que gostaria de servir.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/cadastro">
              <Button size="sm" icon={UserPlus}>
                Fazer meu cadastro
              </Button>
            </Link>
            <Link to="/entrar">
              <Button size="sm" variant="outline" icon={LogIn}>
                Tem login?
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </Page>
  )
}
