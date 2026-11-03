/**
 * Senhas guardadas na nuvem não ficam em texto aberto: gravamos um resumo PBKDF2-SHA256 com sal próprio.
 * Registros antigos (e o modo só-local) ainda aceitam texto simples, para não trancar ninguém para fora.
 */
const PREFIX = 'pbkdf2$'
const ITERATIONS = 100_000

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16))

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Este navegador não consegue proteger a senha. Abra o sistema por um endereço seguro (https).')
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

export const isHashed = (stored: string) => stored.startsWith(PREFIX)

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `${PREFIX}${ITERATIONS}$${toHex(salt)}$${toHex(await derive(plain, salt, ITERATIONS))}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!isHashed(stored)) return plain === stored
  const [, iterations, salt, hash] = stored.split('$')
  if (!iterations || !salt || !hash) return false
  const actual = toHex(await derive(plain, fromHex(salt) as Uint8Array<ArrayBuffer>, Number(iterations)))
  // comparação sem parar no primeiro caractere diferente
  let diff = actual.length ^ hash.length
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ (hash.charCodeAt(i) || 0)
  return diff === 0
}
