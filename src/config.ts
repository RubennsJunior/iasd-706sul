import { cloudEnabled } from './lib/firebase'

/** Nome exibido no sistema. Provisório: para voltar ao nome completo, altere somente aqui (e no manifest/index.html). */
export const CHURCH_NAME = 'IASD 706 Sul'

/** Nome do aplicativo (ícone do celular, instalação do PWA, aba do navegador): só a sigla. */
export const APP_NAME = 'IASD'
export const APP_VERSION = '1.0.3'
export const APP_BUILD = 'Etapa 3 — nuvem com login (Firebase)'

/**
 * E-mail do primeiro administrador. A conta é criada no Firebase Authentication; ao entrar pela primeira vez
 * ela ganha o perfil de administrador. É só uma dica da interface: quem libera isso é `firestore.rules`
 * (o mesmo e-mail precisa estar lá).
 */
export const BOOTSTRAP_ADMIN_EMAIL: string = import.meta.env.VITE_ADMIN_EMAIL || 'admin@admin.com'

/** Senha dos usuários de demonstração; existe só para testes. */
export const DEMO_PASSWORD = '123456'

/**
 * Contas de demonstração (lista na tela de login e "Testar outro perfil"): só no modo local. Com a nuvem ligada o
 * acesso é pelo Firebase Authentication e essas contas não existem.
 */
export const DEMO_MODE: boolean = !cloudEnabled && import.meta.env.VITE_DEMO_MODE !== 'false'
