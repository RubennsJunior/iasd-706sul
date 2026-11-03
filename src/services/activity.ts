import { repos } from '../repositories'

let actor = 'Sistema'

/** Quem está logado; usado só para identificar o autor no registro de atividades. */
export function setActor(name: string) {
  actor = name
}

export async function logActivity(message: string, kind: string) {
  await repos.activity.create({ message, kind, actor })
  const all = await repos.activity.list()
  const surplus = all
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(60)
  for (const old of surplus) await repos.activity.remove(old.id)
}
