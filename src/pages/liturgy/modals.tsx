import { Heart } from 'lucide-react'
import type { ChurchMessage, Hymn, Reading } from '../../models'
import { useAuth } from '../../contexts/AuthContext'
import { errorMessage, useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { hymnsService } from '../../services'
import { formatDate, formatDateLong } from '../../utils/date'
import { MESSAGE_KIND } from '../../utils/labels'

export function ReadingModal({ reading, onClose }: { reading: Reading | null; onClose(): void }) {
  return (
    <Modal open={reading !== null} onClose={onClose} title={reading?.reference ?? ''} subtitle={reading ? formatDateLong(reading.date) : ''} size="sm" footer={<Button variant="outline" onClick={onClose}>Fechar</Button>}>
      {reading && (
        <div className="space-y-3">
          <Badge tone="info">{reading.theme}</Badge>
          <p className="font-script text-xl italic leading-relaxed text-navy-900">“{reading.text}”</p>
          <p className="text-sm font-semibold text-royal-600">{reading.reference}</p>
        </div>
      )}
    </Modal>
  )
}

export function HymnModal({ hymn, onClose }: { hymn: Hymn | null; onClose(): void }) {
  const { user } = useAuth()
  const toast = useToast()
  const favorite = Boolean(hymn && user && hymn.favoriteBy.includes(user.id))

  const toggle = async () => {
    if (!hymn || !user) return
    try {
      await hymnsService.toggleFavorite(hymn.id, user.id)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Modal
      open={hymn !== null}
      onClose={onClose}
      title={hymn ? `${hymn.number}. ${hymn.title}` : ''}
      subtitle={hymn?.category}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button icon={Heart} variant={favorite ? 'secondary' : 'primary'} onClick={toggle}>
            {favorite ? 'Remover dos favoritos' : 'Favoritar'}
          </Button>
        </>
      }
    >
      <p className="whitespace-pre-line font-script text-lg italic leading-relaxed text-navy-900">{hymn?.lyrics}</p>
      <p className="mt-4 text-xs text-muted">Letra de exemplo, criada para a demonstração do sistema.</p>
    </Modal>
  )
}

export function MessageModal({ message, onClose }: { message: ChurchMessage | null; onClose(): void }) {
  return (
    <Modal
      open={message !== null}
      onClose={onClose}
      title={message?.title ?? ''}
      subtitle={message ? `${MESSAGE_KIND[message.kind]} • ${message.author} • ${formatDate(message.date)}` : ''}
      footer={<Button variant="outline" onClick={onClose}>Fechar</Button>}
    >
      <p className="whitespace-pre-line leading-relaxed text-ink">{message?.body}</p>
    </Modal>
  )
}
