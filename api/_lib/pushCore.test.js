// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { audience, canReceive, flush, MAX_AGE_MS, payloadFor } from './pushCore.js'
import { readServiceAccount } from './context.js'

const NOW = Date.parse('2026-11-04T12:00:00.000Z')
const ago = (ms) => new Date(NOW - ms).toISOString()

const matrix = (notificacoes) => ({ notificacoes: { view: false, create: false, edit: false, delete: false, manage: false, ...notificacoes } })

/** Banco de mentira, em memória, com o mesmo contrato do Firestore usado em produção. */
function fakeStore({ notifications = [], devices = [], users = [], roles = [] } = {}) {
  const docs = new Map(notifications.map((n) => [n.id, { ...n.data }]))
  const removed = []
  return {
    docs,
    removed,
    async pending(limit) {
      return [...docs.entries()].filter(([, d]) => d.pushedAt === null).slice(0, limit).map(([id, data]) => ({ id, data: { ...data } }))
    },
    async claim(id, extra = {}) {
      const doc = docs.get(id)
      if (!doc || doc.pushedAt !== null) return false
      docs.set(id, { ...doc, pushedAt: new Date(NOW).toISOString(), ...extra })
      return true
    },
    async devices() {
      return devices.filter((d) => !removed.includes(d.id))
    },
    async users(ids) {
      return new Map(users.filter((u) => ids.includes(u.id)).map((u) => [u.id, u]))
    },
    async roles() {
      return roles
    },
    async removeDevice(id) {
      removed.push(id)
    },
  }
}

const notification = (id, extra = {}) => ({ id, data: { title: 'Nova escala', body: 'Confirme sua presença.', kind: 'escala', readBy: [], pushedAt: null, createdAt: ago(60_000), ...extra } })
const web = (id, userId) => ({ id, userId, kind: 'web', subscription: { endpoint: `https://push.example/${id}`, keys: { p256dh: 'k', auth: 'a' } } })
const android = (id, userId) => ({ id, userId, kind: 'android', token: `token-${id}` })

const people = {
  users: [
    { id: 'u-admin', status: 'ativo', roleId: 'role-admin' },
    { id: 'u-membro', status: 'ativo', roleId: 'role-membro' },
    { id: 'u-sem', status: 'ativo', roleId: 'role-sem' },
    { id: 'u-off', status: 'inativo', roleId: 'role-membro' },
    { id: 'u-custom', status: 'ativo', roleId: 'role-sem', customPermissions: matrix({ view: true }) },
    { id: 'u-custom-off', status: 'ativo', roleId: 'role-membro', customPermissions: matrix({ view: false }) },
  ],
  roles: [
    { id: 'role-membro', permissions: matrix({ view: true }) },
    { id: 'role-sem', permissions: matrix({ view: false }) },
  ],
}

const senders = () => ({
  sendWeb: vi.fn(async () => ({ ok: true })),
  sendFcm: vi.fn(async () => ({ ok: true })),
})

describe('quem recebe a notificação', () => {
  const rolesById = new Map(people.roles.map((r) => [r.id, r]))
  const user = (id) => people.users.find((u) => u.id === id)

  it('administrador e perfis com permissão de ver notificações', () => {
    expect(canReceive(user('u-admin'), rolesById)).toBe(true)
    expect(canReceive(user('u-membro'), rolesById)).toBe(true)
    expect(canReceive(user('u-custom'), rolesById)).toBe(true)
  })

  it('usuário inativo, perfil sem permissão, permissão própria negada ou usuário que não existe mais ficam de fora', () => {
    expect(canReceive(user('u-off'), rolesById)).toBe(false)
    expect(canReceive(user('u-sem'), rolesById)).toBe(false)
    expect(canReceive(user('u-custom-off'), rolesById)).toBe(false)
    expect(canReceive(undefined, rolesById)).toBe(false)
  })

  it('audience() separa os aparelhos de quem pode receber', async () => {
    const store = fakeStore({
      ...people,
      devices: [web('d1', 'u-membro'), android('d2', 'u-admin'), web('d3', 'u-off'), web('d4', 'u-sem'), web('d5', 'u-apagado')],
    })
    expect((await audience(store)).map((d) => d.id)).toEqual(['d1', 'd2'])
    expect(await audience(fakeStore())).toEqual([])
  })
})

describe('texto da notificação', () => {
  it('limita o tamanho e garante um título', () => {
    const payload = payloadFor('n1', { title: 'T'.repeat(300), body: 'B'.repeat(500), kind: 'aviso' })
    expect(payload.title.length).toBe(100)
    expect(payload.title.endsWith('…')).toBe(true)
    expect(payload.body.length).toBe(240)
    expect(payload).toMatchObject({ id: 'n1', kind: 'aviso', url: '/notificacoes' })
    expect(payloadFor('n2', { body: 'x' }).title).toBe('IASD')
  })
})

describe('envio das pendentes', () => {
  it('manda para os aparelhos certos, cada notificação uma única vez', async () => {
    const store = fakeStore({
      ...people,
      notifications: [notification('n1')],
      devices: [web('d1', 'u-membro'), android('d2', 'u-admin'), web('d3', 'u-off')],
    })
    const { sendWeb, sendFcm } = senders()
    const first = await flush({ store, sendWeb, sendFcm, now: () => NOW })
    expect(first).toMatchObject({ notifications: 1, sent: 2, failed: 0, removed: 0 })
    expect(sendWeb).toHaveBeenCalledTimes(1)
    expect(sendWeb.mock.calls[0][0].endpoint).toBe('https://push.example/d1')
    expect(JSON.parse(JSON.stringify(sendWeb.mock.calls[0][1]))).toMatchObject({ title: 'Nova escala', body: 'Confirme sua presença.', url: '/notificacoes', id: 'n1' })
    expect(sendFcm).toHaveBeenCalledWith('token-d2', expect.objectContaining({ id: 'n1' }))
    expect(store.docs.get('n1')).toMatchObject({ pushStatus: 'enviada' })
    expect(store.docs.get('n1').pushedAt).toBeTruthy()

    // uma segunda chamada não manda de novo
    const second = await flush({ store, sendWeb, sendFcm, now: () => NOW })
    expect(second).toMatchObject({ notifications: 0, sent: 0 })
    expect(sendWeb).toHaveBeenCalledTimes(1)
  })

  it('duas chamadas ao mesmo tempo não duplicam: só uma consegue reivindicar', async () => {
    const store = fakeStore({ ...people, notifications: [notification('n1')], devices: [web('d1', 'u-membro')] })
    const { sendWeb, sendFcm } = senders()
    const results = await Promise.all([flush({ store, sendWeb, sendFcm, now: () => NOW }), flush({ store, sendWeb, sendFcm, now: () => NOW })])
    expect(results.reduce((total, r) => total + r.sent, 0)).toBe(1)
    expect(sendWeb).toHaveBeenCalledTimes(1)
  })

  it('apaga o aparelho que não existe mais e conta as falhas passageiras', async () => {
    const store = fakeStore({
      ...people,
      notifications: [notification('n1'), notification('n2', { createdAt: ago(30_000) })],
      devices: [web('gone', 'u-membro'), web('slow', 'u-admin')],
    })
    const sendWeb = vi.fn(async (subscription) => (subscription.endpoint.endsWith('gone') ? { ok: false, gone: true } : { ok: false }))
    const result = await flush({ store, sendWeb, sendFcm: vi.fn(), now: () => NOW })
    expect(result).toMatchObject({ notifications: 2, sent: 0, failed: 2, removed: 1 })
    expect(store.removed).toEqual(['gone'])
    // o aparelho apagado não é tentado de novo na segunda notificação
    expect(sendWeb.mock.calls.filter(([s]) => s.endpoint.endsWith('gone'))).toHaveLength(1)
  })

  it('erro inesperado no envio vira falha, sem derrubar as outras', async () => {
    const store = fakeStore({ ...people, notifications: [notification('n1')], devices: [web('d1', 'u-membro'), android('d2', 'u-admin')] })
    const sendWeb = vi.fn(async () => {
      throw new Error('rede')
    })
    const sendFcm = vi.fn(async () => ({ ok: true }))
    const result = await flush({ store, sendWeb, sendFcm, now: () => NOW })
    expect(result).toMatchObject({ sent: 1, failed: 1 })
  })

  it('notificações velhas demais não são enviadas, só marcadas', async () => {
    const store = fakeStore({
      ...people,
      notifications: [notification('velha', { createdAt: ago(MAX_AGE_MS + 1000) }), notification('sem-data', { createdAt: undefined }), notification('nova')],
      devices: [web('d1', 'u-membro')],
    })
    const { sendWeb, sendFcm } = senders()
    const result = await flush({ store, sendWeb, sendFcm, now: () => NOW })
    expect(result).toMatchObject({ notifications: 1, expired: 2, sent: 1 })
    expect(store.docs.get('velha')).toMatchObject({ pushStatus: 'antiga' })
    expect(sendWeb).toHaveBeenCalledTimes(1)
  })

  it('sem nada pendente não consulta aparelhos nem usuários', async () => {
    const store = fakeStore({ ...people, notifications: [notification('n1', { pushedAt: '2026-11-04T00:00:00.000Z' })], devices: [web('d1', 'u-membro')] })
    store.devices = vi.fn(store.devices)
    const result = await flush({ store, sendWeb: vi.fn(), sendFcm: vi.fn(), now: () => NOW })
    expect(result.notifications).toBe(0)
    expect(store.devices).not.toHaveBeenCalled()
  })

  it('aparelho com registro quebrado (sem endereço) é apagado', async () => {
    const store = fakeStore({ ...people, notifications: [notification('n1')], devices: [{ id: 'quebrado', userId: 'u-membro', kind: 'web' }] })
    const result = await flush({ store, sendWeb: vi.fn(), sendFcm: vi.fn(), now: () => NOW })
    expect(result).toMatchObject({ removed: 1 })
    expect(store.removed).toEqual(['quebrado'])
  })
})

describe('conta de serviço do Firebase', () => {
  const account = { project_id: 'p', client_email: 'x@p.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n' }

  it('lê JSON puro ou em base64 e corrige as quebras de linha da chave', () => {
    const fromJson = readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify(account) })
    expect(fromJson.private_key).toBe('-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n')
    const fromBase64 = readServiceAccount({ FIREBASE_SERVICE_ACCOUNT_BASE64: Buffer.from(JSON.stringify(account)).toString('base64') })
    expect(fromBase64.project_id).toBe('p')
  })

  it('sem a variável, não há configuração', () => {
    expect(readServiceAccount({})).toBeUndefined()
    expect(readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: '   ' })).toBeUndefined()
  })
})
