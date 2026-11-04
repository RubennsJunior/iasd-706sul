import type { Team } from '../../models'
import { cn } from '../../utils/misc'
import { teamIcon } from './icons'

const SIZES = {
  md: { box: 'size-[72px] shadow-inner', icon: 'size-8', bar: 'inset-x-3 bottom-1.5' },
  lg: { box: 'size-20', icon: 'size-9', bar: 'inset-x-4 bottom-2' },
}

/** Emblema redondo da equipe: a foto escolhida no cadastro ou, sem foto, o ícone do ministério. */
export function TeamEmblem({ team, size = 'md', className }: { team: Pick<Team, 'icon' | 'photo'>; size?: keyof typeof SIZES; className?: string }) {
  const Icon = teamIcon(team.icon)
  const style = SIZES[size]
  return (
    <span
      aria-hidden
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-navy-900 text-white ring-4 ring-royal-50',
        style.box,
        className,
      )}
    >
      {team.photo ? (
        <img src={team.photo} alt="" className="size-full object-cover" />
      ) : (
        <>
          <Icon className={style.icon} strokeWidth={1.6} />
          <span className={cn('absolute h-0.5 rounded-full bg-gold-500', style.bar)} />
        </>
      )}
    </span>
  )
}
