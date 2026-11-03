import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionMatrixEditor } from './admin/PermissionMatrixEditor'
import { RouteErrorBoundary } from './ErrorBoundary'
import { buildMatrix } from '../models/permissions'
import type { PermissionMatrix } from '../models'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Bomba(): never {
  throw new Error('falha de teste')
}

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  vi.spyOn(console, 'error').mockImplementation(() => undefined) // o React avisa o erro capturado
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.restoreAllMocks()
})

describe('barreira de erro', () => {
  it('troca só a tela que falhou por um aviso (sem tela branca)', () => {
    act(() =>
      root.render(
        <MemoryRouter>
          <p>menu e cabeçalho</p>
          <RouteErrorBoundary>
            <Bomba />
          </RouteErrorBoundary>
        </MemoryRouter>,
      ),
    )
    expect(host.textContent).toContain('menu e cabeçalho')
    expect(host.textContent).toContain('Algo deu errado nesta tela')
    expect(host.textContent).toContain('falha de teste')
    expect(host.querySelector('[role=alert]')).not.toBeNull()
  })

  it('"Tentar de novo" desenha a tela outra vez', () => {
    let quebra = true
    const Instavel = () => (quebra ? <Bomba /> : <p>tela voltou</p>)
    act(() =>
      root.render(
        <MemoryRouter>
          <RouteErrorBoundary>
            <Instavel />
          </RouteErrorBoundary>
        </MemoryRouter>,
      ),
    )
    expect(host.textContent).toContain('Algo deu errado')
    quebra = false
    const botao = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Tentar de novo')!
    act(() => botao.click())
    expect(host.textContent).toContain('tela voltou')
  })
})

describe('editor de permissões com perfil antigo', () => {
  it('desenha todos os módulos, inclusive o que não existia quando o perfil foi gravado', () => {
    const antigo = buildMatrix({ eventos: ['view'] }) as Partial<PermissionMatrix>
    delete antigo.patrimonio
    const html = renderToString(<PermissionMatrixEditor value={antigo as PermissionMatrix} />)
    expect(html).toContain('Patrimônio')
    expect(html).toContain('Eventos')
    const editavel = renderToString(<PermissionMatrixEditor value={antigo as PermissionMatrix} onChange={() => undefined} />)
    expect(editavel).toContain('Visualizar — Patrimônio')
  })
})
