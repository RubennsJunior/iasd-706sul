/**
 * Envio das notificações do aplicativo para os aparelhos (Web Push no navegador/iPhone e FCM no Android).
 *
 * Aqui não há nada de nuvem: o banco e os envios entram por parâmetro (`store`, `sendWeb`, `sendFcm`), então a função
 * da Vercel usa o Firestore e o Firebase de verdade, e os testes usam versões de mentira.
 *
 * Como funciona: cada notificação nasce no app com `pushedAt: null`. Qualquer chamada a `flush` pega as pendentes,
 * "reivindica" cada uma (só uma chamada consegue, então ninguém recebe duas vezes) e manda para os aparelhos das pessoas
 * ativas cujo perfil permite ver notificações.
 */

/** Notificações mais velhas que isto nunca são enviadas (o aparelho que as criou ficou muito tempo sem internet). */
export const MAX_AGE_MS = 48 * 60 * 60 * 1000
/** Quantas notificações pendentes uma chamada processa. */
export const BATCH = 20

const clip = (text, size) => {
  const value = String(text ?? '').trim()
  return value.length > size ? `${value.slice(0, size - 1)}…` : value
}

/** Texto que aparece na notificação do aparelho. */
export function payloadFor(id, notification) {
  return {
    id,
    title: clip(notification.title, 100) || 'IASD',
    body: clip(notification.body, 240),
    kind: String(notification.kind ?? 'aviso'),
    url: '/notificacoes',
  }
}

/** Quem recebe: usuário ativo cujo perfil (ou permissões próprias) permite ver notificações. Mesma regra do firestore.rules. */
export function canReceive(user, rolesById) {
  if (!user || user.status !== 'ativo') return false
  if (user.roleId === 'role-admin') return true
  const custom = user.customPermissions && typeof user.customPermissions === 'object' ? user.customPermissions : undefined
  const matrix = custom ?? rolesById.get(user.roleId)?.permissions
  return matrix?.notificacoes?.view === true
}

/** Aparelhos que devem receber (de usuários que podem ver notificações). */
export async function audience(store) {
  const devices = await store.devices()
  if (devices.length === 0) return []
  const [users, roles] = await Promise.all([store.users([...new Set(devices.map((d) => d.userId))]), store.roles()])
  const rolesById = new Map(roles.map((r) => [r.id, r]))
  return devices.filter((device) => canReceive(users.get(device.userId), rolesById))
}

async function deliver(device, payload, { sendWeb, sendFcm }) {
  try {
    if (device.kind === 'web' && device.subscription?.endpoint) return await sendWeb(device.subscription, payload)
    if (device.kind === 'android' && device.token) return await sendFcm(device.token, payload)
  } catch {
    return { ok: false }
  }
  return { ok: false, gone: true } // registro sem endereço de envio: não serve para nada
}

/**
 * Envia as notificações pendentes. Devolve um resumo: `notifications` (processadas), `sent`, `failed`, `removed`
 * (aparelhos que não existem mais e foram apagados) e `expired`.
 */
export async function flush({ store, sendWeb, sendFcm, now = () => Date.now() }) {
  const summary = { notifications: 0, sent: 0, failed: 0, removed: 0, expired: 0 }
  const pending = (await store.pending(BATCH)).sort((a, b) => String(a.data.createdAt ?? '').localeCompare(String(b.data.createdAt ?? '')))
  if (pending.length === 0) return summary

  let targets
  const gone = new Set()
  for (const { id, data } of pending) {
    const age = now() - Date.parse(data.createdAt ?? '')
    if (!(age <= MAX_AGE_MS)) {
      if (await store.claim(id, { pushStatus: 'antiga' })) summary.expired += 1
      continue
    }
    if (!(await store.claim(id, { pushStatus: 'enviada' }))) continue // outra chamada já cuidou desta
    summary.notifications += 1
    targets ??= await audience(store)
    const payload = payloadFor(id, data)
    for (const device of targets) {
      if (gone.has(device.id)) continue
      const result = await deliver(device, payload, { sendWeb, sendFcm })
      if (result.ok) summary.sent += 1
      else if (result.gone) {
        gone.add(device.id)
        summary.removed += 1
        await store.removeDevice(device.id)
      } else summary.failed += 1
    }
  }
  return summary
}
