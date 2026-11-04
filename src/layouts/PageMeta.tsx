import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { APP_NAME } from '../config'

export interface PageMetaValue {
  title: string
  subtitle?: string
  icon?: LucideIcon
  /** Rota para onde o botão "voltar" leva (telas de detalhe). */
  back?: string
  variant?: 'default' | 'home'
}

interface PageMetaContextValue {
  meta: PageMetaValue
  setMeta(meta: PageMetaValue): void
}

const PageMetaContext = createContext<PageMetaContextValue | null>(null)

export function PageMetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<PageMetaValue>({ title: '' })
  const value = useMemo(() => ({ meta, setMeta }), [meta])
  return <PageMetaContext.Provider value={value}>{children}</PageMetaContext.Provider>
}

export function usePageMeta(): PageMetaValue {
  return useContext(PageMetaContext)?.meta ?? { title: '' }
}

/** Cada tela se envolve em <Page> para informar o título exibido no cabeçalho. */
export function Page({ title, subtitle, icon, back, variant, children }: PageMetaValue & { children: ReactNode }) {
  const ctx = useContext(PageMetaContext)
  const setMeta = ctx?.setMeta
  useLayoutEffect(() => {
    setMeta?.({ title, subtitle, icon, back, variant })
    document.title = title ? `${title} • ${APP_NAME}` : APP_NAME
  }, [setMeta, title, subtitle, icon, back, variant])
  return <>{children}</>
}
