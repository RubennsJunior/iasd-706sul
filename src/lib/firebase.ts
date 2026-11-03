import { Capacitor } from '@capacitor/core'
import { getApp, getApps, initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

const env = import.meta.env

/**
 * Configuração do app web no Firebase. São identificadores públicos (vão no pacote do site de qualquer
 * jeito); quem protege os dados são as regras do Firestore (`firestore.rules`). Cada valor pode ser
 * trocado por uma variável `VITE_FIREBASE_*` (veja `.env.example`).
 */
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDuKg6o6v2U4GLMhTCd3ZNSypIURyNT6tQ',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'erp-igrejaadventista.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'erp-igrejaadventista',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'erp-igrejaadventista.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '836595225015',
  appId: env.VITE_FIREBASE_APP_ID || '1:836595225015:web:0f3086821d6fceb6699832',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-BCHHTX4KHW',
}

/** Os dados da igreja ficam em `igrejas/<tenant>/<coleção>/<id>`; outro valor isola um ambiente de testes. */
export const FIREBASE_TENANT: string = env.VITE_FIREBASE_TENANT || 'iasd-706-sul'

/**
 * Sincronização com a nuvem. Fica ligada por padrão; `VITE_DATA_BACKEND=local` mantém os dados só no
 * aparelho. Nos testes automatizados a nuvem nunca é usada.
 */
export const cloudEnabled: boolean = env.MODE !== 'test' && env.VITE_DATA_BACKEND !== 'local'

let app: FirebaseApp | undefined
let db: Firestore | undefined

export function getFirebaseApp(): FirebaseApp {
  app ??= getApps().length ? getApp() : initializeApp(firebaseConfig)
  return app
}

/** Firestore com cache em disco (o app abre e funciona sem internet) e sincronização entre abas. */
export function getDb(): Firestore {
  if (db) return db
  const instance = getFirebaseApp()
  try {
    db = initializeFirestore(instance, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      // campos vazios (undefined) são simplesmente omitidos
      ignoreUndefinedProperties: true,
      // alguns aparelhos e redes bloqueiam o canal contínuo; nesses casos usa requisições comuns
      experimentalAutoDetectLongPolling: true,
    })
  } catch {
    db = getFirestore(instance)
  }
  return db
}

/** Google Analytics: só no site publicado (não no desenvolvimento nem dentro do aplicativo Android). */
export async function initAnalytics() {
  if (!cloudEnabled || env.DEV || Capacitor.isNativePlatform()) return
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics')
    if (await isSupported()) getAnalytics(getFirebaseApp())
  } catch {
    // sem Analytics o app funciona normalmente
  }
}
