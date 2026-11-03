import type {
  ActiveStatus,
  AssignmentStatus,
  ContactKind,
  CoverKey,
  EventStatus,
  MemberStatus,
  MessageKind,
  NotificationKind,
  ParticipantStatus,
  PrayerKind,
  PrayerStatus,
  RequestStatus,
  UserStatus,
} from '../models'
import type { EventPhase } from '../services'

export interface Option<V extends string = string> {
  value: V
  label: string
}

const options = <V extends string>(map: Record<V, string>): Option<V>[] =>
  (Object.keys(map) as V[]).map((value) => ({ value, label: map[value] }))

export const MEMBER_STATUS: Record<MemberStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  afastado: 'Afastado',
  visitante: 'Visitante',
}
export const MEMBER_STATUS_OPTIONS = options(MEMBER_STATUS)

export const USER_STATUS: Record<UserStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  bloqueado: 'Bloqueado',
}
export const USER_STATUS_OPTIONS = options(USER_STATUS)

export const ACTIVE_STATUS: Record<ActiveStatus, string> = { ativa: 'Ativa', inativa: 'Inativa' }
export const ACTIVE_STATUS_OPTIONS = options(ACTIVE_STATUS)

export const EVENT_STATUS: Record<EventStatus, string> = {
  planejado: 'Planejado',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}
export const EVENT_STATUS_OPTIONS = options(EVENT_STATUS)

export const EVENT_PHASE: Record<EventPhase, string> = { ...EVENT_STATUS, 'em-breve': 'Em breve' }

export const PARTICIPANT_STATUS: Record<ParticipantStatus, string> = {
  inscrito: 'Inscrito',
  confirmado: 'Confirmado',
  presente: 'Presente',
  ausente: 'Ausente',
}
export const PARTICIPANT_STATUS_OPTIONS = options(PARTICIPANT_STATUS)

export const ASSIGNMENT_STATUS: Record<AssignmentStatus, string> = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  recusado: 'Recusado',
}
export const ASSIGNMENT_STATUS_OPTIONS = options(ASSIGNMENT_STATUS)

export const PRAYER_KIND: Record<PrayerKind, string> = { oracao: 'Oração', pedido: 'Pedido de oração' }
export const PRAYER_KIND_OPTIONS = options(PRAYER_KIND)
export const PRAYER_STATUS: Record<PrayerStatus, string> = { aberto: 'Em oração', atendido: 'Atendido' }
export const PRAYER_STATUS_OPTIONS = options(PRAYER_STATUS)

export const REQUEST_STATUS: Record<RequestStatus, string> = {
  pendente: 'Aguardando análise',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
}

export const MESSAGE_KIND: Record<MessageKind, string> = { mensagem: 'Mensagem', reflexao: 'Reflexão' }
export const MESSAGE_KIND_OPTIONS = options(MESSAGE_KIND)

export const NOTIFICATION_KIND: Record<NotificationKind, string> = {
  evento: 'Evento',
  escala: 'Escala',
  oracao: 'Oração',
  aviso: 'Aviso',
  sistema: 'Sistema',
}
export const NOTIFICATION_KIND_OPTIONS = options(NOTIFICATION_KIND)

export const CONTACT_KIND: Record<ContactKind, string> = {
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  endereco: 'Endereço',
  site: 'Site',
  'rede-social': 'Rede social',
}
export const CONTACT_KIND_OPTIONS = options(CONTACT_KIND)

export const COVER_LABELS: Record<CoverKey, string> = {
  louvor: 'Louvor',
  ceia: 'Santa Ceia',
  estudo: 'Estudo bíblico',
  criancas: 'Crianças',
  oracao: 'Oração',
  jovens: 'Jovens',
  familia: 'Família',
  geral: 'Geral',
}
export const COVER_OPTIONS = options(COVER_LABELS)

export const SERVICE_KINDS = [
  'Escola Sabatina',
  'Culto Divino',
  'Culto de Louvor',
  'Reunião de Oração',
  'Programação Jovem',
  'Culto Infantil',
  'Santa Ceia',
  'Outro',
].map((value) => ({ value, label: value }))

export const AGE_GROUPS = ['Adultos', 'Jovens', 'Crianças', 'Todos'].map((value) => ({
  value,
  label: value,
}))

export const TEAM_ICON_OPTIONS: Option[] = [
  { value: 'music', label: 'Música' },
  { value: 'handshake', label: 'Acolhimento' },
  { value: 'video', label: 'Mídia' },
  { value: 'praying', label: 'Oração' },
  { value: 'baby', label: 'Crianças' },
  { value: 'church', label: 'Igreja' },
  { value: 'book', label: 'Estudo' },
  { value: 'users', label: 'Grupo' },
  { value: 'heart', label: 'Família' },
]
