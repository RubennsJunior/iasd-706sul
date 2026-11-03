import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from './ui/Button'
import { EmptyState } from './ui/Misc'

interface Props {
  children: ReactNode
  /** Quando muda (ex.: a rota), o erro é esquecido e a tela tenta de novo. */
  resetKey?: string
}

interface State {
  error: Error | null
}

/**
 * Barreira de erro: se uma tela falha ao desenhar, só ela é substituída por este aviso. Sem isto o React derruba
 * o aplicativo inteiro e fica uma tela branca (menu, cabeçalho e navegação somem junto).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  private lastKey = this.props.resetKey

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Falha ao desenhar a tela:', error, info.componentStack)
  }

  componentDidUpdate() {
    if (this.props.resetKey !== this.lastKey) {
      this.lastKey = this.props.resetKey
      if (this.state.error) this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto max-w-xl py-6">
        <EmptyState
          icon={AlertTriangle}
          title="Algo deu errado nesta tela"
          description={`O restante do aplicativo continua funcionando. Tente de novo ou volte ao início. (${this.state.error.message})`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => this.setState({ error: null })}>
                Tentar de novo
              </Button>
              <Link to="/">
                <Button>Voltar ao início</Button>
              </Link>
            </div>
          }
        />
      </div>
    )
  }
}

/** Barreira que se renova a cada troca de rota. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}
