import { BookOpen, CalendarDays, HandHeart, Music } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { SegmentedTabs } from '../../components/ui/Tabs'
import { useAuth } from '../../contexts/AuthContext'
import { Page } from '../../layouts/PageMeta'
import { cn } from '../../utils/misc'

const TABS = [
  { key: 'leitura', label: 'Leitura do Dia', icon: BookOpen, to: '/liturgia', end: true },
  { key: 'calendario', label: 'Calendário', icon: CalendarDays, to: '/liturgia/calendario' },
  { key: 'hinos', label: 'Hinos', icon: Music, to: '/liturgia/hinos' },
  { key: 'oracao', label: 'Oração', icon: HandHeart, to: '/liturgia/oracao' },
]

const MORE = [
  { label: 'Mensagens e reflexões', to: '/liturgia/mensagens' },
  { label: 'Escola Sabatina', to: '/liturgia/escola-sabatina' },
  { label: 'Programação dos cultos', to: '/liturgia/cultos' },
]

export function LiturgyLayout() {
  const { can } = useAuth()
  return (
    <Page title="Liturgia" subtitle="Palavra de Deus para a sua vida" icon={BookOpen}>
      <div className="space-y-4">
        <SegmentedTabs items={TABS} />
        <nav aria-label="Mais conteúdos de liturgia" className="flex flex-wrap gap-2">
          {MORE.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-navy-900 bg-navy-900 text-white'
                    : 'border-line bg-white text-navy-900 hover:bg-royal-50',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          {can('liturgia', 'edit') && (
            <NavLink
              to="/liturgias"
              className="whitespace-nowrap rounded-full border border-gold-500 bg-gold-100 px-4 py-1.5 text-sm font-semibold text-gold-600"
            >
              Gerenciar conteúdo
            </NavLink>
          )}
        </nav>
        <Outlet />
      </div>
    </Page>
  )
}
