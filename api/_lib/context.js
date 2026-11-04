/**
 * Monta, uma vez por instância da função, tudo que o envio precisa: Firestore, chaves VAPID e os dois remetentes
 * (Web Push e FCM). Devolve `null` enquanto o servidor não foi configurado com a conta de serviço do Firebase.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import webpush from 'web-push'
import { firestoreStore } from './firestoreStore.js'

/** Lê a conta de serviço de `FIREBASE_SERVICE_ACCOUNT` (JSON) ou `FIREBASE_SERVICE_ACCOUNT_BASE64`. */
export function readServiceAccount(env = process.env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT?.trim() || (env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8') : '')
  if (!raw) return undefined
  const account = JSON.parse(raw)
  if (typeof account.private_key === 'string') account.private_key = account.private_key.replace(/\\n/g, '\n')
  return account
}

let cached

export async function getContext(env = process.env) {
  if (cached) return cached
  const emulator = Boolean(env.FIRESTORE_EMULATOR_HOST)
  const account = emulator ? undefined : readServiceAccount(env)
  if (!account && !emulator) return null

  const tenant = env.FIREBASE_TENANT || 'iasd-706-sul'
  const app =
    getApps()[0] ??
    initializeApp(account ? { credential: cert(account), projectId: account.project_id } : { projectId: env.FIREBASE_PROJECT_ID || 'demo-igreja' })
  const store = firestoreStore(getFirestore(app), tenant)

  const keys = await store.vapid(() => webpush.generateVAPIDKeys())
  // Sem e-mail de ninguém: o endereço do site basta como contato para os serviços de notificação.
  const subject = env.PUSH_SUBJECT || 'https://iasd-706sul.vercel.app'
  const vapid = { subject, publicKey: keys.publicKey, privateKey: keys.privateKey }

  async function sendWeb(subscription, payload) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), {
        TTL: 60 * 60 * 24,
        urgency: 'high',
        vapidDetails: vapid,
      })
      return { ok: true }
    } catch (error) {
      // 404/410: o aparelho cancelou a inscrição ou o navegador foi desinstalado
      return { ok: false, gone: error?.statusCode === 404 || error?.statusCode === 410 }
    }
  }

  async function sendFcm(token, payload) {
    if (emulator) return { ok: false }
    try {
      await getMessaging(app).send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: { url: payload.url, kind: payload.kind, id: payload.id },
        android: { priority: 'high', notification: { channelId: 'avisos', tag: payload.id } },
      })
      return { ok: true }
    } catch (error) {
      const code = String(error?.code ?? '')
      return { ok: false, gone: code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') }
    }
  }

  cached = { store, sendWeb, sendFcm, vapid }
  return cached
}

/** Só para os testes: esquece o que foi montado. */
export function resetContext() {
  cached = undefined
}
