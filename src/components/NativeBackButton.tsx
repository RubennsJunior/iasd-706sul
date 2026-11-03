import { useEffect } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/** Telas de partida: voltar nelas sai do app, em vez de ficar alternando com a tela anterior. */
const ROOTS = new Set(['/', '/login'])

/**
 * Botão Voltar do Android (só no APK). Sem isto o Capacitor fecha o app em qualquer tela.
 * Ordem: fecha a janela aberta → volta na navegação → sai do app na tela inicial.
 */
export function NativeBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const subscription = CapacitorApp.addListener('backButton', () => {
      if (document.querySelector('[role=dialog], [data-select-popup]')) {
        // janelas (Modal) e listas suspensas (Select) já fecham com Escape
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        return
      }
      // o React Router guarda a posição atual em history.state.idx
      const canGoBack = (window.history.state?.idx ?? 0) > 0 && !ROOTS.has(window.location.pathname)
      if (canGoBack) window.history.back()
      else void CapacitorApp.exitApp()
    })
    return () => {
      void subscription.then((handle) => handle.remove())
    }
  }, [])

  return null
}
