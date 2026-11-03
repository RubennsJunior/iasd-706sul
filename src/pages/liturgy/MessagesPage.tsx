import { useState } from 'react'
import { MessageSquareHeart } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState, SearchBar } from '../../components/ui/Misc'
import { useMessages } from '../../hooks/useData'
import type { ChurchMessage, MessageKind } from '../../models'
import { formatDate } from '../../utils/date'
import { MESSAGE_KIND } from '../../utils/labels'
import { cn, matchesQuery } from '../../utils/misc'
import { MessageModal } from './modals'

export function MessagesPage() {
  const { items } = useMessages()
  const [kind, setKind] = useState<MessageKind | ''>('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<ChurchMessage | null>(null)

  const visible = items
    .filter((m) => (!kind || m.kind === kind) && matchesQuery(query, m.title, m.author, m.body))
    .sort((a, b) => b.date.localeCompare(a.date))

  const chip = (active: boolean) =>
    cn(
      'rounded-full border px-4 py-1.5 text-sm font-medium',
      active ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-white text-navy-900 hover:bg-royal-50',
    )

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" className={chip(kind === '')} onClick={() => setKind('')}>
          Todas
        </button>
        <button type="button" className={chip(kind === 'mensagem')} onClick={() => setKind('mensagem')}>
          Mensagens
        </button>
        <button type="button" className={chip(kind === 'reflexao')} onClick={() => setKind('reflexao')}>
          Reflexões
        </button>
      </div>
      <SearchBar value={query} onChange={setQuery} placeholder="Buscar mensagens…" />
      {visible.length === 0 ? (
        <EmptyState icon={MessageSquareHeart} title="Nenhuma mensagem encontrada" />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setOpen(m)} className="block w-full text-left">
                <Card className="space-y-1.5 p-4 transition-shadow hover:shadow-float">
                  <Badge tone={m.kind === 'mensagem' ? 'info' : 'gold'}>{MESSAGE_KIND[m.kind]}</Badge>
                  <h3 className="text-lg font-semibold text-navy-900">{m.title}</h3>
                  <p className="line-clamp-2 text-sm text-ink">{m.body}</p>
                  <p className="text-xs text-muted">
                    {m.author} • {formatDate(m.date)}
                  </p>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}
      <MessageModal message={open} onClose={() => setOpen(null)} />
    </div>
  )
}
