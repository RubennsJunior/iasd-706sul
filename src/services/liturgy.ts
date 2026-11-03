import type { ChurchMessage, Hymn, ID, PrayerItem, Reading, SabbathMaterial } from '../models'
import { repos } from '../repositories'
import { todayISO } from '../utils/date'
import { createCrudService } from './crud'

export const readingsService = createCrudService<Reading>(repos.readings, {
  label: 'Leitura',
  feminine: true,
  activityKind: 'liturgia',
  nameOf: (r) => r.reference,
  async validate(data, existing) {
    const all = await repos.readings.list()
    if (all.some((r) => r.id !== existing?.id && r.date === data.date)) {
      throw new Error('Já existe uma leitura cadastrada para esta data.')
    }
  },
})

/** Leitura da data; se não houver, usa a mais próxima à frente e, por fim, a mais recente. */
export function readingFor(readings: Reading[], date: string = todayISO()): Reading | undefined {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date))
  return (
    sorted.find((r) => r.date === date) ??
    sorted.find((r) => r.date > date) ??
    sorted[sorted.length - 1]
  )
}

export const hymnsService = {
  ...createCrudService<Hymn>(repos.hymns, {
    label: 'Hino',
    activityKind: 'liturgia',
    nameOf: (h) => h.title,
    async validate(data, existing) {
      const all = await repos.hymns.list()
      if (all.some((h) => h.id !== existing?.id && h.number === data.number)) {
        throw new Error(`O hino nº ${data.number} já está cadastrado.`)
      }
    },
  }),

  async toggleFavorite(hymnId: ID, userId: ID) {
    const hymn = await repos.hymns.get(hymnId)
    if (!hymn) throw new Error('Hino não encontrado.')
    const favoriteBy = hymn.favoriteBy.includes(userId)
      ? hymn.favoriteBy.filter((id) => id !== userId)
      : [...hymn.favoriteBy, userId]
    return repos.hymns.update(hymnId, { favoriteBy })
  },
}

export const prayersService = {
  ...createCrudService<PrayerItem>(repos.prayers, {
    label: 'Oração',
    feminine: true,
    activityKind: 'liturgia',
    nameOf: (p) => p.title,
  }),

  async togglePrayed(prayerId: ID, userId: ID) {
    const prayer = await repos.prayers.get(prayerId)
    if (!prayer) throw new Error('Pedido não encontrado.')
    const prayedBy = prayer.prayedBy.includes(userId)
      ? prayer.prayedBy.filter((id) => id !== userId)
      : [...prayer.prayedBy, userId]
    return repos.prayers.update(prayerId, { prayedBy })
  },

  async markAnswered(prayerId: ID, answered: boolean) {
    return repos.prayers.update(prayerId, { status: answered ? 'atendido' : 'aberto' })
  },
}

export const messagesService = createCrudService<ChurchMessage>(repos.messages, {
  label: 'Mensagem',
  feminine: true,
  activityKind: 'liturgia',
  nameOf: (m) => m.title,
})

export const materialsService = createCrudService<SabbathMaterial>(repos.materials, {
  label: 'Material',
  activityKind: 'liturgia',
  nameOf: (m) => m.title,
})
