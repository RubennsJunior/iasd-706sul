export type ID = string

export interface Entity {
  id: ID
  createdAt?: string
  updatedAt?: string
}

export type NewEntity<T extends Entity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

/* Permissões */

export const MODULES = [
  'eventos',
  'equipes',
  'liturgia',
  'membros',
  'usuarios',
  'lideres',
  'cargos',
  'departamentos',
  'escalas',
  'cultos',
  'participantes',
  'perfis',
  'permissoes',
  'notificacoes',
  'relatorios',
  'configuracoes',
] as const
export type ModuleKey = (typeof MODULES)[number]

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'manage'] as const
export type ActionKey = (typeof ACTIONS)[number]

export type PermissionSet = Record<ActionKey, boolean>
export type PermissionMatrix = Record<ModuleKey, PermissionSet>

/* Pessoas e acesso */

export type MemberStatus = 'ativo' | 'inativo' | 'afastado' | 'visitante'

export interface Member extends Entity {
  fullName: string
  birthDate: string
  phone: string
  email: string
  address: string
  baptismDate: string
  status: MemberStatus
  notes: string
}

export type UserStatus = 'ativo' | 'inativo' | 'bloqueado'

export interface AppUser extends Entity {
  name: string
  email: string
  phone: string
  /** Só no modo local (demonstração). Na nuvem a senha fica no Firebase Authentication e o `id` do usuário é o uid dele. */
  password?: string
  /** Quando o próprio usuário trocou a senha inicial (aviso para o administrador). */
  passwordChangedAt?: string
  roleId: ID
  status: UserStatus
  birthDate?: string
  notes?: string
  /** Quando definido, vale no lugar das permissões do perfil. */
  customPermissions?: PermissionMatrix
  lastLoginAt?: string
  /** Vínculo interno com o cadastro de membro (definido nos dados de exemplo); sem ele o membro é reconhecido por e-mail ou nome. */
  memberId?: ID
}

/** Nome público de cada membro (mesmo `id` do membro): é o que o visitante e os perfis sem acesso a "Membros" enxergam. */
export interface DirectoryEntry extends Entity {
  fullName: string
}

export interface Role extends Entity {
  name: string
  description: string
  permissions: PermissionMatrix
  system?: boolean
}

/* Estrutura da igreja */

export type ActiveStatus = 'ativa' | 'inativa'

export interface Department extends Entity {
  name: string
  description: string
  leaderId?: ID
  status: ActiveStatus
}

export type CoverKey =
  | 'louvor'
  | 'ceia'
  | 'estudo'
  | 'criancas'
  | 'oracao'
  | 'jovens'
  | 'familia'
  | 'geral'

export interface Team extends Entity {
  name: string
  description: string
  departmentId?: ID
  leaderId?: ID
  memberIds: ID[]
  foundedAt: string
  status: ActiveStatus
  icon: string
}

export interface Position extends Entity {
  name: string
  description: string
}

export type LeaderScope = 'equipe' | 'departamento'

export interface LeaderAssignment extends Entity {
  memberId: ID
  positionId: ID
  scope: LeaderScope
  scopeId: ID
  since: string
}

/* Agenda */

export type EventStatus = 'planejado' | 'confirmado' | 'cancelado' | 'realizado'

export type ParticipantStatus = 'inscrito' | 'confirmado' | 'presente' | 'ausente'

export interface EventParticipant {
  memberId: ID
  status: ParticipantStatus
}

export interface ChurchEvent extends Entity {
  title: string
  description: string
  date: string
  time: string
  location: string
  responsibleId?: ID
  participants: EventParticipant[]
  status: EventStatus
  cover: CoverKey
}

export interface ProgramItem {
  id: ID
  time: string
  title: string
  responsibleId?: ID
}

export interface WorshipService extends Entity {
  title: string
  kind: string
  date: string
  time: string
  location: string
  leaderId?: ID
  theme: string
  program: ProgramItem[]
}

export type AssignmentStatus = 'pendente' | 'confirmado' | 'recusado'

export interface RosterAssignment {
  memberId: ID
  role: string
  status: AssignmentStatus
}

export interface Roster extends Entity {
  title: string
  date: string
  time: string
  location: string
  teamId: ID
  linked?: string
  notes: string
  assignments: RosterAssignment[]
}

/* Liturgia */

export interface Reading extends Entity {
  date: string
  reference: string
  text: string
  theme: string
}

export interface Hymn extends Entity {
  number: number
  title: string
  category: string
  lyrics: string
  favoriteBy: ID[]
}

export type PrayerKind = 'oracao' | 'pedido'
export type PrayerStatus = 'aberto' | 'atendido'

export interface PrayerItem extends Entity {
  kind: PrayerKind
  title: string
  text: string
  author: string
  date: string
  status: PrayerStatus
  prayedBy: ID[]
}

export type MessageKind = 'mensagem' | 'reflexao'

export interface ChurchMessage extends Entity {
  kind: MessageKind
  title: string
  author: string
  date: string
  body: string
}

export interface SabbathMaterial extends Entity {
  quarter: string
  lesson: string
  title: string
  date: string
  description: string
  ageGroup: string
}

/* Solicitações de cadastro (pedido público de novo membro) */

export type RequestStatus = 'pendente' | 'aprovada' | 'recusada'

export interface MemberRequest extends Entity {
  fullName: string
  birthDate: string
  phone: string
  email: string
  address: string
  baptized: boolean
  baptismDate: string
  /** Equipes em que a pessoa gostaria de participar (na aprovação, as confirmadas). */
  teamIds: ID[]
  message: string
  status: RequestStatus
  reviewedBy?: string
  reviewedAt?: string
  reason?: string
  /** Membro criado quando a solicitação é aprovada. */
  memberId?: ID
}

/* Sistema */

export type NotificationKind = 'evento' | 'escala' | 'oracao' | 'aviso' | 'sistema'

export interface AppNotification extends Entity {
  title: string
  body: string
  kind: NotificationKind
  readBy: ID[]
}

export type ContactKind = 'telefone' | 'whatsapp' | 'email' | 'endereco' | 'site' | 'rede-social'

export interface ContactInfo extends Entity {
  kind: ContactKind
  label: string
  value: string
  hours: string
}

export interface ChurchProfile extends Entity {
  name: string
  district: string
  pastor: string
  cnpj: string
  foundedAt: string
  address: string
  city: string
  state: string
  motto: string
}

export interface ActivityLog extends Entity {
  message: string
  kind: string
  actor: string
}

export interface AppSettings extends Entity {
  notifyEvents: boolean
  notifyRosters: boolean
  notifyPrayers: boolean
  notifyNotices: boolean
  showSplash: boolean
}
