import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Firestore de mentira: só registra o que o app grava e apaga. */
const fs = vi.hoisted(() => ({ setDoc: vi.fn(async () => undefined), deleteDoc: vi.fn(async () => undefined) }))
vi.mock('firebase/firestore', () => ({ doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }), setDoc: fs.setDoc, deleteDoc: fs.deleteDoc }))
vi.mock('./firebase', () => ({ FIREBASE_TENANT: 'teste', cloudEnabled: true, getDb: () => ({}) }))

import { disablePush, enablePush, getPushState, releaseDevice, requestPush, schedulePush, syncPush, testPush } from './push'

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-X110) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
// chave pública de exemplo (65 bytes em base64 de URL, como a do Web Push)
const PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/teste-1'
const SHA = 'ca978112ca1bbdcafac231b39a23dc4da786eff8' // (só para lembrar: sha-256 de "a" começa assim)

interface Sub {
  endpoint: string
  options: { applicationServerKey: ArrayBuffer }
  toJSON(): { endpoint: string; keys: { p256dh: string; auth: string } }
  unsubscribe: ReturnType<typeof vi.fn>
}

let current: Sub | null
let permission: 'default' | 'granted' | 'denied'
const order: string[] = []
const registration = {
  pushManager: {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async (options: { applicationServerKey: Uint8Array }) => {
      order.push('subscribe')
      current = {
        endpoint: ENDPOINT,
        options: { applicationServerKey: options.applicationServerKey.buffer as ArrayBuffer },
        toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p256', auth: 'auth' } }),
        unsubscribe: vi.fn(async () => ((current = null), true)),
      }
      return current
    }),
  },
  showNotification: vi.fn(async () => undefined),
}

const setNavigator = (userAgent: string, maxTouchPoints = 0) => {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
}

const server = (body: unknown, ok = true) => vi.fn(async (_url: string, init?: RequestInit) => ((order.push(init?.method ?? 'GET'), { ok, json: async () => body }) as Response))

beforeEach(() => {
  current = null
  permission = 'default'
  order.length = 0
  fs.setDoc.mockClear()
  fs.deleteDoc.mockClear()
  registration.showNotification.mockClear()
  registration.pushManager.getSubscription.mockClear()
  registration.pushManager.subscribe.mockClear()
  localStorage.clear()
  setNavigator(ANDROID, 5)
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(registration), getRegistration: async () => registration },
    configurable: true,
  })
  const NotificationStub = Object.assign(function () {}, {
    requestPermission: vi.fn(async () => {
      order.push('permission')
      if (permission === 'default') permission = 'granted' // o usuário toca em "Permitir"
      return permission
    }),
  })
  Object.defineProperty(NotificationStub, 'permission', { get: () => permission })
  Object.defineProperty(window, 'Notification', { value: NotificationStub, configurable: true, writable: true })
  Object.defineProperty(window, 'PushManager', { value: class {}, configurable: true, writable: true })
  vi.stubGlobal('fetch', server({ configured: true, publicKey: PUBLIC_KEY }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('estado das notificações no aparelho', () => {
  it('desligadas, bloqueadas e ligadas (navegador do Android)', async () => {
    expect(await getPushState('u1')).toEqual({ kind: 'off' })
    permission = 'denied'
    expect(await getPushState('u1')).toEqual({ kind: 'blocked' })
    permission = 'granted'
    expect(await getPushState('u1')).toEqual({ kind: 'off' }) // permitido, mas ainda não ativado por esta conta
    localStorage.setItem('igreja-sda:push:u1', '1')
    current = (await registration.pushManager.subscribe({ applicationServerKey: new Uint8Array(65) })) as Sub
    expect(await getPushState('u1')).toEqual({ kind: 'on' })
    expect(await getPushState('outra-conta')).toEqual({ kind: 'off' })
  })

  it('iPhone no Safari comum precisa instalar o app na tela de início; instalado, funciona', async () => {
    setNavigator(IPHONE, 5)
    Reflect.deleteProperty(window, 'PushManager') // no Safari de aba o iPhone não tem PushManager
    expect(await getPushState('u1')).toEqual({ kind: 'install-ios' })
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    Object.defineProperty(window, 'PushManager', { value: class {}, configurable: true, writable: true })
    expect(await getPushState('u1')).toEqual({ kind: 'off' })
    Reflect.deleteProperty(navigator, 'standalone')
  })

  it('navegador sem suporte', async () => {
    Reflect.deleteProperty(window, 'PushManager')
    expect(await getPushState('u1')).toMatchObject({ kind: 'unsupported', reason: expect.stringContaining('navegador') })
  })
})

describe('ativar', () => {
  it('pede a permissão ANTES de qualquer outra coisa (o iPhone exige o gesto), inscreve e guarda o aparelho', async () => {
    await enablePush('u1')
    expect(order.slice(0, 2)).toEqual(['permission', 'GET'])
    expect(registration.pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    expect(fs.setDoc).toHaveBeenCalledTimes(1)
    const [reference, data] = fs.setDoc.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>]
    expect(reference.path).toMatch(/^igrejas\/teste\/devices\/[0-9a-f]{40}$/)
    expect(data).toMatchObject({
      id: reference.path.split('/').pop(),
      userId: 'u1',
      kind: 'web',
      label: 'Android (navegador)',
      subscription: { endpoint: ENDPOINT, keys: { p256dh: 'p256', auth: 'auth' } },
    })
    expect(Object.keys(data).sort()).toEqual(['id', 'kind', 'label', 'subscription', 'updatedAt', 'userId']) // o que as regras do Firestore aceitam
    expect(localStorage.getItem('igreja-sda:push:u1')).toBe('1')
    expect(registration.showNotification).toHaveBeenCalledWith('Notificações ativadas', expect.objectContaining({ tag: 'iasd-ativado' }))
    expect(await getPushState('u1')).toEqual({ kind: 'on' })
  })

  it('permissão negada: mensagem clara e nada é gravado', async () => {
    permission = 'denied'
    await expect(enablePush('u1')).rejects.toThrow(/bloqueadas/)
    expect(fs.setDoc).not.toHaveBeenCalled()
    expect(localStorage.getItem('igreja-sda:push:u1')).toBeNull()
  })

  it('servidor ainda não configurado: avisa o administrador e não grava', async () => {
    vi.stubGlobal('fetch', server({ configured: false }))
    await expect(enablePush('u1')).rejects.toThrow(/configurado no servidor/)
    expect(fs.setDoc).not.toHaveBeenCalled()
  })

  it('sem conexão com o servidor de notificações', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(enablePush('u1')).rejects.toThrow(/internet/)
    vi.stubGlobal('fetch', server({}, false))
    await expect(enablePush('u1')).rejects.toThrow(/internet/)
  })

  it('servidor com problema de configuração: o app diz qual (e não "verifique a internet")', async () => {
    vi.stubGlobal('fetch', server({ configured: true, error: 'x', motivo: 'conta-de-servico-invalida', detalhe: 'y' }, false))
    await expect(enablePush('u1')).rejects.toThrow(/FIREBASE_SERVICE_ACCOUNT.*conteúdo do arquivo \.json/)
    vi.stubGlobal('fetch', server({ configured: true, motivo: 'firestore-sem-permissao' }, false))
    await expect(enablePush('u1')).rejects.toThrow(/permissão no Firestore/)
    vi.stubGlobal('fetch', server({ configured: true, motivo: 'coisa-nova' }, false))
    await expect(enablePush('u1')).rejects.toThrow(/problema de configuração \(coisa-nova\)/)
    expect(fs.setDoc).not.toHaveBeenCalled()
  })

  it('inscrição antiga com outra chave do servidor é trocada', async () => {
    const stale = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/velha',
      options: { applicationServerKey: new Uint8Array(65).buffer },
      toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/velha', keys: { p256dh: 'x', auth: 'y' } }),
      unsubscribe: vi.fn(async () => ((current = null), true)),
    }
    current = stale
    await enablePush('u1')
    expect(stale.unsubscribe).toHaveBeenCalled()
    expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(1)
  })

  it('inscrição que já usa a chave atual é reaproveitada', async () => {
    await enablePush('u1')
    registration.pushManager.subscribe.mockClear()
    await enablePush('u1')
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled()
  })

  it('teste de notificação aparece pelo service worker', async () => {
    await testPush()
    expect(registration.showNotification).toHaveBeenCalledWith('Teste de notificação', expect.objectContaining({ tag: 'iasd-teste' }))
  })
})

describe('desativar, sair da conta e renovar', () => {
  it('desativar apaga o aparelho do banco, cancela a inscrição e esquece a marca', async () => {
    await enablePush('u1')
    fs.deleteDoc.mockClear()
    const subscription = current as Sub
    await disablePush('u1')
    expect(fs.deleteDoc).toHaveBeenCalledTimes(1)
    expect(subscription.unsubscribe).toHaveBeenCalled()
    expect(localStorage.getItem('igreja-sda:push:u1')).toBeNull()
    expect(await getPushState('u1')).toEqual({ kind: 'off' })
  })

  it('sair da conta só apaga o aparelho do banco; a inscrição e a marca ficam para o próximo login', async () => {
    await enablePush('u1')
    fs.deleteDoc.mockClear()
    await releaseDevice()
    expect(fs.deleteDoc).toHaveBeenCalledTimes(1)
    expect(current).not.toBeNull()
    expect(localStorage.getItem('igreja-sda:push:u1')).toBe('1')
  })

  it('sair da conta nunca dá erro, mesmo sem aparelho ou com o banco recusando', async () => {
    await expect(releaseDevice()).resolves.toBeUndefined()
    await enablePush('u1')
    fs.deleteDoc.mockRejectedValueOnce(new Error('permission-denied'))
    await expect(releaseDevice()).resolves.toBeUndefined()
  })

  it('ao entrar de novo, se estava ativo, o aparelho é cadastrado outra vez em nome de quem entrou', async () => {
    await enablePush('u1')
    await releaseDevice()
    fs.setDoc.mockClear()
    await syncPush('u1')
    expect(fs.setDoc).toHaveBeenCalledTimes(1)
    expect((fs.setDoc.mock.calls[0] as unknown as [unknown, { userId: string }])[1].userId).toBe('u1')
  })

  it('sem a marca de ativado, ao entrar nada é cadastrado; se a permissão foi tirada, a marca é apagada', async () => {
    await syncPush('u1')
    expect(fs.setDoc).not.toHaveBeenCalled()
    localStorage.setItem('igreja-sda:push:u1', '1')
    permission = 'denied'
    await syncPush('u1')
    expect(fs.setDoc).not.toHaveBeenCalled()
    expect(localStorage.getItem('igreja-sda:push:u1')).toBeNull()
  })
})

describe('aviso ao servidor', () => {
  it('requestPush faz um POST e nunca dá erro', async () => {
    const post = server({ configured: true })
    vi.stubGlobal('fetch', post)
    await requestPush()
    expect(post).toHaveBeenCalledWith('/api/push', expect.objectContaining({ method: 'POST' }))
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
    await expect(requestPush()).resolves.toBeUndefined()
  })

  it('schedulePush avisa pouco depois da criação e de novo mais tarde', async () => {
    vi.useFakeTimers()
    const post = server({ configured: true })
    vi.stubGlobal('fetch', post)
    schedulePush()
    expect(post).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1500)
    expect(post).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(7500)
    expect(post).toHaveBeenCalledTimes(2)
  })
})

void SHA
