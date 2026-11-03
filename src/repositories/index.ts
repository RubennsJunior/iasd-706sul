import type {
  ActivityLog,
  Entity,
  AppNotification,
  AppSettings,
  AppUser,
  ChurchEvent,
  ChurchMessage,
  ChurchProfile,
  ContactInfo,
  Department,
  Hymn,
  LeaderAssignment,
  Member,
  MemberRequest,
  Position,
  PrayerItem,
  Reading,
  Role,
  Roster,
  SabbathMaterial,
  Team,
  WorshipService,
} from '../models'
import { seedEvents, seedRosters, seedServices } from '../data/seed/agenda'
import { seedHymns, seedMaterials, seedMessages, seedPrayers, seedReadings } from '../data/seed/liturgy'
import {
  seedDepartments,
  seedMembers,
  seedPositions,
  seedRoles,
  seedUsers,
} from '../data/seed/people'
import { seedRequests } from '../data/seed/requests'
import { seedLeaders, seedTeams } from '../data/seed/structure'
import {
  seedActivity,
  seedChurch,
  seedContacts,
  seedNotifications,
  seedSettings,
} from '../data/seed/system'
import { CHURCH_NAME } from '../config'
import { cloudEnabled } from '../lib/firebase'
import { hashPassword, isHashed } from '../utils/password'
import { bootstrapCloud, createFirestoreRepository } from './firestoreRepository'
import type { CloudRepository, FirestoreRepositoryOptions } from './firestoreRepository'
import {
  DATA_VERSION,
  STORAGE_NAMESPACE,
  createLocalRepository,
  ensureDataVersion,
  storage,
} from './localRepository'
import type { ResettableRepository } from './repository'

ensureDataVersion()

/** Nome de exemplo antigo; dados já salvos com ele passam a usar o nome atual. */
const LEGACY_CHURCH_NAME = 'Igreja Adventista do Sétimo Dia — Central'

/**
 * Único ponto onde a origem dos dados é escolhida: Firestore (sincronizado entre aparelhos) ou
 * localStorage (`VITE_DATA_BACKEND=local`, testes automatizados). Quem usa os repositórios não muda.
 */
function create<T extends Entity>(
  name: string,
  seed: () => T[],
  idPrefix: string,
  options?: FirestoreRepositoryOptions<T>,
): ResettableRepository<T> {
  return cloudEnabled ? createFirestoreRepository<T>(name, seed, idPrefix, options) : createLocalRepository<T>(name, seed, idPrefix)
}

/** Na nuvem a senha é gravada como resumo (hash), nunca em texto aberto. */
const protectPassword = async (data: Partial<AppUser>): Promise<Partial<AppUser>> =>
  data.password && !isHashed(data.password) ? { ...data, password: await hashPassword(data.password) } : data

export const repos = {
  members: create<Member>('members', seedMembers, 'mem'),
  users: create<AppUser>('users', seedUsers, 'user', { prepare: protectPassword }),
  roles: create<Role>('roles', seedRoles, 'role'),
  departments: create<Department>('departments', seedDepartments, 'dep'),
  positions: create<Position>('positions', seedPositions, 'pos'),
  leaders: create<LeaderAssignment>('leaders', seedLeaders, 'lead'),
  teams: create<Team>('teams', seedTeams, 'team'),
  events: create<ChurchEvent>('events', seedEvents, 'ev'),
  services: create<WorshipService>('services', seedServices, 'svc'),
  rosters: create<Roster>('rosters', seedRosters, 'ros'),
  readings: create<Reading>('readings', seedReadings, 'read'),
  hymns: create<Hymn>('hymns', seedHymns, 'hymn'),
  prayers: create<PrayerItem>('prayers', seedPrayers, 'pray'),
  messages: create<ChurchMessage>('messages', seedMessages, 'msg'),
  materials: create<SabbathMaterial>('materials', seedMaterials, 'mat'),
  notifications: create<AppNotification>('notifications', seedNotifications, 'notif'),
  contacts: create<ContactInfo>('contacts', seedContacts, 'ct'),
  church: create<ChurchProfile>('church', seedChurch, 'church'),
  settings: create<AppSettings>('settings', seedSettings, 'settings'),
  activity: create<ActivityLog>('activity', seedActivity, 'act'),
  requests: create<MemberRequest>('requests', seedRequests, 'req'),
}

void repos.church.list().then(([church]) => {
  if (church?.name === LEGACY_CHURCH_NAME) void repos.church.update(church.id, { name: CHURCH_NAME })
})

const entries = Object.entries(repos)

if (cloudEnabled) void bootstrapCloud(entries.map(([, repo]) => repo as unknown as CloudRepository<Entity>))

/** Volta todos os cadastros para os dados fictícios iniciais. */
export async function resetAllData() {
  for (const [, repo] of entries) await repo.reset()
}

export function exportAllData(): string {
  const data = Object.fromEntries(entries.map(([name, repo]) => [name, repo.dump()]))
  return JSON.stringify({ version: DATA_VERSION, exportedAt: new Date().toISOString(), data }, null, 2)
}

export async function importAllData(json: string) {
  let parsed: { version?: string; data?: Record<string, unknown[]> }
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('O arquivo não é um JSON válido.')
  }
  if (parsed.version !== DATA_VERSION || !parsed.data) {
    throw new Error('Arquivo de backup incompatível com esta versão do sistema.')
  }
  const incoming = parsed.data
  // Coleções criadas depois do backup (ex.: solicitações) voltam aos dados de exemplo.
  const optional = new Set(['requests'])
  for (const [name] of entries) {
    if (!Array.isArray(incoming[name]) && !optional.has(name)) throw new Error(`Backup incompleto: falta “${name}”.`)
  }
  for (const [name, repo] of entries) {
    if (Array.isArray(incoming[name])) await repo.load(incoming[name] as never[])
    else await repo.reset()
  }
}

export const SESSION_KEY = `${STORAGE_NAMESPACE}:session`
export { storage }
