import { BookOpen, CalendarDays, HandHeart, Heart, Music, Smile, Users, Wine } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CoverKey } from '../../models'
import { cn } from '../../utils/misc'

const COVERS: Record<CoverKey, { background: string; icon: LucideIcon }> = {
  louvor: {
    background:
      'radial-gradient(circle at 70% 85%, #f59e0b 0%, transparent 45%), linear-gradient(160deg, #0b2a7a, #14307f 55%, #0a1c52)',
    icon: Music,
  },
  ceia: {
    background:
      'radial-gradient(circle at 50% 60%, #f5b942 0%, transparent 55%), linear-gradient(160deg, #3b2412, #7a4a1a 60%, #2a170a)',
    icon: Wine,
  },
  estudo: {
    background:
      'radial-gradient(circle at 25% 90%, #e5b95c 0%, transparent 45%), linear-gradient(160deg, #0b1f55, #16336f 60%, #0a1740)',
    icon: BookOpen,
  },
  criancas: {
    background:
      'radial-gradient(circle at 70% 20%, #fde68a 0%, transparent 50%), linear-gradient(160deg, #f59e0b, #fbbf24 60%, #f97316)',
    icon: Smile,
  },
  oracao: {
    background:
      'radial-gradient(circle at 50% 100%, #93a8e8 0%, transparent 55%), linear-gradient(160deg, #0a1a4f, #1b2f78 60%, #0a143c)',
    icon: HandHeart,
  },
  jovens: {
    background:
      'radial-gradient(circle at 80% 15%, #a5b4fc 0%, transparent 50%), linear-gradient(160deg, #1d3f9e, #4338ca 60%, #1e2a78)',
    icon: Users,
  },
  familia: {
    background:
      'radial-gradient(circle at 25% 15%, #fde68a 0%, transparent 45%), linear-gradient(160deg, #0f766e, #14917f 60%, #0b5f58)',
    icon: Heart,
  },
  geral: {
    background:
      'radial-gradient(circle at 80% 90%, #d9a521 0%, transparent 40%), linear-gradient(160deg, #0a2468, #163c96 60%, #061746)',
    icon: CalendarDays,
  },
}

/**
 * Capa do evento: a foto escolhida no cadastro ou, sem foto, uma ilustração gerada em CSS (funciona sem imagens
 * externas).
 */
export function Cover({
  cover,
  photo,
  title,
  className,
  showTitle = true,
}: {
  cover: CoverKey
  /** Foto do evento (data URL); quando existe, aparece no lugar da ilustração. */
  photo?: string
  title: string
  className?: string
  showTitle?: boolean
}) {
  const { background, icon: Icon } = COVERS[cover] ?? COVERS.geral
  return (
    <div
      role="img"
      aria-label={`Capa: ${title}`}
      className={cn('isolate overflow-hidden text-white', !className?.includes('absolute') && 'relative', className)}
      style={photo ? { background: '#0a1c52' } : { background }}
    >
      {photo ? (
        <img src={photo} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <Icon className="absolute -bottom-3 -right-3 size-24 rotate-[-8deg] opacity-25" strokeWidth={1.3} />
      )}
      {showTitle && (
        <span
          className={cn(
            'absolute inset-0 flex p-3 break-words font-script text-[17px] font-semibold italic leading-[1.1] drop-shadow lg:text-xl',
            photo ? 'items-end bg-linear-to-t from-navy-950/80 via-navy-950/25 to-transparent' : 'items-center',
          )}
        >
          {title}
        </span>
      )}
    </div>
  )
}
