import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { photoFromFile } from '../../utils/image'
import type { PhotoOptions } from '../../utils/image'
import { cn } from '../../utils/misc'
import { Button } from '../ui/Button'

/**
 * Campo de foto dos formulários: escolhe uma imagem da galeria (ou tira na hora, no celular), reduz e comprime
 * no aparelho (ver `utils/image`) e entrega o resultado como texto para ser gravado junto do cadastro.
 */
export function PhotoField({
  value,
  onChange,
  options,
  shape = 'round',
  fallback,
  label = 'foto',
}: {
  value?: string
  onChange(value: string | undefined): void
  options: PhotoOptions
  /** `round` para pessoas e equipes; `wide` para a foto do evento. */
  shape?: 'round' | 'wide'
  /** O que aparece enquanto não há foto (iniciais, ícone, capa…). */
  fallback: ReactNode
  /** Como a foto é chamada nos textos: "foto", "foto do evento"… */
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      onChange(await photoFromFile(file, options))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível usar esta imagem.')
    } finally {
      setBusy(false)
      // permite escolher o mesmo arquivo de novo depois de remover
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className={cn('flex gap-4', shape === 'wide' ? 'flex-col sm:flex-row sm:items-center' : 'flex-wrap items-center')}>
      <div
        className={cn(
          'relative shrink-0 overflow-hidden bg-royal-50 ring-4 ring-royal-50',
          shape === 'round' ? 'size-24 rounded-full' : 'aspect-video w-full max-w-sm rounded-2xl',
        )}
      >
        {value ? <img src={value} alt="" className="absolute inset-0 size-full object-cover" /> : fallback}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" icon={ImagePlus} loading={busy} onClick={() => input.current?.click()}>
            {value ? `Trocar ${label}` : `Escolher ${label}`}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="outline" icon={Trash2} className="text-red-600" disabled={busy} onClick={() => onChange(undefined)}>
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">
          JPG, PNG ou WebP. A imagem é reduzida automaticamente para ficar leve.
        </p>
        {error && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label={`Escolher ${label}`}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void pick(event.target.files?.[0])}
      />
    </div>
  )
}
