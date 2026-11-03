import { useMemo, useState } from 'react'
import { Heart, Music, SearchX } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState, FilterMenu, SearchBar } from '../../components/ui/Misc'
import { useAuth } from '../../contexts/AuthContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { useHymns } from '../../hooks/useData'
import type { Hymn } from '../../models'
import { hymnsService } from '../../services'
import { cn, matchesQuery } from '../../utils/misc'
import { HymnModal } from './modals'

export function HymnsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { items: hymns } = useHymns()
  const [query, setQuery] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Hymn | null>(null)

  const categories = useMemo(() => [...new Set(hymns.map((h) => h.category))].sort(), [hymns])
  const isFavorite = (h: Hymn) => Boolean(user && h.favoriteBy.includes(user.id))

  const visible = hymns
    .filter(
      (h) =>
        (!onlyFavorites || isFavorite(h)) &&
        (!filters.category || h.category === filters.category) &&
        matchesQuery(query, h.title, String(h.number), h.category),
    )
    .sort((a, b) => a.number - b.number)

  const toggle = async (hymn: Hymn) => {
    if (!user) return
    try {
      await hymnsService.toggleFavorite(hymn.id, user.id)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const chip = (active: boolean) =>
    cn(
      'rounded-full border px-4 py-1.5 text-sm font-medium',
      active ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-white text-navy-900 hover:bg-royal-50',
    )

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" className={chip(!onlyFavorites)} onClick={() => setOnlyFavorites(false)}>
          Hinário
        </button>
        <button type="button" className={chip(onlyFavorites)} onClick={() => setOnlyFavorites(true)}>
          Favoritos ({hymns.filter(isFavorite).length})
        </button>
      </div>
      <SearchBar value={query} onChange={setQuery} placeholder="Buscar por título ou número…">
        <FilterMenu
          filters={[{ key: 'category', label: 'Categoria', options: categories.map((c) => ({ value: c, label: c })) }]}
          values={filters}
          onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
        />
      </SearchBar>

      {visible.length === 0 ? (
        <EmptyState
          icon={onlyFavorites && !query ? Heart : SearchX}
          title={onlyFavorites && !query ? 'Nenhum hino favorito' : 'Nenhum hino encontrado'}
          description={onlyFavorites && !query ? 'Toque no coração de um hino para salvá-lo aqui.' : 'Tente outra busca.'}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {visible.map((hymn) => (
            <li key={hymn.id}>
              <Card className="flex items-center gap-3 p-3">
                <button type="button" onClick={() => setOpen(hymn)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-navy-900 font-semibold text-white">
                    {hymn.number}
                  </span>
                  <span className="min-w-0">
                    <span className="block wrap-anywhere font-semibold text-navy-900">{hymn.title}</span>
                    <span className="flex items-center gap-1 text-sm text-muted">
                      <Music className="size-3.5" />
                      {hymn.category}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggle(hymn)}
                  aria-pressed={isFavorite(hymn)}
                  aria-label={isFavorite(hymn) ? `Remover ${hymn.title} dos favoritos` : `Favoritar ${hymn.title}`}
                  className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-royal-50"
                >
                  <Heart className={cn('size-5', isFavorite(hymn) ? 'fill-red-500 text-red-500' : 'text-navy-800')} />
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <HymnModal hymn={open ? (hymns.find((h) => h.id === open.id) ?? open) : null} onClose={() => setOpen(null)} />
    </div>
  )
}
