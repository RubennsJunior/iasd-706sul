/** Nome exibido no sistema. Provisório: para voltar ao nome completo, altere somente aqui (e no manifest/index.html). */
export const CHURCH_NAME = 'IASD 706 Sul'

export const APP_NAME = CHURCH_NAME
export const APP_VERSION = '1.0.0'
export const APP_BUILD = 'Etapa 2 — dados na nuvem (Firebase)'

/** Senha dos usuários de demonstração; existe só para testes. */
export const DEMO_PASSWORD = '123456'

/**
 * Contas de demonstração (lista na tela de login e "Testar outro perfil"). Ficam ligadas por padrão para
 * a fase de avaliação; antes de cadastrar dados reais publique com `VITE_DEMO_MODE=false`.
 */
export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE !== 'false'
