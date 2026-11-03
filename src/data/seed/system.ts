import { CHURCH_NAME } from '../../config'
import type {
  ActivityLog,
  AppNotification,
  AppSettings,
  ChurchProfile,
  ContactInfo,
} from '../../models'

export function seedNotifications(): AppNotification[] {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  const row = (
    n: number,
    kind: AppNotification['kind'],
    title: string,
    body: string,
    hours: number,
    readBy: string[],
  ): AppNotification => ({
    id: `notif-${String(n).padStart(2, '0')}`,
    kind,
    title,
    body,
    readBy,
    createdAt: hoursAgo(hours),
    updatedAt: hoursAgo(hours),
  })
  return [
    row(1, 'escala', 'Confirme sua escala', 'Você foi escalada para a Escola Sabatina. Confirme sua presença.', 2, []),
    row(2, 'evento', 'Encontro de Crianças cancelado', 'A diretoria cancelou o Encontro de Crianças. Veja os detalhes do evento.', 5, []),
    row(3, 'aviso', 'Lembrete: Culto de Louvor', 'O Culto de Louvor acontece no próximo sábado, às 19h, no Templo Central.', 20, ['user-01']),
    row(4, 'oracao', 'Novo pedido de oração', 'Há um novo pedido de oração aguardando intercessão.', 30, ['user-01']),
    row(5, 'aviso', 'Mensagem da Semana publicada', 'O Pr. Marcos publicou a mensagem “A Esperança em Cristo”.', 48, ['user-01', 'user-02']),
    row(6, 'sistema', 'Bem-vindo ao sistema', 'Você está usando a versão de demonstração, com dados fictícios salvos neste dispositivo.', 72, ['user-01']),
  ]
}

export function seedContacts(): ContactInfo[] {
  return [
    { id: 'ct-01', kind: 'telefone', label: 'Secretaria', value: '(11) 3000-0000', hours: 'Seg a sex, 9h às 17h' },
    { id: 'ct-02', kind: 'whatsapp', label: 'WhatsApp da Igreja', value: '(11) 99000-0000', hours: 'Todos os dias, 8h às 20h' },
    { id: 'ct-03', kind: 'email', label: 'E-mail da Secretaria', value: 'secretaria@igreja.demo', hours: '' },
    { id: 'ct-04', kind: 'endereco', label: 'Templo Central', value: 'Rua das Palmeiras, 100 - Centro', hours: 'Cultos aos sábados' },
    { id: 'ct-05', kind: 'rede-social', label: 'Instagram', value: '@igreja.demo', hours: '' },
  ]
}

export function seedChurch(): ChurchProfile[] {
  return [
    {
      id: 'church',
      name: CHURCH_NAME,
      district: 'Distrito Central',
      pastor: 'Pr. Marcos Antônio Lima',
      cnpj: '00.000.000/0001-00',
      foundedAt: '1998-05-09',
      address: 'Rua das Palmeiras, 100 - Centro',
      city: 'Cidade Exemplo',
      state: 'SP',
      motto: 'Preparando um povo para a volta de Jesus',
    },
  ]
}

export function seedSettings(): AppSettings[] {
  return [
    {
      id: 'settings',
      notifyEvents: true,
      notifyRosters: true,
      notifyPrayers: true,
      notifyNotices: true,
      showSplash: true,
    },
  ]
}

export function seedActivity(): ActivityLog[] {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  const row = (n: number, message: string, kind: string, actor: string, hours: number): ActivityLog => ({
    id: `act-${String(n).padStart(2, '0')}`,
    message,
    kind,
    actor,
    createdAt: hoursAgo(hours),
    updatedAt: hoursAgo(hours),
  })
  return [
    row(1, 'Escala de Recepção atualizada', 'escala', 'Ana Souza', 1),
    row(2, 'Evento “Encontro de Crianças” cancelado', 'evento', 'Fernanda Rocha', 5),
    row(3, 'Novo membro cadastrado: José Ricardo Nunes', 'membro', 'Fernanda Rocha', 26),
    row(4, 'Mensagem da semana publicada', 'liturgia', 'Pr. Marcos Lima', 48),
    row(5, 'Equipe “Mídia e Transmissão” ganhou um integrante', 'equipe', 'Paulo Mendes', 70),
  ]
}
