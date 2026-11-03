import {
  BadgeCheck,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  Church,
  Info,
  ListChecks,
  Phone,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
  House,
  Menu,
  Package,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ActionKey, ModuleKey } from '../models'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Sem módulo, a tela é aberta a qualquer usuário logado. */
  module?: ModuleKey
  /** Ação mínima exigida no módulo; padrão: visualizar. */
  action?: ActionKey
  description?: string
  /** Mostra um contador ao lado do nome (ex.: solicitações pendentes). */
  badge?: 'requests'
}

export function canOpen(can: (module: ModuleKey, action?: ActionKey) => boolean, item: NavItem): boolean {
  return !item.module || can(item.module, item.action ?? 'view')
}

export interface NavSection {
  title: string
  icon: LucideIcon
  items: NavItem[]
}

/** As cinco áreas principais (barra inferior no celular). */
export const MAIN_NAV: NavItem[] = [
  { label: 'Início', to: '/', icon: House },
  { label: 'Eventos', to: '/eventos', icon: CalendarDays, module: 'eventos' },
  { label: 'Equipes', to: '/equipes', icon: UsersRound, module: 'equipes' },
  { label: 'Liturgia', to: '/liturgia', icon: BookOpen, module: 'liturgia' },
  { label: 'Menu', to: '/menu', icon: Menu },
]

export const MENU_SECTIONS: NavSection[] = [
  {
    title: 'Cadastros',
    icon: UsersRound,
    items: [
      { label: 'Cadastro de Usuários', description: 'Adicione ou edite usuários do aplicativo', to: '/usuarios', icon: UserCog, module: 'usuarios' },
      { label: 'Perfis de Acesso', description: 'Cadastre perfis e edite as permissões de cada um', to: '/perfis', icon: ShieldCheck, module: 'perfis' },
      { label: 'Cadastro de Membros', description: 'Gerencie os membros da igreja', to: '/membros', icon: UsersRound, module: 'membros' },
      { label: 'Solicitações de Cadastro', description: 'Analise os pedidos de novos membros', to: '/solicitacoes', icon: UserPlus, module: 'membros', badge: 'requests' },
      { label: 'Equipes e Ministérios', description: 'Cadastre e gerencie equipes e ministérios', to: '/equipes', icon: Users, module: 'equipes' },
      { label: 'Líderes', description: 'Gerencie os líderes da igreja', to: '/lideres', icon: UserCheck, module: 'lideres' },
      { label: 'Cargos e Funções', description: 'Defina os cargos e funções', to: '/cargos', icon: BadgeCheck, module: 'cargos' },
      { label: 'Departamentos', description: 'Gerencie os departamentos', to: '/departamentos', icon: Church, module: 'departamentos' },
      { label: 'Patrimônio', description: 'Gerencie os bens e patrimônios da igreja', to: '/patrimonio', icon: Package, module: 'patrimonio' },
    ],
  },
  {
    title: 'Gerenciamento',
    icon: CalendarDays,
    items: [
      { label: 'Eventos', description: 'Organize os eventos da igreja', to: '/eventos', icon: CalendarDays, module: 'eventos' },
      { label: 'Escalas', description: 'Gerencie as escalas de serviço', to: '/escalas', icon: CalendarCheck, module: 'escalas' },
      { label: 'Cultos e Programações', description: 'Configure os cultos e programações', to: '/cultos', icon: ListChecks, module: 'cultos' },
      { label: 'Liturgias', description: 'Gerencie as liturgias', to: '/liturgias', icon: BookOpen, module: 'liturgia', action: 'edit' },
      { label: 'Participantes', description: 'Visualize e gerencie participantes', to: '/participantes', icon: UsersRound, module: 'participantes' },
    ],
  },
  {
    title: 'Administração',
    icon: ShieldCheck,
    items: [
      { label: 'Notificações', description: 'Configure as notificações do app', to: '/notificacoes', icon: Bell, module: 'notificacoes' },
      { label: 'Relatórios Gerais', description: 'Acesse relatórios e estatísticas', to: '/relatorios', icon: ChartColumn, module: 'relatorios' },
    ],
  },
  {
    title: 'Configurações',
    icon: Settings,
    items: [
      { label: 'Dados da Igreja', description: 'Atualize as informações da sua igreja', to: '/igreja', icon: Church, module: 'configuracoes' },
      { label: 'Configurações do Aplicativo', description: 'Personalize o comportamento do app', to: '/configuracoes', icon: SlidersHorizontal, module: 'configuracoes' },
      { label: 'Informações de Contato', description: 'Gerencie os contatos da igreja', to: '/contatos', icon: Phone },
      { label: 'Sobre o Aplicativo', description: 'Veja informações da versão', to: '/sobre', icon: Info },
    ],
  },
]
