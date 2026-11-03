import type { MemberRequest } from '../../models'
import { addDays, todayISO } from '../../utils/date'
import { memberId } from './people'

/** Pedidos de exemplo (nomes fictícios) para a tela de análise não começar vazia. */
export function seedRequests(): MemberRequest[] {
  const today = todayISO()
  const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
  return [
    {
      id: 'req-01',
      fullName: 'Mariana Lopes Azevedo',
      birthDate: '1998-04-22',
      phone: '(11) 98123-4501',
      email: 'mariana.azevedo@exemplo.com.br',
      address: 'Rua das Acácias, 45 - Jardim Primavera',
      baptized: true,
      baptismDate: '2016-09-10',
      teamIds: ['team-01', 'team-08'],
      message: 'Toco violão e canto. Gostaria de ajudar no louvor e participar dos jovens.',
      status: 'pendente',
      createdAt: at(1),
      updatedAt: at(1),
    },
    {
      id: 'req-02',
      fullName: 'Ricardo Menezes',
      birthDate: '1985-11-03',
      phone: '(11) 97765-2210',
      email: '',
      address: 'Av. Central, 800 - apto 32',
      baptized: false,
      baptismDate: '',
      teamIds: ['team-02'],
      message: 'Visito a igreja há alguns meses e quero servir na recepção.',
      status: 'pendente',
      createdAt: at(3),
      updatedAt: at(3),
    },
    {
      id: 'req-03',
      fullName: 'José Ricardo Nunes',
      birthDate: '1983-11-15',
      phone: '(11) 99260-3078',
      email: 'jose.nunes@exemplo.com.br',
      address: 'Rua das Palmeiras, 464 - Centro',
      baptized: false,
      baptismDate: '',
      teamIds: [],
      message: '',
      status: 'aprovada',
      reviewedBy: 'Fernanda Rocha',
      reviewedAt: addDays(today, -26),
      memberId: memberId(26),
      createdAt: at(28),
      updatedAt: at(26),
    },
  ]
}
