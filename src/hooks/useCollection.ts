import { useEffect, useState } from 'react'
import type { Entity } from '../models'
import type { Repository } from '../repositories/repository'

/** Lista reativa: recarrega sozinha quando qualquer tela (ou aba) altera o repositório. */
export function useCollection<T extends Entity>(repo: Repository<T>) {
  const [initial] = useState(() => repo.peek?.())
  const [items, setItems] = useState<T[]>(initial ?? [])
  const [loading, setLoading] = useState(initial === undefined)

  useEffect(() => {
    let alive = true
    const load = () =>
      repo.list().then((data) => {
        if (!alive) return
        setItems(data)
        setLoading(false)
      })
    load()
    const stop = repo.subscribe(load)
    return () => {
      alive = false
      stop()
    }
  }, [repo])

  return { items, loading }
}
