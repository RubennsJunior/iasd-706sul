/*
 * Roda a função /api/push (a mesma da Vercel) numa porta local, para testar as notificações no desenvolvimento.
 * O `vite` e o `vite preview` já encaminham /api para cá (vite.config.ts).
 *
 * Uso: node scripts/dev-api.mjs        (npm run dev:api)   — porta 3000 (PORT)
 *
 * Contra o emulador do Firestore (testes):  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-igreja
 * Contra o projeto real: FIREBASE_SERVICE_ACCOUNT='<json da conta de serviço>' (veja o README).
 */
import { createServer } from 'node:http'
import handler from '../api/push.js'

const port = Number(process.env.PORT || 3000)

createServer((req, res) => {
  // a Vercel entrega `res.status()` e `res.json()`; aqui são recriados
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
  }
  handler(req, res).catch((error) => {
    console.error(error)
    res.status(500).json({ error: 'falha' })
  })
}).listen(port, '127.0.0.1', () => console.log(`/api/push em http://127.0.0.1:${port}/api/push`))
