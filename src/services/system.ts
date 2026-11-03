import type {
  AppNotification,
  AppSettings,
  AppUser,
  ChurchProfile,
  ContactInfo,
  Entity,
  ID,
  NewEntity,
} from '../models'
import { repos } from '../repositories'
import type { Repository } from '../repositories/repository'
import { isValidEmail } from '../utils/misc'
import { verifyPassword } from '../utils/password'
import { createCrudService } from './crud'

const NOTIFY_FLAG = {
  evento: 'notifyEvents',
  escala: 'notifyRosters',
  oracao: 'notifyPrayers',
  aviso: 'notifyNotices',
} as const

/** Cria uma notificação automática, respeitando as preferências do aplicativo. */
export async function notify(kind: AppNotification['kind'], title: string, body: string) {
  if (kind !== 'sistema') {
    const [settings] = await repos.settings.list()
    if (settings && settings[NOTIFY_FLAG[kind]] === false) return
  }
  await repos.notifications.create({ kind, title, body, readBy: [] })
}

export const notificationsService = {
  ...createCrudService<AppNotification>(repos.notifications, {
    label: 'Notificação',
    feminine: true,
    activityKind: 'aviso',
    nameOf: (n) => n.title,
    silent: true,
  }),

  async markRead(id: ID, userId: ID) {
    const item = await repos.notifications.get(id)
    if (!item || item.readBy.includes(userId)) return
    await repos.notifications.update(id, { readBy: [...item.readBy, userId] })
  },

  async markAllRead(userId: ID) {
    for (const item of await repos.notifications.list()) {
      if (!item.readBy.includes(userId)) {
        await repos.notifications.update(item.id, { readBy: [...item.readBy, userId] })
      }
    }
  },
}

export const contactsService = createCrudService<ContactInfo>(repos.contacts, {
  label: 'Contato',
  activityKind: 'contato',
  nameOf: (c) => c.label,
  silent: true,
})

async function saveSingleton<T extends Entity>(repo: Repository<T>, patch: Partial<NewEntity<T>>) {
  const [current] = await repo.list()
  if (!current) throw new Error('Configuração não encontrada.')
  return repo.update(current.id, patch)
}

export const churchService = {
  async get(): Promise<ChurchProfile> {
    return (await repos.church.list())[0]
  },
  save(patch: Partial<NewEntity<ChurchProfile>>) {
    return saveSingleton(repos.church, patch)
  },
}

export const settingsService = {
  async get(): Promise<AppSettings> {
    return (await repos.settings.list())[0]
  },
  save(patch: Partial<NewEntity<AppSettings>>) {
    return saveSingleton(repos.settings, patch)
  },
}

/** Confere e-mail e senha dos usuários cadastrados (a senha pode estar em texto simples ou como hash). */
export async function authenticate(email: string, password: string): Promise<AppUser> {
  if (!isValidEmail(email.trim())) throw new Error('Informe um e-mail válido.')
  const users = await repos.users.list()
  const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user || !(await verifyPassword(password, user.password))) throw new Error('E-mail ou senha incorretos.')
  if (user.status !== 'ativo') throw new Error('Este usuário está inativo ou bloqueado.')
  return repos.users.update(user.id, { lastLoginAt: new Date().toISOString() })
}
