import { ChevronRight, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PendingBadge } from '../components/ui/PendingBadge'
import { Page } from '../layouts/PageMeta'
import { MENU_SECTIONS, canOpen } from '../routes/navigation'

export function MenuPage() {
  const { can } = useAuth()
  const sections = MENU_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canOpen(can, item)),
  })).filter((section) => section.items.length > 0)

  return (
    <Page title="Menu" subtitle="Gerencie as informações da sua igreja" icon={Settings}>
      <div className="space-y-6 pt-6 lg:pt-0">
        {sections.map(({ title, icon: SectionIcon, items }) => (
          <section key={title} aria-labelledby={`menu-${title}`}>
            <h2
              id={`menu-${title}`}
              className="mb-2.5 flex items-center gap-2 px-1 text-lg font-semibold text-navy-900"
            >
              <SectionIcon className="size-5 text-royal-600" />
              {title}
            </h2>
            <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {items.map(({ label, description, to, icon: Icon, badge }) => (
                <li key={to + label}>
                  <Link
                    to={to}
                    className="flex items-center gap-3.5 rounded-2xl bg-white px-3.5 py-3 shadow-card transition-shadow hover:shadow-float"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-900 text-white">
                      <Icon className="size-6" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold text-navy-900">
                        {label}
                        {badge === 'requests' && <PendingBadge />}
                      </span>
                      <span className="block wrap-anywhere text-sm text-muted">{description}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-royal-600" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  )
}
