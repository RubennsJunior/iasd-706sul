import { lazy } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout'
import { PublicShell } from '../layouts/PublicShell'
const NotificationFormPage = lazyPage(() => import('../pages/admin/NotificationFormPage'), 'NotificationFormPage')
const NotificationsPage = lazyPage(() => import('../pages/admin/NotificationsPage'), 'NotificationsPage')
const PermissionsPage = lazyPage(() => import('../pages/admin/PermissionsPage'), 'PermissionsPage')
const ReportsPage = lazyPage(() => import('../pages/admin/ReportsPage'), 'ReportsPage')
const RolesPage = lazyPage(() => import('../pages/admin/RolesPage'), 'RolesPage')
const RegisterPage = lazyPage(() => import('../pages/public/RegisterPage'), 'RegisterPage')
const RegisterDonePage = lazyPage(() => import('../pages/public/RegisterDonePage'), 'RegisterDonePage')
const VisitorLayout = lazyPage(() => import('../pages/public/VisitorLayout'), 'VisitorLayout')
const VisitorEvents = lazyPage(() => import('../pages/public/VisitorEvents'), 'VisitorEvents')
const VisitorRosters = lazyPage(() => import('../pages/public/VisitorRosters'), 'VisitorRosters')
const EventFormPage = lazyPage(() => import('../pages/events/EventFormPage'), 'EventFormPage')
const EventDetailPage = lazyPage(() => import('../pages/events/EventDetailPage'), 'EventDetailPage')
const EventsPage = lazyPage(() => import('../pages/events/EventsPage'), 'EventsPage')
import { HomePage } from '../pages/HomePage'
const HymnsPage = lazyPage(() => import('../pages/liturgy/HymnsPage'), 'HymnsPage')
const LiturgyLayout = lazyPage(() => import('../pages/liturgy/LiturgyLayout'), 'LiturgyLayout')
const LiturgyManagePage = lazyPage(() => import('../pages/liturgy/LiturgyManagePage'), 'LiturgyManagePage')
const LiturgyToday = lazyPage(() => import('../pages/liturgy/LiturgyToday'), 'LiturgyToday')
const MessagesPage = lazyPage(() => import('../pages/liturgy/MessagesPage'), 'MessagesPage')
const PrayerFormPage = lazyPage(() => import('../pages/liturgy/PrayerFormPage'), 'PrayerFormPage')
const PrayerPage = lazyPage(() => import('../pages/liturgy/PrayerPage'), 'PrayerPage')
const ReadingCalendar = lazyPage(() => import('../pages/liturgy/ReadingCalendar'), 'ReadingCalendar')
const SabbathPage = lazyPage(() => import('../pages/liturgy/SabbathPage'), 'SabbathPage')
const WorshipSchedule = lazyPage(() => import('../pages/liturgy/WorshipSchedule'), 'WorshipSchedule')
import { LoginPage } from '../pages/Login'
import { WelcomePage } from '../pages/public/WelcomePage'
const ParticipantFormPage = lazyPage(() => import('../pages/management/ParticipantFormPage'), 'ParticipantFormPage')
const ParticipantsPage = lazyPage(() => import('../pages/management/ParticipantsPage'), 'ParticipantsPage')
const RosterFormPage = lazyPage(() => import('../pages/management/RosterFormPage'), 'RosterFormPage')
const RostersPage = lazyPage(() => import('../pages/management/RostersPage'), 'RostersPage')
const ServicesPage = lazyPage(() => import('../pages/management/ServicesPage'), 'ServicesPage')
const MenuPage = lazyPage(() => import('../pages/MenuPage'), 'MenuPage')
const DepartmentsPage = lazyPage(() => import('../pages/registry/DepartmentsPage'), 'DepartmentsPage')
const PatrimonioPage = lazyPage(() => import('../pages/registry/PatrimonioPage'), 'PatrimonioPage')
const LeadersPage = lazyPage(() => import('../pages/registry/LeadersPage'), 'LeadersPage')
const RequestsPage = lazyPage(() => import('../pages/registry/RequestsPage'), 'RequestsPage')
const RequestReviewPage = lazyPage(() => import('../pages/registry/RequestReviewPage'), 'RequestReviewPage')
const MembersPage = lazyPage(() => import('../pages/registry/MembersPage'), 'MembersPage')
const PositionsPage = lazyPage(() => import('../pages/registry/PositionsPage'), 'PositionsPage')
const UsersPage = lazyPage(() => import('../pages/registry/UsersPage'), 'UsersPage')
const AboutPage = lazyPage(() => import('../pages/settings/AboutPage'), 'AboutPage')
const AppSettingsPage = lazyPage(() => import('../pages/settings/AppSettingsPage'), 'AppSettingsPage')
const ChurchFormPage = lazyPage(() => import('../pages/settings/ChurchFormPage'), 'ChurchFormPage')
const ChurchPage = lazyPage(() => import('../pages/settings/ChurchPage'), 'ChurchPage')
const ContactsPage = lazyPage(() => import('../pages/settings/ContactsPage'), 'ContactsPage')
const TeamFormPage = lazyPage(() => import('../pages/teams/TeamFormPage'), 'TeamFormPage')
const TeamDetailPage = lazyPage(() => import('../pages/teams/TeamDetailPage'), 'TeamDetailPage')
const TeamsPage = lazyPage(() => import('../pages/teams/TeamsPage'), 'TeamsPage')
import type { ModuleKey } from '../models'
import { Guard, NotFound } from './guards'

/** Carrega a tela só quando ela é aberta, mantendo o primeiro carregamento leve. */
function lazyPage(loader: () => Promise<Record<string, unknown>>, name: string) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType }))
}

const guarded = (module: ModuleKey, element: ReactNode) => <Guard module={module}>{element}</Guard>

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route path="login" element={<WelcomePage />} />
        <Route path="entrar" element={<LoginPage />} />
        <Route path="cadastro" element={<RegisterPage />} />
        <Route path="cadastro/enviado" element={<RegisterDonePage />} />
        <Route path="visitante" element={<VisitorLayout />}>
          <Route index element={<VisitorEvents />} />
          <Route path="escalas" element={<VisitorRosters />} />
        </Route>
      </Route>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="menu" element={<MenuPage />} />

        <Route path="eventos" element={guarded('eventos', <EventsPage />)} />
        <Route path="eventos/novo" element={guarded('eventos', <EventFormPage />)} />
        <Route path="eventos/:id" element={guarded('eventos', <EventDetailPage />)} />
        <Route path="eventos/:id/editar" element={guarded('eventos', <EventFormPage />)} />

        <Route path="equipes" element={guarded('equipes', <TeamsPage />)} />
        <Route path="equipes/nova" element={guarded('equipes', <TeamFormPage />)} />
        <Route path="equipes/:id" element={guarded('equipes', <TeamDetailPage />)} />
        <Route path="equipes/:id/editar" element={guarded('equipes', <TeamFormPage />)} />

        <Route path="liturgia/oracao/novo" element={guarded('liturgia', <PrayerFormPage />)} />
        <Route path="liturgia" element={guarded('liturgia', <LiturgyLayout />)}>
          <Route index element={<LiturgyToday />} />
          <Route path="calendario" element={<ReadingCalendar />} />
          <Route path="hinos" element={<HymnsPage />} />
          <Route path="oracao" element={<PrayerPage />} />
          <Route path="mensagens" element={<MessagesPage />} />
          <Route path="escola-sabatina" element={<SabbathPage />} />
          <Route path="cultos/*" element={<WorshipSchedule />} />
        </Route>
        <Route path="liturgias/*" element={<Guard module="liturgia" action="edit"><LiturgyManagePage /></Guard>} />

        <Route path="membros/*" element={guarded('membros', <MembersPage />)} />
        <Route path="solicitacoes" element={guarded('membros', <RequestsPage />)} />
        <Route path="solicitacoes/:id" element={guarded('membros', <RequestReviewPage />)} />
        <Route path="usuarios/*" element={guarded('usuarios', <UsersPage />)} />
        <Route path="lideres/*" element={guarded('lideres', <LeadersPage />)} />
        <Route path="cargos/*" element={guarded('cargos', <PositionsPage />)} />
        <Route path="departamentos/*" element={guarded('departamentos', <DepartmentsPage />)} />
        <Route path="patrimonio/*" element={guarded('patrimonio', <PatrimonioPage />)} />

        <Route path="escalas" element={guarded('escalas', <RostersPage />)} />
        <Route path="escalas/nova" element={guarded('escalas', <RosterFormPage />)} />
        <Route path="escalas/:id/editar" element={guarded('escalas', <RosterFormPage />)} />
        <Route path="cultos/*" element={guarded('cultos', <ServicesPage />)} />
        <Route path="participantes" element={guarded('participantes', <ParticipantsPage />)} />
        <Route path="participantes/novo" element={guarded('participantes', <ParticipantFormPage />)} />

        <Route path="perfis/*" element={guarded('perfis', <RolesPage />)} />
        <Route path="permissoes" element={guarded('permissoes', <PermissionsPage />)} />
        <Route path="notificacoes" element={guarded('notificacoes', <NotificationsPage />)} />
        <Route path="notificacoes/nova" element={guarded('notificacoes', <NotificationFormPage />)} />
        <Route path="relatorios" element={guarded('relatorios', <ReportsPage />)} />

        <Route path="igreja" element={guarded('configuracoes', <ChurchPage />)} />
        <Route path="igreja/editar" element={guarded('configuracoes', <ChurchFormPage />)} />
        <Route path="configuracoes" element={guarded('configuracoes', <AppSettingsPage />)} />
        <Route path="contatos/*" element={<ContactsPage />} />
        <Route path="sobre" element={<AboutPage />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
