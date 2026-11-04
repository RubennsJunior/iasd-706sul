/**
 * Função da Vercel: `/api/push`.
 *
 *   GET  -> { configured, publicKey }  chave pública do Web Push (o aparelho precisa dela para se inscrever)
 *   POST -> envia as notificações pendentes aos aparelhos cadastrados e responde com um resumo
 *
 * Qualquer pessoa pode chamar (o cadastro de um visitante também gera aviso à secretaria): a chamada só envia
 * notificações que já existem no banco — criadas pelas regras do Firestore — e cada uma é enviada uma única vez.
 *
 * Precisa da variável FIREBASE_SERVICE_ACCOUNT (veja o README). Sem ela responde { configured: false }.
 */
import { getContext } from './_lib/context.js'
import { flush } from './_lib/pushCore.js'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  try {
    const context = await getContext()
    if (!context) return res.status(200).json({ configured: false })
    if (req.method === 'GET') return res.status(200).json({ configured: true, publicKey: context.vapid.publicKey })
    if (req.method === 'POST') return res.status(200).json({ configured: true, ...(await flush(context)) })
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    console.error('push', error)
    return res.status(500).json({ configured: true, error: 'Não foi possível enviar as notificações agora.' })
  }
}
