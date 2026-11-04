// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { diagnose } from './diagnose.js'

describe('diagnóstico de falha do servidor de notificações', () => {
  it('reconhece cada categoria', () => {
    expect(diagnose(new Error('Failed to parse private key: Error: Invalid PEM formatted message.')).motivo).toBe('conta-de-servico-invalida')
    expect(diagnose(new SyntaxError('Unexpected token } in JSON at position 5')).motivo).toBe('conta-de-servico-invalida')
    expect(diagnose(new Error('Service account object must contain a string "client_email" property.')).motivo).toBe('conta-de-servico-invalida')
    expect(diagnose(Object.assign(new Error('7 PERMISSION_DENIED: Missing or insufficient permissions.'), { code: 7 })).motivo).toBe('firestore-sem-permissao')
    expect(diagnose(Object.assign(new Error('5 NOT_FOUND: '), { code: 5 })).motivo).toBe('firestore-nao-encontrado')
    expect(diagnose(Object.assign(new Error('14 UNAVAILABLE: No connection established'), { code: 14 })).motivo).toBe('rede')
    expect(diagnose(new Error('connect ETIMEDOUT 142.250.0.1:443')).motivo).toBe('rede')
    expect(diagnose(new Error('Cloud Firestore API has not been used in project 123 before or it is disabled.')).motivo).toBe('api-do-firebase-desativada')
    expect(diagnose(new Error('algo inesperado')).motivo).toBe('desconhecido')
  })

  it('permissão negada não é confundida com conta inválida e a mensagem é curta e numa linha só', () => {
    const result = diagnose(Object.assign(new Error('7 PERMISSION_DENIED: Missing or insufficient permissions. ' + 'x'.repeat(500) + '\n  at credential'), { code: 7 }))
    expect(result.motivo).toBe('firestore-sem-permissao')
    expect(result.detalhe.length).toBeLessThanOrEqual(140)
    expect(result.detalhe).not.toMatch(/\n/)
  })

  it('aceita qualquer coisa que seja lançada', () => {
    expect(diagnose(undefined).motivo).toBe('desconhecido')
    expect(diagnose('texto solto').detalhe).toBe('texto solto')
  })
})
