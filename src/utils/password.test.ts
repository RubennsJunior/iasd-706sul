import { describe, expect, it } from 'vitest'
import { hashPassword, isHashed, verifyPassword } from './password'

describe('senhas', () => {
  it('guarda só o resumo e confere a senha certa', async () => {
    const hash = await hashPassword('minha-senha')
    expect(isHashed(hash)).toBe(true)
    expect(hash).not.toContain('minha-senha')
    expect(await verifyPassword('minha-senha', hash)).toBe(true)
    expect(await verifyPassword('outra-senha', hash)).toBe(false)
  })

  it('cada resumo usa um sal diferente', async () => {
    expect(await hashPassword('igual')).not.toBe(await hashPassword('igual'))
  })

  it('aceita registros antigos em texto simples', async () => {
    expect(await verifyPassword('123456', '123456')).toBe(true)
    expect(await verifyPassword('abc', '123456')).toBe(false)
  })

  it('resumo malformado nunca confere', async () => {
    expect(await verifyPassword('x', 'pbkdf2$100000')).toBe(false)
  })
})
