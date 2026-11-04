/**
 * Transforma um erro do servidor numa categoria que ajuda quem configura a Vercel/Firebase, sem vazar segredos:
 * só o nome da categoria e o começo da mensagem do próprio Google (que nunca traz a chave).
 */
export function diagnose(error) {
  const code = String(error?.code ?? '')
  const text = String(error?.message ?? error ?? '')
  let motivo = 'desconhecido'
  if (/SERVICE_DISABLED|has not been used in project|API has not been enabled|is disabled/i.test(text)) motivo = 'api-do-firebase-desativada'
  else if (/service account|private[ _]key|client_email|credential|Unexpected token|JSON/i.test(text) && !/PERMISSION_DENIED/.test(text)) motivo = 'conta-de-servico-invalida'
  else if (code === '7' || /PERMISSION_DENIED|insufficient permission/i.test(text)) motivo = 'firestore-sem-permissao'
  else if (code === '5' || /NOT_FOUND/.test(text)) motivo = 'firestore-nao-encontrado'
  else if (code === '14' || /UNAVAILABLE|ETIMEDOUT|ENOTFOUND|ECONNRESET|EAI_AGAIN/i.test(text)) motivo = 'rede'
  return { motivo, detalhe: text.replace(/\s+/g, ' ').trim().slice(0, 140) }
}
