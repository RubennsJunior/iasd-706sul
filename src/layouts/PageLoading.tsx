import { Loader2 } from 'lucide-react'

export function PageLoading() {
  return (
    <div role="status" aria-label="Carregando" className="grid place-items-center py-24 text-royal-600">
      <Loader2 className="size-8 animate-spin" />
    </div>
  )
}
