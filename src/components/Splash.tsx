import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CHURCH_NAME } from '../config'
import { repos } from '../repositories'
import { LogoMark } from './ui/Logo'

const FLAG = 'igreja-sda:splash-seen'

function shouldShow(): boolean {
  try {
    if (window.sessionStorage.getItem(FLAG)) return false
  } catch {
    return false
  }
  return repos.settings.peek?.()?.[0]?.showSplash !== false
}

/** Tela de abertura exibida uma vez por sessão (PWA e APK). */
export function Splash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(shouldShow)

  useEffect(() => {
    if (!visible) return
    try {
      window.sessionStorage.setItem(FLAG, '1')
    } catch {
      // sem sessionStorage: a abertura aparece de novo na próxima visita
    }
    const timer = window.setTimeout(() => setVisible(false), 1400)
    return () => window.clearTimeout(timer)
  }, [visible])

  return (
    <>
      {children}
      {visible && (
        <div
          role="presentation"
          className="anim-fade fixed inset-0 z-[200] grid place-items-center bg-linear-to-br/srgb from-navy-950 via-navy-900 to-navy-800 text-white"
        >
          <div className="flex flex-col items-center gap-5 text-center">
            <LogoMark className="anim-splash size-24 text-white" />
            <p className="text-3xl font-semibold">{CHURCH_NAME}</p>
            <span className="mt-4 h-1 w-24 overflow-hidden rounded-full bg-white/20">
              <span className="block h-full w-full origin-left animate-pulse rounded-full bg-gold-500" />
            </span>
          </div>
        </div>
      )}
    </>
  )
}
