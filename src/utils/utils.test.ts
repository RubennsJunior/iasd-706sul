import { describe, expect, it } from 'vitest'
import { updatePermission } from '../components/admin/PermissionMatrixEditor'
import { buildMatrix } from '../models/permissions'
import { readingFor } from '../services'
import {
  addDays,
  ageFrom,
  diffInDays,
  formatDate,
  formatDateShort,
  formatTime,
  nextWeekday,
  timeAgo,
  weekRange,
} from './date'
import { initials, isValidEmail, matchesQuery, pluralize, toCSV } from './misc'

describe('datas', () => {
  it('formata datas e horários em português', () => {
    expect(formatDate('2026-11-08')).toBe('08/11/2026')
    expect(formatDateShort('2026-11-08')).toBe('Dom, 08 de Nov')
    expect(formatTime('19:00')).toBe('19h')
    expect(formatTime('19:30')).toBe('19h30')
    expect(formatDate('')).toBe('—')
  })

  it('calcula dias, semanas e próximos dias da semana', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(diffInDays('2026-11-10', '2026-11-03')).toBe(7)
    expect(nextWeekday(6, '2026-11-03')).toBe('2026-11-07')
    expect(nextWeekday(6, '2026-11-07')).toBe('2026-11-07')
    expect(weekRange('2026-11-03')).toEqual({ start: '2026-11-01', end: '2026-11-07' })
  })

  it('calcula a idade respeitando o aniversário', () => {
    expect(ageFrom('1990-03-14', '2026-03-13')).toBe(35)
    expect(ageFrom('1990-03-14', '2026-03-14')).toBe(36)
    expect(ageFrom('', '2026-03-14')).toBeNull()
  })

  it('descreve há quanto tempo algo aconteceu', () => {
    const now = new Date('2026-11-03T12:00:00Z')
    expect(timeAgo('2026-11-03T11:59:40Z', now)).toBe('agora')
    expect(timeAgo('2026-11-03T11:30:00Z', now)).toBe('há 30 min')
    expect(timeAgo('2026-11-03T07:00:00Z', now)).toBe('há 5 h')
    expect(timeAgo('2026-11-01T12:00:00Z', now)).toBe('há 2 dias')
  })
})

describe('texto', () => {
  it('ignora acentos e maiúsculas na busca', () => {
    expect(matchesQuery('maria', 'Maria Oliveira')).toBe(true)
    expect(matchesQuery('JOAO', 'João da Silva')).toBe(true)
    expect(matchesQuery('', 'qualquer')).toBe(true)
    expect(matchesQuery('xyz', 'Maria', undefined)).toBe(false)
  })

  it('gera iniciais, plurais, e-mails válidos e CSV com aspas escapadas', () => {
    expect(initials('Ana Paula Ferreira')).toBe('AF')
    expect(initials('Carlos')).toBe('CA')
    expect(pluralize(1, 'equipe')).toBe('1 equipe')
    expect(pluralize(3, 'equipe')).toBe('3 equipes')
    expect(isValidEmail('a@b.com')).toBe(true)
    expect(isValidEmail('sem-arroba')).toBe(false)
    expect(toCSV(['Nome', 'Obs'], [['Ana', 'disse "oi"']])).toBe('"Nome";"Obs"\r\n"Ana";"disse ""oi"""')
  })
})

describe('matriz de permissões', () => {
  it('"Gerenciar" libera tudo e qualquer ação libera "Visualizar"', () => {
    const base = buildMatrix({})
    const managed = updatePermission(base, 'eventos', 'manage', true)
    expect(Object.values(managed.eventos).every(Boolean)).toBe(true)

    const edit = updatePermission(base, 'equipes', 'edit', true)
    expect(edit.equipes.view).toBe(true)
    expect(edit.equipes.edit).toBe(true)
    expect(edit.equipes.delete).toBe(false)
  })

  it('remover "Visualizar" remove todas as ações e desmarcar uma ação tira o "Gerenciar"', () => {
    const full = updatePermission(buildMatrix({}), 'membros', 'manage', true)
    const noEdit = updatePermission(full, 'membros', 'edit', false)
    expect(noEdit.membros.manage).toBe(false)
    expect(noEdit.membros.view).toBe(true)
    const noView = updatePermission(full, 'membros', 'view', false)
    expect(Object.values(noView.membros).some(Boolean)).toBe(false)
  })
})

describe('leitura do dia', () => {
  const readings = [
    { id: '1', date: '2026-11-01', reference: 'A', text: '', theme: '' },
    { id: '2', date: '2026-11-05', reference: 'B', text: '', theme: '' },
  ]
  it('usa a leitura da data, a próxima ou a mais recente', () => {
    expect(readingFor(readings, '2026-11-01')?.reference).toBe('A')
    expect(readingFor(readings, '2026-11-03')?.reference).toBe('B')
    expect(readingFor(readings, '2026-12-01')?.reference).toBe('B')
    expect(readingFor([], '2026-11-01')).toBeUndefined()
  })
})
