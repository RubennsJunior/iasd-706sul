import { useEffect, useState } from 'react'

/**
 * Detecta o teclado na tela em aparelhos de toque: com o teclado aberto a janela encolhe,
 * então comparamos com a maior altura vista na orientação atual.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return
    let width = window.innerWidth
    let baseline = window.innerHeight
    const update = () => {
      if (window.innerWidth !== width) {
        // girou a tela: a altura de referência recomeça
        width = window.innerWidth
        baseline = window.innerHeight
      }
      baseline = Math.max(baseline, window.innerHeight)
      setOpen(window.innerHeight < baseline - 150)
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return open
}
