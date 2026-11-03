import {
  Baby,
  BookOpen,
  Church,
  HandHeart,
  Handshake,
  Heart,
  Music,
  Users,
  Video,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const TEAM_ICONS: Record<string, LucideIcon> = {
  music: Music,
  handshake: Handshake,
  video: Video,
  praying: HandHeart,
  baby: Baby,
  church: Church,
  book: BookOpen,
  users: Users,
  heart: Heart,
}

export function teamIcon(key: string): LucideIcon {
  return TEAM_ICONS[key] ?? Users
}
