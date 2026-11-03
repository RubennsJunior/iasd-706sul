export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function uid(prefix = 'id'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${random}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function matchesQuery(query: string, ...fields: Array<string | undefined>): boolean {
  const q = normalize(query.trim())
  if (!q) return true
  return fields.some((field) => field && normalize(field).includes(q))
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

export function groupBy<T, K extends string>(items: T[], keyOf: (item: T) => K): Record<K, T[]> {
  const result = {} as Record<K, T[]>
  for (const item of items) (result[keyOf(item)] ??= []).push(item)
  return result
}

export function toCSV(headers: string[], rows: Array<Array<string | number>>): string {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
  return [headers, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  // BOM para o Excel reconhecer UTF-8
  const blob = new Blob(['﻿', content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
