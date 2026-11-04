/* Service worker do PWA. O nome do cache e a lista de arquivos abaixo são preenchidos no build (plugin em vite.config.ts). */
const CACHE = '__CACHE__'
const PRECACHE = __PRECACHE__
// Alguns servidores respondem com "Vary: Origin"; sem isso o cache não casaria com requisições de módulos.
const MATCH = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // A API (notificações) nunca vem do cache: a resposta muda quando o servidor é configurado.
  if (url.pathname.startsWith('/api/')) return

  // Navegação: tenta a rede (versão mais nova) e cai para o app em cache quando offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html', MATCH).then((cached) => cached || caches.match('/', MATCH))),
    )
    return
  }

  // Recursos estáticos: cache primeiro; o que não estiver no cache é guardado ao ser baixado.
  event.respondWith(
    caches.match(request, MATCH).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})

/*
 * Notificações no aparelho (Web Push): Android/computador pelo navegador e iPhone pelo app instalado na tela de início.
 * O servidor (api/push.js) envia { id, title, body, url, kind }. O iPhone exige que TODO push mostre uma notificação,
 * então aqui sempre mostramos — a mesma notificação (mesmo `tag`) nunca aparece duas vezes.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'IASD'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.id || 'iasd',
      lang: 'pt-BR',
      data: { url: data.url || '/notificacoes' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/notificacoes', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (open) {
        // app já aberto: o app navega sozinho (ver PushBridge) e a janela vem para a frente
        open.postMessage({ type: 'push-open', url })
        return open.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
