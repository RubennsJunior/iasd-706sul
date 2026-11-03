import type { LeaderAssignment, Team } from '../../models'
import { addDays, todayISO } from '../../utils/date'
import { memberId } from './people'

const ids = (...numbers: number[]) => numbers.map(memberId)

interface TeamSeed {
  id: string
  name: string
  description: string
  departmentId: string
  leader: number
  members: number[]
  icon: string
  ageDays: number
  status?: Team['status']
}

const TEAM_ROWS: TeamSeed[] = [
  {
    id: 'team-01',
    name: 'Ministério de Louvor',
    description: 'Adorando a Deus através da música',
    departmentId: 'dep-01',
    leader: 2,
    members: [1, 2, 10, 11, 12, 13, 14, 15, 16, 20, 24, 25],
    icon: 'music',
    ageDays: 1800,
  },
  {
    id: 'team-02',
    name: 'Recepção',
    description: 'Recebendo com amor',
    departmentId: 'dep-04',
    leader: 3,
    members: [3, 13, 14, 15, 17, 19, 21, 23],
    icon: 'handshake',
    ageDays: 1500,
  },
  {
    id: 'team-03',
    name: 'Mídia e Transmissão',
    description: 'Registrando e transmitindo',
    departmentId: 'dep-02',
    leader: 4,
    members: [4, 16, 18, 22, 12, 24],
    icon: 'video',
    ageDays: 900,
  },
  {
    id: 'team-04',
    name: 'Intercessão',
    description: 'Orando pela nossa igreja',
    departmentId: 'dep-03',
    leader: 5,
    members: [5, 1, 9, 17, 19, 21, 7, 18, 20, 3],
    icon: 'praying',
    ageDays: 2400,
  },
  {
    id: 'team-05',
    name: 'Ministério Infantil',
    description: 'Ensinando com amor',
    departmentId: 'dep-05',
    leader: 6,
    members: [6, 19, 21, 23, 13, 15, 17, 3, 9, 11, 20, 22, 14, 1],
    icon: 'baby',
    ageDays: 2000,
  },
  {
    id: 'team-06',
    name: 'Diaconia',
    description: 'Servindo com alegria',
    departmentId: 'dep-04',
    leader: 7,
    members: [7, 18, 22, 16, 20, 12, 10, 8, 24],
    icon: 'church',
    ageDays: 3000,
  },
  {
    id: 'team-07',
    name: 'Escola Sabatina',
    description: 'Estudando a Palavra em comunhão',
    departmentId: 'dep-06',
    leader: 9,
    members: [9, 1, 5, 7, 17, 19, 8],
    icon: 'book',
    ageDays: 3200,
  },
  {
    id: 'team-08',
    name: 'Ministério Jovem',
    description: 'Jovens vivendo e servindo',
    departmentId: 'dep-07',
    leader: 25,
    members: [25, 10, 11, 12, 15, 16, 23, 24, 13, 14, 20],
    icon: 'users',
    ageDays: 1200,
  },
  {
    id: 'team-09',
    name: 'Ministério da Família',
    description: 'Fortalecendo os lares',
    departmentId: 'dep-08',
    leader: 17,
    members: [17, 18, 2, 3, 5, 21],
    icon: 'heart',
    ageDays: 700,
    status: 'inativa',
  },
]

export function seedTeams(): Team[] {
  const today = todayISO()
  return TEAM_ROWS.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    departmentId: row.departmentId,
    leaderId: memberId(row.leader),
    memberIds: ids(...row.members),
    foundedAt: addDays(today, -row.ageDays),
    status: row.status ?? 'ativa',
    icon: row.icon,
  }))
}

export function seedLeaders(): LeaderAssignment[] {
  const today = todayISO()
  const rows: LeaderAssignment[] = TEAM_ROWS.map((team, index) => ({
    id: `lead-${String(index + 1).padStart(2, '0')}`,
    memberId: memberId(team.leader),
    positionId: 'pos-lider',
    scope: 'equipe',
    scopeId: team.id,
    since: addDays(today, -Math.round(team.ageDays / 2)),
  }))
  const departmentDirectors: Array<[string, number]> = [
    ['dep-01', 2],
    ['dep-02', 4],
    ['dep-03', 5],
    ['dep-04', 7],
    ['dep-05', 6],
    ['dep-06', 9],
    ['dep-07', 25],
    ['dep-08', 17],
  ]
  departmentDirectors.forEach(([scopeId, member], index) => {
    rows.push({
      id: `lead-${String(rows.length + 1).padStart(2, '0')}`,
      memberId: memberId(member),
      positionId: 'pos-diretor',
      scope: 'departamento',
      scopeId,
      since: addDays(today, -400 - index * 30),
    })
  })
  const support: Array<[number, string, string, string]> = [
    [10, 'pos-auxiliar', 'equipe', 'team-01'],
    [13, 'pos-auxiliar', 'equipe', 'team-02'],
    [16, 'pos-secretario', 'equipe', 'team-03'],
    [19, 'pos-vice', 'departamento', 'dep-05'],
    [1, 'pos-secretario', 'departamento', 'dep-06'],
  ]
  support.forEach(([member, positionId, scope, scopeId]) => {
    rows.push({
      id: `lead-${String(rows.length + 1).padStart(2, '0')}`,
      memberId: memberId(member),
      positionId,
      scope: scope as LeaderAssignment['scope'],
      scopeId,
      since: addDays(today, -200),
    })
  })
  return rows
}
