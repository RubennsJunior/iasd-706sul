import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/Misc'
import { Modal } from '../../components/ui/Modal'
import { useMaterials } from '../../hooks/useData'
import type { SabbathMaterial } from '../../models'
import { formatDate } from '../../utils/date'
import { AGE_GROUPS } from '../../utils/labels'
import { cn } from '../../utils/misc'

export function SabbathPage() {
  const { items } = useMaterials()
  const [group, setGroup] = useState('')
  const [open, setOpen] = useState<SabbathMaterial | null>(null)

  const visible = items
    .filter((m) => !group || m.ageGroup === group || m.ageGroup === 'Todos')
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))

  const chip = (active: boolean) =>
    cn(
      'rounded-full border px-4 py-1.5 text-sm font-medium',
      active ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-white text-navy-900 hover:bg-royal-50',
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(group === '')} onClick={() => setGroup('')}>
          Todos
        </button>
        {AGE_GROUPS.filter((g) => g.value !== 'Todos').map((g) => (
          <button key={g.value} type="button" className={chip(group === g.value)} onClick={() => setGroup(g.value)}>
            {g.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Nenhum material disponível" />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setOpen(m)} className="block w-full text-left">
                <Card className="flex items-start gap-3.5 p-4 transition-shadow hover:shadow-float">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-navy-900 text-white">
                    <GraduationCap className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      {m.quarter} • {m.lesson}
                      <Badge tone="info">{m.ageGroup}</Badge>
                    </span>
                    <span className="mt-0.5 block text-lg font-semibold text-navy-900">{m.title}</span>
                    <span className="line-clamp-2 text-sm text-ink">{m.description}</span>
                  </span>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.title ?? ''}
        subtitle={open ? `${open.quarter} • ${open.lesson} • ${open.ageGroup}` : ''}
        size="sm"
        footer={
          <Button variant="outline" onClick={() => setOpen(null)}>
            Fechar
          </Button>
        }
      >
        <p className="leading-relaxed text-ink">{open?.description}</p>
        {open && <p className="mt-3 text-xs text-muted">Publicado em {formatDate(open.date)}</p>}
      </Modal>
    </div>
  )
}
