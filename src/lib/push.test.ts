import { describe, expect, it } from 'vitest'
import { deviceIdFor, deviceLabel, detectPlatform, getPushState, requestPush, schedulePush, urlBase64ToUint8Array } from './push'

describe('chave pública do Web Push', () => {
  it('converte base64 de URL em bytes', () => {
    expect([...urlBase64ToUint8Array('AQAB')]).toEqual([1, 0, 1])
    // "-" e "_" no lugar de "+" e "/", sem o "=" do final
    expect([...urlBase64ToUint8Array('-_-_')]).toEqual([251, 255, 191])
    expect([...urlBase64ToUint8Array('AQ')]).toEqual([1])
  })
})

describe('código do aparelho', () => {
  it('é o início do SHA-256 do endereço: sempre o mesmo e diferente para cada aparelho', async () => {
    expect(await deviceIdFor('a')).toBe('ca978112ca1bbdcafac231b39a23dc4da786eff8')
    expect(await deviceIdFor('a')).toBe(await deviceIdFor('a'))
    expect(await deviceIdFor('b')).not.toBe(await deviceIdFor('a'))
    expect(await deviceIdFor('https://fcm.googleapis.com/fcm/send/x')).toMatch(/^[0-9a-f]{40}$/)
  })
})

describe('plataforma', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-X110) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

  it('reconhece iPhone, iPad que se apresenta como Mac e deixa de fora Mac de verdade e Android', () => {
    expect(detectPlatform(IPHONE, 5, false).ios).toBe(true)
    expect(detectPlatform(MAC, 5, false).ios).toBe(true) // iPad com "site para computador"
    expect(detectPlatform(MAC, 0, false).ios).toBe(false)
    expect(detectPlatform(ANDROID, 5, false).ios).toBe(false)
    expect(detectPlatform(IPHONE, 5, true)).toEqual({ ios: true, standalone: true })
  })

  it('descreve o aparelho', () => {
    expect(deviceLabel(ANDROID, true)).toBe('Aplicativo Android')
    expect(deviceLabel(ANDROID, false)).toBe('Android (navegador)')
    expect(deviceLabel(IPHONE, false)).toBe('iPhone/iPad (app instalado)')
    expect(deviceLabel(MAC, false)).toBe('Computador (navegador)')
  })
})

describe('sem a nuvem (modo local e testes)', () => {
  it('não há notificações no aparelho e nenhuma chamada é feita', async () => {
    expect(await getPushState('u1')).toMatchObject({ kind: 'unsupported' })
    await expect(requestPush()).resolves.toBeUndefined()
    expect(() => schedulePush()).not.toThrow()
  })
})
