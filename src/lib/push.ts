import { Capacitor } from '@capacitor/core'
import { deleteDoc, doc, setDoc } from 'firebase/firestore'
import { FIREBASE_TENANT, cloudEnabled, getDb } from './firebase'

/**
 * Notificações no aparelho (push), mesmo com o app fechado.
 *
 * - Navegador e iPhone (app instalado na tela de início): Web Push. O aparelho se inscreve no serviço de notificações do
 *   navegador usando a chave pública do servidor e guarda a inscrição em `igrejas/<igreja>/devices/<id>`.
 * - Android (APK): FCM pelo plugin do Capacitor; o que se guarda é o token do aparelho.
 * - Quem envia é a função `api/push.js` (Vercel): lê as notificações novas e manda para os aparelhos das pessoas que
 *   podem ver notificações. O aplicativo só avisa a função de que há notificação nova (`schedulePush`).
 */

const env = import.meta.env as Record<string, string | undefined>
const native = Capacitor.isNativePlatform()

/** Endereço da função de envio. No APK o app abre de https://localhost, então usa o endereço do site. */
export const PUSH_API = env.VITE_PUSH_API || (native ? 'https://iasd-706sul.vercel.app/api/push' : '/api/push')

/** O APK só recebe push quando o google-services.json do Firebase está dentro dele (o build liga esta marca). */
const ANDROID_PUSH = Boolean(env.VITE_ANDROID_PUSH)

export type PushState =
  | { kind: 'unsupported'; reason: string }
  /** iPhone/iPad no Safari comum: as notificações só funcionam com o app instalado na tela de início. */
  | { kind: 'install-ios' }
  | { kind: 'blocked' }
  | { kind: 'off' }
  | { kind: 'on' }

const MESSAGES = {
  blocked: 'As notificações estão bloqueadas para este aplicativo. Libere nas configurações do aparelho (veja as instruções abaixo) e tente de novo.',
  notConfigured: 'O envio de notificações ainda não foi configurado no servidor. Peça ao administrador do sistema (veja o README).',
  offline: 'Não foi possível falar com o servidor de notificações. Verifique a internet e tente de novo.',
  noWorker: 'O aplicativo ainda não terminou de se preparar para as notificações. Feche, abra de novo e tente outra vez.',
  androidNotReady: 'Este aplicativo ainda não foi preparado para receber notificações (falta o arquivo google-services.json do Firebase no APK).',
  cloudOff: 'As notificações no aparelho precisam do sistema ligado à nuvem.',
  browser: 'Este navegador não recebe notificações. No Android use o Chrome; no iPhone, instale o app na tela de início e abra por ele.',
  subscribeTimeout: 'O navegador não conseguiu se registrar no serviço de notificações. Verifique a internet (e se algum bloqueador está ativo) e tente de novo.',
}

/** Quanto esperar o navegador se inscrever (a primeira vez, num navegador novo, leva uns 20 segundos). */
const SUBSCRIBE_TIMEOUT_MS = 45_000

/* ----------------------------------------------------------------------------------------------------------------- */
/* Funções puras (testadas em src/lib/push.test.ts)                                                                   */
/* ----------------------------------------------------------------------------------------------------------------- */

/** Chave pública do Web Push (base64 de URL) para os bytes que o navegador pede. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Código do aparelho no banco: SHA-256 do endereço da inscrição (ou do token), sem expor o endereço no código. */
export async function deviceIdFor(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 40)
}

/** iPhone/iPad (inclusive iPad que se apresenta como Mac) e se o app está aberto pela tela de início. */
export function detectPlatform(userAgent: string, maxTouchPoints: number, standalone: boolean) {
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  return { ios, standalone }
}

/** Descrição curta do aparelho, guardada junto da inscrição. */
export function deviceLabel(userAgent: string, isNativeApp: boolean): string {
  if (isNativeApp) return 'Aplicativo Android'
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iPhone/iPad (app instalado)'
  if (/Android/i.test(userAgent)) return 'Android (navegador)'
  return 'Computador (navegador)'
}

/** Espera a promessa, mas desiste com a mensagem dada se passar do tempo. */
function within<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function sameBytes(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false
  const view = new Uint8Array(a)
  return view.every((byte, i) => byte === b[i])
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Memória do aparelho                                                                                                 */
/* ----------------------------------------------------------------------------------------------------------------- */

const flagKey = (uid: string) => `igreja-sda:push:${uid}`
const TOKEN_KEY = 'igreja-sda:push-token'

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // sem armazenamento: o app continua, só não lembra que as notificações estão ativas
  }
}

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/* ----------------------------------------------------------------------------------------------------------------- */
/* Servidor e banco                                                                                                    */
/* ----------------------------------------------------------------------------------------------------------------- */

/** O que dizer a quem usa o app quando o servidor de notificações responde que está com problema de configuração. */
export function serverProblem(motivo: string): string {
  const known: Record<string, string> = {
    'conta-de-servico-invalida':
      'A chave do servidor de notificações está incorreta na Vercel (variável FIREBASE_SERVICE_ACCOUNT): ela deve ser o conteúdo do arquivo .json, e não o nome do arquivo. Avise o administrador.',
    'firestore-sem-permissao': 'A conta de serviço do servidor de notificações não tem permissão no Firestore. Avise o administrador.',
    'firestore-nao-encontrado': 'O servidor de notificações não achou o banco de dados do Firebase. Avise o administrador.',
    'api-do-firebase-desativada': 'Uma API do Firebase está desativada para o servidor de notificações. Avise o administrador.',
    rede: 'O servidor de notificações não conseguiu falar com o Firebase agora. Tente de novo em instantes.',
  }
  return known[motivo] ?? `O servidor de notificações está com um problema de configuração (${motivo}). Avise o administrador.`
}

async function fetchKey(): Promise<{ configured: boolean; publicKey?: string }> {
  let response: Response
  try {
    response = await fetch(PUSH_API, { cache: 'no-store' })
  } catch {
    throw new Error(MESSAGES.offline)
  }
  const body = (await response.json().catch(() => undefined)) as { configured: boolean; publicKey?: string; motivo?: string } | undefined
  if (body?.motivo) throw new Error(serverProblem(body.motivo))
  if (!response.ok || !body) throw new Error(MESSAGES.offline)
  return body
}

const deviceRef = (id: string) => doc(getDb(), 'igrejas', FIREBASE_TENANT, 'devices', id)

type DeviceData = { kind: 'web'; subscription: { endpoint: string; keys: { p256dh: string; auth: string } } } | { kind: 'android'; token: string }

async function saveDevice(uid: string, id: string, data: DeviceData) {
  await setDoc(deviceRef(id), { id, userId: uid, label: deviceLabel(navigator.userAgent, native), ...data, updatedAt: new Date().toISOString() })
}

async function readyWorker(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), 8000))
  const registration = await Promise.race([navigator.serviceWorker.ready, timeout])
  if (!registration) throw new Error(MESSAGES.noWorker)
  return registration
}

/** Código do aparelho de agora (a inscrição do navegador ou o token do Android), se já houver. */
async function currentDeviceId(): Promise<string | undefined> {
  if (native) {
    const token = read(TOKEN_KEY)
    return token ? deviceIdFor(token) : undefined
  }
  if (!('serviceWorker' in navigator)) return undefined
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager?.getSubscription()
  return subscription ? deviceIdFor(subscription.endpoint) : undefined
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Estado e ações                                                                                                      */
/* ----------------------------------------------------------------------------------------------------------------- */

/** O que a tela deve mostrar sobre as notificações deste aparelho para esta pessoa. */
export async function getPushState(uid: string): Promise<PushState> {
  if (!cloudEnabled) return { kind: 'unsupported', reason: MESSAGES.cloudOff }

  if (native) {
    if (Capacitor.getPlatform() !== 'android' || !ANDROID_PUSH) return { kind: 'unsupported', reason: MESSAGES.androidNotReady }
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const { receive } = await PushNotifications.checkPermissions()
    if (receive === 'denied') return { kind: 'blocked' }
    return receive === 'granted' && read(flagKey(uid)) === '1' ? { kind: 'on' } : { kind: 'off' }
  }

  const { ios, standalone: installed } = detectPlatform(navigator.userAgent, navigator.maxTouchPoints, standalone())
  if (ios && !installed) return { kind: 'install-ios' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { kind: 'unsupported', reason: MESSAGES.browser }
  if (Notification.permission === 'denied') return { kind: 'blocked' }
  if (Notification.permission === 'granted' && read(flagKey(uid)) === '1' && (await currentDeviceId())) return { kind: 'on' }
  return { kind: 'off' }
}

async function subscribeWeb(): Promise<{ id: string; data: DeviceData; registration: ServiceWorkerRegistration } | undefined> {
  const { configured, publicKey } = await fetchKey()
  if (!configured || !publicKey) return undefined
  const registration = await readyWorker()
  const key = urlBase64ToUint8Array(publicKey)
  let subscription = await registration.pushManager.getSubscription()
  // a chave do servidor mudou (outro servidor ou chaves novas): a inscrição antiga não serve mais
  if (subscription && !sameBytes(subscription.options?.applicationServerKey, key)) {
    await subscription.unsubscribe()
    subscription = null
  }
  // Num navegador novo a primeira inscrição pode levar uns 20 segundos (o navegador se registra no serviço de notificações).
  subscription ??= await within(registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }), SUBSCRIBE_TIMEOUT_MS, MESSAGES.subscribeTimeout)
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error(MESSAGES.browser)
  return {
    id: await deviceIdFor(json.endpoint),
    data: { kind: 'web', subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } } },
    registration,
  }
}

async function registerAndroid(askPermission: boolean): Promise<string | undefined> {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  let { receive } = await PushNotifications.checkPermissions()
  if (receive !== 'granted' && askPermission) receive = (await PushNotifications.requestPermissions()).receive
  if (receive === 'denied' && askPermission) throw new Error(MESSAGES.blocked)
  if (receive !== 'granted') return undefined
  await PushNotifications.createChannel({ id: 'avisos', name: 'Avisos da igreja', description: 'Eventos, escalas, orações e comunicados', importance: 4, visibility: 1, vibration: true })
  return new Promise<string>((resolve, reject) => {
    const handles: Array<Promise<{ remove(): Promise<void> }>> = []
    const done = (action: () => void) => {
      window.clearTimeout(timer)
      handles.forEach((handle) => void handle.then((h) => h.remove()))
      action()
    }
    const timer = window.setTimeout(() => done(() => reject(new Error(MESSAGES.offline))), 20000)
    handles.push(PushNotifications.addListener('registration', ({ value }) => done(() => resolve(value))))
    handles.push(PushNotifications.addListener('registrationError', ({ error }) => done(() => reject(new Error(error || MESSAGES.offline)))))
    PushNotifications.register().catch((error: unknown) => done(() => reject(error instanceof Error ? error : new Error(MESSAGES.offline))))
  })
}

/** Liga as notificações neste aparelho. Chamar direto de um toque do usuário (o iPhone exige). Lança Error com mensagem pronta. */
export async function enablePush(uid: string): Promise<void> {
  if (!cloudEnabled) throw new Error(MESSAGES.cloudOff)

  if (native) {
    if (!ANDROID_PUSH) throw new Error(MESSAGES.androidNotReady)
    const { configured } = await fetchKey()
    if (!configured) throw new Error(MESSAGES.notConfigured)
    const token = await registerAndroid(true)
    if (!token) throw new Error(MESSAGES.blocked)
    await saveDevice(uid, await deviceIdFor(token), { kind: 'android', token })
    write(TOKEN_KEY, token)
    write(flagKey(uid), '1')
    return
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error(MESSAGES.browser)
  // A permissão vem primeiro, ainda dentro do toque: no iPhone, esperar por qualquer coisa antes dela perde o "gesto".
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? MESSAGES.blocked : 'As notificações não foram permitidas neste aparelho.')
  const subscribed = await subscribeWeb()
  if (!subscribed) throw new Error(MESSAGES.notConfigured)
  await saveDevice(uid, subscribed.id, subscribed.data)
  write(flagKey(uid), '1')
  await subscribed.registration.showNotification('Notificações ativadas', {
    body: 'Você vai receber os avisos da igreja neste aparelho.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: 'iasd-ativado',
    lang: 'pt-BR',
    data: { url: '/notificacoes' },
  })
}

/** Mostra uma notificação de teste neste aparelho (só navegador/iPhone: confere se o aparelho consegue exibir). */
export async function testPush(): Promise<void> {
  const registration = await readyWorker()
  await registration.showNotification('Teste de notificação', {
    body: 'Se você está lendo isto, as notificações aparecem neste aparelho.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: 'iasd-teste',
    lang: 'pt-BR',
    data: { url: '/notificacoes' },
  })
}

/** Desliga as notificações neste aparelho: apaga o cadastro do aparelho e a inscrição. */
export async function disablePush(uid: string): Promise<void> {
  const id = await currentDeviceId()
  if (id) await deleteDoc(deviceRef(id))
  if (native) {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.unregister().catch(() => undefined)
    write(TOKEN_KEY, null)
  } else if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager?.getSubscription()
    await subscription?.unsubscribe().catch(() => undefined)
  }
  write(flagKey(uid), null)
}

/**
 * Ao sair da conta: o aparelho deixa de receber os avisos de quem saiu (apaga só o cadastro do aparelho no banco).
 * A permissão e a inscrição continuam, então ao entrar de novo tudo volta sozinho (`syncPush`). Nunca lança erro.
 */
export async function releaseDevice(): Promise<void> {
  try {
    if (!cloudEnabled) return
    const id = await currentDeviceId()
    if (id) await Promise.race([deleteDoc(deviceRef(id)), new Promise<void>((resolve) => window.setTimeout(resolve, 3000))])
  } catch {
    // sem conexão ou sem permissão: o servidor limpa o aparelho na próxima falha de envio
  }
}

/** Ao abrir o app já logado: se as notificações estavam ativas, renova o cadastro do aparelho (token novo, conta trocada…). */
export async function syncPush(uid: string): Promise<void> {
  if (!cloudEnabled || read(flagKey(uid)) !== '1') return
  try {
    if (native) {
      if (!ANDROID_PUSH) return
      const token = await registerAndroid(false)
      if (!token) return write(flagKey(uid), null)
      await saveDevice(uid, await deviceIdFor(token), { kind: 'android', token })
      write(TOKEN_KEY, token)
      return
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') return write(flagKey(uid), null)
    const subscribed = await subscribeWeb()
    if (subscribed) await saveDevice(uid, subscribed.id, subscribed.data)
  } catch {
    // tenta de novo na próxima abertura
  }
}

/* ----------------------------------------------------------------------------------------------------------------- */
/* Aviso ao servidor                                                                                                   */
/* ----------------------------------------------------------------------------------------------------------------- */

/** Pede ao servidor que envie as notificações novas. Sem erro: se falhar, a próxima chamada de qualquer aparelho resolve. */
export function requestPush(): Promise<void> {
  if (!cloudEnabled) return Promise.resolve()
  return fetch(PUSH_API, { method: 'POST', keepalive: true }).then(
    () => undefined,
    () => undefined,
  )
}

/**
 * Uma notificação acabou de ser criada: avisa o servidor logo depois (para a gravação já ter chegado ao banco) e de novo
 * mais tarde, caso a primeira tentativa tenha sido cedo demais. Enviar duas vezes é inofensivo: cada notificação sai uma só vez.
 */
export function schedulePush(): void {
  if (!cloudEnabled || typeof window === 'undefined') return
  for (const delay of [1500, 9000]) window.setTimeout(() => void requestPush(), delay)
}
