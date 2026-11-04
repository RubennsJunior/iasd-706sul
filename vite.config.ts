import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/** Gera dist/sw.js com a lista de arquivos do build para o app abrir offline. */
function precacheServiceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'precache-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    writeBundle(_, bundle) {
      const files = Object.keys(bundle).filter((file) => !file.endsWith('.map') && !file.endsWith('.woff'))
      const extras = [
        '/manifest.webmanifest',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/icon-maskable-512.png',
        '/icons/apple-touch-icon.png',
        '/icons/badge-96.png',
      ]
      const urls = ['/', ...files.map((file) => `/${file}`), ...extras]
      const version = createHash('sha1').update(urls.join('|')).digest('hex').slice(0, 10)
      const template = readFileSync(join(process.cwd(), 'pwa', 'sw.template.js'), 'utf8')
      const source = template
        .replace('__CACHE__', `igreja-sda-${version}`)
        .replace('__PRECACHE__', JSON.stringify(urls))
      writeFileSync(join(process.cwd(), outDir, 'sw.js'), source)
    },
  }
}

// https://vite.dev/config/
// Em desenvolvimento a função /api/push roda localmente (npm run dev:api); na Vercel ela é a função de api/push.js.
const localApi = { '/api': { target: process.env.PUSH_DEV_API || 'http://127.0.0.1:3000', changeOrigin: true } }

export default defineConfig({
  plugins: [react(), tailwindcss(), precacheServiceWorker()],
  server: { proxy: localApi },
  preview: { proxy: localApi },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.js'],
  },
})
