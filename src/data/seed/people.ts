import type { AppUser, Department, DirectoryEntry, Member, Position, Role } from '../../models'
import { DEMO_PASSWORD } from '../../config'
import { buildMatrix, fullMatrix } from '../../models/permissions'

/** Todos os dados deste arquivo são fictícios. */

const pad = (n: number) => String(n).padStart(2, '0')
export const memberId = (n: number) => `mem-${pad(n)}`

type MemberSeed = [name: string, birth: string, baptism: string, status: Member['status']]

const MEMBER_ROWS: MemberSeed[] = [
  ['Ana Paula Ferreira', '1990-03-14', '2005-07-09', 'ativo'],
  ['Carlos Silva', '1984-08-02', '2001-11-17', 'ativo'],
  ['Ana Souza', '1979-12-21', '1998-05-23', 'ativo'],
  ['Paulo Mendes', '1992-05-30', '2010-09-04', 'ativo'],
  ['Maria Oliveira', '1965-01-18', '1985-03-30', 'ativo'],
  ['Juliana Costa', '1988-10-07', '2006-12-02', 'ativo'],
  ['Roberto Alves', '1971-06-25', '1990-08-18', 'ativo'],
  ['Marcos Antônio Lima', '1975-09-11', '1994-04-16', 'ativo'],
  ['Fernanda Rocha', '1986-02-03', '2003-10-11', 'ativo'],
  ['Lucas Pereira', '1999-07-19', '2015-06-20', 'ativo'],
  ['Beatriz Santos', '2001-04-12', '2017-02-25', 'ativo'],
  ['Gabriel Martins', '1997-11-28', '2013-09-14', 'ativo'],
  ['Camila Duarte', '1994-09-05', '2012-01-21', 'ativo'],
  ['Rafael Nogueira', '1989-03-27', '2008-05-31', 'ativo'],
  ['Larissa Barbosa', '2003-12-09', '2019-10-05', 'ativo'],
  ['Thiago Carvalho', '1995-06-16', '2014-07-12', 'ativo'],
  ['Patrícia Gomes', '1982-01-30', '2000-09-23', 'ativo'],
  ['Eduardo Ribeiro', '1978-04-04', '1997-12-06', 'ativo'],
  ['Sandra Moreira', '1969-08-22', '1988-06-18', 'ativo'],
  ['Daniel Teixeira', '1993-10-13', '2011-03-26', 'ativo'],
  ['Helena Araújo', '1991-05-08', '2009-11-14', 'ativo'],
  ['Bruno Cardoso', '1987-02-17', '2007-04-07', 'ativo'],
  ['Isabela Freitas', '2005-09-24', '2021-08-28', 'ativo'],
  ['Vinícius Lopes', '2000-01-06', '2016-05-14', 'ativo'],
  ['Letícia Monteiro', '1996-07-31', '2013-12-07', 'ativo'],
  ['José Ricardo Nunes', '1983-11-15', '', 'visitante'],
  ['Marta Batista', '1960-03-09', '1980-10-25', 'afastado'],
  ['Antônio Carlos Dias', '1955-12-01', '1975-02-15', 'inativo'],
]

export function seedMembers(): Member[] {
  return MEMBER_ROWS.map(([fullName, birthDate, baptismDate, status], index) => {
    const n = index + 1
    return {
      id: memberId(n),
      fullName,
      birthDate,
      phone: `(11) 99${pad(n)}0-${pad(n * 3 + 10)}${pad(n + 20)}`,
      email: `${fullName
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .split(' ')
        .filter((part) => part.length > 2)
        .slice(0, 2)
        .join('.')}@exemplo.com.br`,
      address: `Rua das Palmeiras, ${100 + n * 12} - Centro`,
      baptismDate,
      status,
      notes:
        status === 'visitante'
          ? 'Visitante frequente, interessado em estudos bíblicos.'
          : status === 'afastado'
            ? 'Em acompanhamento pela diaconia.'
            : '',
    }
  })
}

export const seedDirectory = (): DirectoryEntry[] => seedMembers().map((m) => ({ id: m.id, fullName: m.fullName }))

export function seedRoles(): Role[] {
  return [
    {
      id: 'role-admin',
      name: 'Administrador Geral',
      description: 'Acesso total a todos os módulos do sistema.',
      permissions: fullMatrix(),
      system: true,
    },
    {
      id: 'role-pastor',
      name: 'Pastor',
      description: 'Acompanha toda a igreja e aprova programações.',
      permissions: buildMatrix({
        eventos: ['view', 'create', 'edit', 'delete'],
        equipes: ['view', 'create', 'edit'],
        liturgia: ['view', 'create', 'edit', 'delete', 'manage'],
        membros: ['view', 'create', 'edit'],
        usuarios: ['view'],
        lideres: ['view', 'create', 'edit', 'delete'],
        cargos: ['view', 'create', 'edit'],
        departamentos: ['view', 'create', 'edit'],
        escalas: ['view', 'create', 'edit', 'delete', 'manage'],
        cultos: ['view', 'create', 'edit', 'delete', 'manage'],
        participantes: ['view', 'create', 'edit', 'delete'],
        perfis: ['view'],
        permissoes: ['view'],
        notificacoes: ['view', 'create', 'edit', 'delete'],
        relatorios: ['view', 'manage'],
        configuracoes: ['view'],
      }),
    },
    {
      id: 'role-secretaria',
      name: 'Secretaria',
      description: 'Mantém cadastros, escalas e documentos da igreja.',
      permissions: buildMatrix({
        eventos: ['view', 'create', 'edit', 'delete'],
        equipes: ['view', 'create', 'edit'],
        liturgia: ['view'],
        membros: ['view', 'create', 'edit', 'delete', 'manage'],
        usuarios: ['view', 'create', 'edit'],
        lideres: ['view', 'create', 'edit', 'delete'],
        cargos: ['view', 'create', 'edit', 'delete'],
        departamentos: ['view', 'create', 'edit', 'delete'],
        escalas: ['view', 'create', 'edit', 'delete'],
        cultos: ['view', 'create', 'edit', 'delete'],
        participantes: ['view', 'create', 'edit', 'delete'],
        notificacoes: ['view', 'create', 'edit', 'delete'],
        relatorios: ['view'],
        configuracoes: ['view'],
      }),
    },
    {
      id: 'role-lider-depto',
      name: 'Líder de Departamento',
      description: 'Coordena as equipes e eventos do seu departamento.',
      reach: 'departamento',
      reachPositionIds: [],
      permissions: buildMatrix({
        eventos: ['view', 'create', 'edit'],
        equipes: ['view', 'create', 'edit'],
        liturgia: ['view'],
        membros: ['view'],
        lideres: ['view'],
        cargos: ['view'],
        departamentos: ['view'],
        escalas: ['view', 'create', 'edit'],
        cultos: ['view'],
        participantes: ['view', 'create', 'edit'],
        notificacoes: ['view'],
        relatorios: ['view'],
      }),
    },
    {
      id: 'role-lider-equipe',
      name: 'Líder de Equipe',
      description: 'Monta as escalas e acompanha os integrantes da equipe.',
      reach: 'equipe',
      reachPositionIds: [],
      permissions: buildMatrix({
        eventos: ['view'],
        equipes: ['view', 'edit'],
        liturgia: ['view'],
        membros: ['view'],
        lideres: ['view'],
        departamentos: ['view'],
        escalas: ['view', 'create', 'edit'],
        cultos: ['view'],
        participantes: ['view'],
        notificacoes: ['view'],
      }),
    },
    {
      id: 'role-membro',
      name: 'Membro',
      description: 'Consulta agenda, equipes, liturgia e as próprias escalas.',
      permissions: buildMatrix({
        eventos: ['view'],
        equipes: ['view'],
        liturgia: ['view'],
        escalas: ['view'],
        notificacoes: ['view'],
      }),
    },
  ]
}

export function seedUsers(): AppUser[] {
  const members = seedMembers()
  const row = (
    id: string,
    name: string,
    email: string,
    roleId: string,
    member: number,
  ): AppUser => ({
    id,
    name,
    email,
    phone: members[member - 1].phone,
    password: DEMO_PASSWORD,
    roleId,
    status: 'ativo',
    memberId: memberId(member),
  })
  return [
    row('user-01', 'Ana Paula Ferreira', 'ana.paula@igreja.demo', 'role-admin', 1),
    row('user-02', 'Pr. Marcos Antônio Lima', 'pastor@igreja.demo', 'role-pastor', 8),
    row('user-03', 'Fernanda Rocha', 'secretaria@igreja.demo', 'role-secretaria', 9),
    row('user-04', 'Letícia Monteiro', 'lider.depto@igreja.demo', 'role-lider-depto', 25),
    row('user-05', 'Carlos Silva', 'lider.equipe@igreja.demo', 'role-lider-equipe', 2),
    row('user-06', 'Lucas Pereira', 'membro@igreja.demo', 'role-membro', 10),
  ]
}

export function seedPositions(): Position[] {
  return [
    ['pos-diretor', 'Diretor', 'Responsável geral pelo departamento.'],
    ['pos-vice', 'Vice-diretor', 'Substitui o diretor e apoia a coordenação.'],
    ['pos-secretario', 'Secretário', 'Cuida de atas, listas e comunicação interna.'],
    ['pos-tesoureiro', 'Tesoureiro', 'Acompanha as finanças do departamento.'],
    ['pos-coordenador', 'Coordenador', 'Coordena projetos e atividades específicas.'],
    ['pos-lider', 'Líder', 'Responsável direto por uma equipe.'],
    ['pos-auxiliar', 'Auxiliar', 'Apoia as atividades do líder.'],
  ].map(([id, name, description]) => ({ id, name, description }))
}

export function seedDepartments(): Department[] {
  return [
    ['dep-01', 'Música e Louvor', 'Coordena a música congregacional e os grupos de louvor.', 2],
    ['dep-02', 'Comunicação', 'Mídia, transmissão e divulgação das atividades da igreja.', 4],
    ['dep-03', 'Ministério Pessoal', 'Oração, visitação e estudos bíblicos.', 5],
    ['dep-04', 'Diaconia e Recepção', 'Acolhimento, ordem e cuidado com a estrutura.', 7],
    ['dep-05', 'Ministério da Criança', 'Classes e programações para os pequeninos.', 6],
    ['dep-06', 'Escola Sabatina', 'Classes de estudo da lição e programação do sábado.', 9],
    ['dep-07', 'Ministério Jovem', 'Atividades, projetos e comunhão da juventude.', 25],
    ['dep-08', 'Ministério da Família', 'Fortalecimento dos lares e relacionamentos.', 17],
  ].map(([id, name, description, leader]) => ({
    id: id as string,
    name: name as string,
    description: description as string,
    leaderId: memberId(leader as number),
    status: 'ativa' as const,
  }))
}
