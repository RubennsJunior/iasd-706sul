// Testes das regras de segurança (firestore.rules) contra o emulador do Firestore.
// Rodar (com Java 21): npm run test:rules  — veja tests/rules/README.md
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'

const MODULES = ['eventos', 'equipes', 'liturgia', 'membros', 'usuarios', 'lideres', 'cargos', 'departamentos', 'escalas', 'cultos', 'participantes', 'perfis', 'permissoes', 'notificacoes', 'relatorios', 'configuracoes', 'patrimonio']
const ACTIONS = ['view', 'create', 'edit', 'delete', 'manage']
const matrix = (allowed = {}) =>
  Object.fromEntries(MODULES.map((m) => [m, Object.fromEntries(ACTIONS.map((a) => [a, (allowed[m] ?? []).includes(a)]))]))
const all = ['view', 'create', 'edit', 'delete', 'manage']

// Mesmas permissões dos perfis iniciais do sistema (src/data/seed/people.ts)
const ROLES = {
  'role-admin': matrix(Object.fromEntries(MODULES.map((m) => [m, all]))),
  'role-secretaria': matrix({
    eventos: ['view', 'create', 'edit', 'delete'], equipes: ['view', 'create', 'edit'], liturgia: ['view'],
    membros: ['view', 'create', 'edit', 'delete', 'manage'], usuarios: ['view', 'create', 'edit'],
    lideres: ['view', 'create', 'edit', 'delete'], cargos: ['view', 'create', 'edit', 'delete'],
    departamentos: ['view', 'create', 'edit', 'delete'], escalas: ['view', 'create', 'edit', 'delete'],
    cultos: ['view', 'create', 'edit', 'delete'], participantes: ['view', 'create', 'edit', 'delete'],
    notificacoes: ['view', 'create', 'edit', 'delete'], relatorios: ['view'], configuracoes: ['view'],
  }),
  'role-lider-equipe': matrix({
    eventos: ['view'], equipes: ['view', 'edit'], liturgia: ['view'], membros: ['view'], lideres: ['view'],
    departamentos: ['view'], escalas: ['view', 'create', 'edit'], cultos: ['view'], participantes: ['view'], notificacoes: ['view'],
  }),
  'role-membro': matrix({ eventos: ['view'], equipes: ['view'], liturgia: ['view'], escalas: ['view'], notificacoes: ['view'] }),
}

const T = 'igreja-teste'
const FRESH = 'igreja-nova'
const base = (tenant = T) => ['igrejas', tenant]
const user = (uid, roleId, extra = {}) => ({ name: uid, email: `${uid}@teste.com`, phone: '', roleId, status: 'ativo', ...extra })

let env
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-igreja',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const put = (path, data) => setDoc(doc(db, ...base(), ...path), data)
    await setDoc(doc(db, ...base()), { seededAt: 'x', version: '1' })
    for (const [id, permissions] of Object.entries(ROLES)) await put(['roles', id], { name: id, description: '', permissions, system: id === 'role-admin' })
    await put(['users', 'u-admin'], user('u-admin', 'role-admin'))
    await put(['users', 'u-sec'], user('u-sec', 'role-secretaria'))
    await put(['users', 'u-lider'], user('u-lider', 'role-lider-equipe'))
    await put(['users', 'u-membro'], user('u-membro', 'role-membro', { memberId: 'mem-10' }))
    await put(['users', 'u-custom'], user('u-custom', 'role-membro', { customPermissions: matrix({ eventos: ['view', 'create'] }) }))
    await put(['users', 'u-off'], user('u-off', 'role-secretaria', { status: 'inativo' }))
    // Patrimônio: usuário com permissão personalizada e usuário de um perfil gravado antes de existir o módulo
    await put(['users', 'u-pat'], user('u-pat', 'role-membro', { customPermissions: matrix({ patrimonio: ['view', 'create'] }) }))
    const semPatrimonio = matrix({ eventos: ['view'] })
    delete semPatrimonio.patrimonio
    await put(['roles', 'role-antigo'], { name: 'Antigo', description: '', permissions: semPatrimonio })
    await put(['users', 'u-antigo'], user('u-antigo', 'role-antigo'))
    await put(['assets', 'ast-1'], { name: 'Projetor', assetNumber: '001', category: 'equipamento', condition: 'bom' })
    await put(['members', 'mem-10'], { fullName: 'Lucas', phone: '(11) 90000-0000', email: 'l@x.com', status: 'ativo' })
    await put(['members', 'mem-01'], { fullName: 'Ana', phone: '(11) 91111-1111', email: 'a@x.com', status: 'ativo' })
    await put(['directory', 'mem-10'], { fullName: 'Lucas' })
    await put(['events', 'ev-1'], { title: 'Culto', participants: [], status: 'planejado' })
    await put(['rosters', 'r-1'], { title: 'Escala', date: '2026-11-07', assignments: [{ memberId: 'mem-10', role: 'x', status: 'pendente' }] })
    await put(['teams', 'team-1'], { name: 'Louvor', memberIds: ['mem-10'], status: 'ativa' })
    await put(['departments', 'dep-1'], { name: 'Música' })
    await put(['church', 'church-1'], { name: 'IASD' })
    await put(['settings', 'settings-1'], { showSplash: true })
    await put(['contacts', 'ct-1'], { label: 'x' })
    await put(['requests', 'req-1'], { fullName: 'Fulano de Tal', status: 'pendente' })
    await put(['requests', 'req-aprovada@x.com'], { id: 'req-aprovada@x.com', fullName: 'Ja Aprovada', email: 'aprovada@x.com', status: 'aprovada', memberId: 'mem-01' })
    await put(['requests', 'req-recusada@x.com'], { id: 'req-recusada@x.com', fullName: 'Ja Recusada', email: 'recusada@x.com', status: 'recusada', reason: 'x', reviewedBy: 'Fernanda' })
    await put(['notifications', 'n-1'], { title: 'Aviso', body: 'x', kind: 'aviso', readBy: [] })
    await put(['hymns', 'h-1'], { number: 1, title: 'Hino', favoriteBy: [] })
    await put(['prayers', 'p-1'], { title: 'Oração', prayedBy: [], status: 'aberto' })
    await put(['readings', 'rd-1'], { title: 'Leitura' })
    await put(['activity', 'a-1'], { message: 'x', kind: 'membro', actor: 'x' })
  })
})
after(() => env.cleanup())

const visitor = () => env.unauthenticatedContext().firestore()
const as = (uid, email = `${uid}@teste.com`) => env.authenticatedContext(uid, { email }).firestore()
const ref = (db, path, tenant = T) => doc(db, ...base(tenant), ...path)
const list = (db, name, tenant = T) => getDocs(collection(db, ...base(tenant), name))

describe('visitante (sem login)', () => {
  for (const [name, id] of [['events', 'ev-1'], ['rosters', 'r-1'], ['teams', 'team-1'], ['directory', 'mem-10'], ['church', 'church-1'], ['settings', 'settings-1']]) {
    it(`lê ${name}`, () => assertSucceeds(getDoc(ref(visitor(), [name, id]))))
  }
  it('lê o documento-marca da igreja', () => assertSucceeds(getDoc(doc(visitor(), ...base()))))
  for (const [name, id] of [['members', 'mem-10'], ['users', 'u-admin'], ['requests', 'req-1'], ['notifications', 'n-1'], ['roles', 'role-admin'], ['activity', 'a-1'], ['contacts', 'ct-1'], ['hymns', 'h-1'], ['prayers', 'p-1'], ['readings', 'rd-1'], ['departments', 'dep-1']]) {
    it(`NÃO lê ${name}`, () => assertFails(getDoc(ref(visitor(), [name, id]))))
  }
  it('NÃO lista membros nem usuários', async () => {
    await assertFails(list(visitor(), 'members'))
    await assertFails(list(visitor(), 'users'))
  })
  it('NÃO altera eventos, equipes, diretório nem membros', async () => {
    await assertFails(updateDoc(ref(visitor(), ['events', 'ev-1']), { title: 'hack' }))
    await assertFails(setDoc(ref(visitor(), ['teams', 'team-x']), { name: 'x' }))
    await assertFails(setDoc(ref(visitor(), ['directory', 'x']), { fullName: 'x' }))
    await assertFails(setDoc(ref(visitor(), ['members', 'x']), { fullName: 'x' }))
    await assertFails(deleteDoc(ref(visitor(), ['events', 'ev-1'])))
  })
  // Exatamente o que o aplicativo grava: o código do documento é "req-<e-mail>" e o documento leva o próprio id e as datas.
  const pedidoDe = (email, extra = {}) => ({ id: `req-${email}`, fullName: 'Maria Souza', birthDate: '', phone: '(11) 9', email, address: '', baptized: false, baptismDate: '', teamIds: ['team-1'], message: 'oi', status: 'pendente', createdAt: '2026-11-04T00:00:00.000Z', updatedAt: '2026-11-04T00:00:00.000Z', ...extra })
  const pedido = pedidoDe('maria@x.com')
  it('envia um pedido de cadastro pendente, do jeito que o aplicativo grava', () => assertSucceeds(setDoc(ref(visitor(), ['requests', pedido.id]), pedido)))
  it('NÃO envia pedido com id diferente do código do documento', () => assertFails(setDoc(ref(visitor(), ['requests', 'req-outro@x.com']), pedidoDe('maria2@x.com'))))
  it('NÃO envia pedido já aprovado, com campo extra ou nome gigante', async () => {
    await assertFails(setDoc(ref(visitor(), ['requests', 'req-r2@x.com']), pedidoDe('r2@x.com', { status: 'aprovada' })))
    await assertFails(setDoc(ref(visitor(), ['requests', 'req-r3@x.com']), pedidoDe('r3@x.com', { memberId: 'mem-01' })))
    await assertFails(setDoc(ref(visitor(), ['requests', 'req-r4@x.com']), pedidoDe('r4@x.com', { fullName: 'x'.repeat(500) })))
  })
  it('um e-mail só tem um pedido: não sobrescreve o que está em análise nem o aprovado', async () => {
    await assertSucceeds(setDoc(ref(visitor(), ['requests', 'req-dup@x.com']), pedidoDe('dup@x.com')))
    await assertFails(setDoc(ref(visitor(), ['requests', 'req-dup@x.com']), pedidoDe('dup@x.com', { fullName: 'Outra Pessoa' })))
    await assertFails(setDoc(ref(visitor(), ['requests', 'req-aprovada@x.com']), pedidoDe('aprovada@x.com')))
    await assertFails(updateDoc(ref(visitor(), ['requests', 'req-dup@x.com']), { message: 'mudei' }))
  })
  it('quem foi recusado reenvia o pedido, mas não reabre nem aprova por conta própria', async () => {
    await assertFails(updateDoc(ref(visitor(), ['requests', 'req-recusada@x.com']), { status: 'pendente' }))
    await assertFails(setDoc(ref(visitor(), ['requests', 'req-recusada@x.com']), pedidoDe('recusada@x.com', { status: 'aprovada' })))
    await assertFails(setDoc(ref(visitor(), ['requests', 'req-recusada@x.com']), pedidoDe('recusada@x.com', { reviewedBy: 'eu' })))
    await assertSucceeds(setDoc(ref(visitor(), ['requests', 'req-recusada@x.com']), pedidoDe('recusada@x.com', { message: 'corrigi' })))
  })
  it('NÃO edita nem apaga pedidos', async () => {
    await assertFails(updateDoc(ref(visitor(), ['requests', 'req-1']), { status: 'aprovada' }))
    await assertFails(deleteDoc(ref(visitor(), ['requests', 'req-1'])))
  })
  it('só gera o aviso e a atividade do próprio pedido', async () => {
    await assertSucceeds(setDoc(ref(visitor(), ['notifications', 'n-pedido']), { title: 'Nova solicitação de cadastro', body: 'x', kind: 'aviso', readBy: [] }))
    await assertFails(setDoc(ref(visitor(), ['notifications', 'n-x']), { title: 'Outro aviso', body: 'x', kind: 'aviso', readBy: [] }))
    await assertSucceeds(setDoc(ref(visitor(), ['activity', 'a-pedido']), { message: 'x', kind: 'membro', actor: 'Sistema' }))
    await assertFails(setDoc(ref(visitor(), ['activity', 'a-x']), { message: 'x', kind: 'evento', actor: 'Sistema' }))
  })
})

describe('perfil Membro', () => {
  const db = () => as('u-membro')
  it('lê agenda, nomes, avisos, hinos e perfis', async () => {
    for (const [n, i] of [['events', 'ev-1'], ['rosters', 'r-1'], ['directory', 'mem-10'], ['notifications', 'n-1'], ['hymns', 'h-1'], ['prayers', 'p-1'], ['roles', 'role-membro'], ['departments', 'dep-1'], ['readings', 'rd-1']]) {
      await assertSucceeds(getDoc(ref(db(), [n, i])))
    }
  })
  it('lê o próprio perfil e o próprio cadastro de membro, e mais nada', async () => {
    await assertSucceeds(getDoc(ref(db(), ['users', 'u-membro'])))
    await assertSucceeds(getDoc(ref(db(), ['members', 'mem-10'])))
    await assertFails(getDoc(ref(db(), ['members', 'mem-01'])))
    await assertFails(getDoc(ref(db(), ['users', 'u-admin'])))
    await assertFails(list(db(), 'members'))
    await assertFails(list(db(), 'users'))
    await assertFails(getDoc(ref(db(), ['requests', 'req-1'])))
  })
  it('NÃO cria nem altera cadastros da igreja', async () => {
    await assertFails(setDoc(ref(db(), ['events', 'ev-x']), { title: 'x' }))
    await assertFails(updateDoc(ref(db(), ['events', 'ev-1']), { title: 'x' }))
    await assertFails(updateDoc(ref(db(), ['events', 'ev-1']), { title: 'x', actions: [] }))
    await assertFails(setDoc(ref(db(), ['members', 'mem-x']), { fullName: 'x' }))
    await assertFails(updateDoc(ref(db(), ['teams', 'team-1']), { name: 'x' }))
    await assertFails(updateDoc(ref(db(), ['settings', 'settings-1']), { showSplash: false }))
  })
  it('escolhe a própria ação do evento (só o campo actions), mas não muda mais nada nele', async () => {
    await assertSucceeds(updateDoc(ref(db(), ['events', 'ev-1']), { actions: [{ id: 'a1', title: 'Som', memberIds: ['mem-10'] }], updatedAt: 'agora' }))
    await assertFails(updateDoc(ref(db(), ['events', 'ev-1']), { description: 'hack' }))
    await assertFails(updateDoc(ref(as('u-off'), ['events', 'ev-1']), { actions: [] }))
    await assertFails(updateDoc(ref(visitor(), ['events', 'ev-1']), { actions: [] }))
  })
  it('confirma a própria escala, mas não muda o resto dela', async () => {
    await assertSucceeds(updateDoc(ref(db(), ['rosters', 'r-1']), { assignments: [{ memberId: 'mem-10', role: 'x', status: 'confirmado' }], updatedAt: 'agora' }))
    await assertFails(updateDoc(ref(db(), ['rosters', 'r-1']), { title: 'hack' }))
    await assertFails(deleteDoc(ref(db(), ['rosters', 'r-1'])))
  })
  it('marca aviso como lido, favorita hino e diz que orou, só nesses campos', async () => {
    await assertSucceeds(updateDoc(ref(db(), ['notifications', 'n-1']), { readBy: ['u-membro'], updatedAt: 'agora' }))
    await assertFails(updateDoc(ref(db(), ['notifications', 'n-1']), { title: 'hack' }))
    await assertSucceeds(updateDoc(ref(db(), ['hymns', 'h-1']), { favoriteBy: ['u-membro'] }))
    await assertFails(updateDoc(ref(db(), ['hymns', 'h-1']), { title: 'hack' }))
    await assertSucceeds(updateDoc(ref(db(), ['prayers', 'p-1']), { prayedBy: ['u-membro'] }))
    await assertFails(updateDoc(ref(db(), ['prayers', 'p-1']), { status: 'atendido' }))
  })
  it('envia pedido de oração e registra atividade, mas não apaga pedidos', async () => {
    await assertSucceeds(setDoc(ref(db(), ['prayers', 'p-novo']), { title: 'x', prayedBy: [], status: 'aberto' }))
    await assertSucceeds(setDoc(ref(db(), ['activity', 'a-novo']), { message: 'x', kind: 'oracao', actor: 'Lucas' }))
    await assertFails(deleteDoc(ref(db(), ['prayers', 'p-1'])))
  })
  it('NÃO se promove nem cria usuários', async () => {
    await assertFails(updateDoc(ref(db(), ['users', 'u-membro']), { roleId: 'role-admin' }))
    await assertFails(setDoc(ref(db(), ['users', 'u-novo']), user('u-novo', 'role-membro')))
  })
})

describe('perfil Líder de Equipe', () => {
  const db = () => as('u-lider')
  it('lê membros e agenda; não cria evento nem lê usuários', async () => {
    await assertSucceeds(list(db(), 'members'))
    await assertSucceeds(getDoc(ref(db(), ['events', 'ev-1'])))
    await assertFails(setDoc(ref(db(), ['events', 'ev-x']), { title: 'x' }))
    await assertFails(list(db(), 'users'))
  })
  it('monta escalas e edita a equipe, mas não cria membros', async () => {
    await assertSucceeds(setDoc(ref(db(), ['rosters', 'r-novo']), { title: 'x', assignments: [] }))
    await assertSucceeds(updateDoc(ref(db(), ['rosters', 'r-1']), { title: 'Novo título' }))
    await assertSucceeds(updateDoc(ref(db(), ['teams', 'team-1']), { memberIds: ['mem-10', 'mem-01'] }))
    await assertFails(setDoc(ref(db(), ['members', 'mem-x']), { fullName: 'x' }))
    await assertFails(deleteDoc(ref(db(), ['rosters', 'r-1'])))
  })
})

describe('perfil Secretaria', () => {
  const db = () => as('u-sec')
  it('cadastra membros (e o nome no diretório) e analisa pedidos', async () => {
    await assertSucceeds(setDoc(ref(db(), ['members', 'mem-novo']), { fullName: 'Novo' }))
    await assertSucceeds(setDoc(ref(db(), ['directory', 'mem-novo']), { fullName: 'Novo' }))
    await assertSucceeds(updateDoc(ref(db(), ['requests', 'req-1']), { status: 'aprovada' }))
    await assertSucceeds(updateDoc(ref(db(), ['teams', 'team-1']), { memberIds: ['mem-10', 'mem-novo'] }))
    await assertSucceeds(list(db(), 'requests'))
  })
  it('cria usuários comuns, mas não administradores nem permissões personalizadas', async () => {
    await assertSucceeds(setDoc(ref(db(), ['users', 'u-n1']), user('u-n1', 'role-membro')))
    await assertFails(setDoc(ref(db(), ['users', 'u-n2']), user('u-n2', 'role-admin')))
    await assertFails(setDoc(ref(db(), ['users', 'u-n3']), user('u-n3', 'role-membro', { customPermissions: ROLES['role-admin'] })))
  })
  it('NÃO vira administrador nem mexe em administradores', async () => {
    await assertFails(updateDoc(ref(db(), ['users', 'u-sec']), { roleId: 'role-admin' }))
    await assertFails(updateDoc(ref(db(), ['users', 'u-admin']), { roleId: 'role-membro' }))
    await assertFails(deleteDoc(ref(db(), ['users', 'u-admin'])))
    await assertFails(updateDoc(ref(db(), ['users', 'u-membro']), { customPermissions: ROLES['role-admin'] }))
  })
  it('NÃO mexe em perfis de acesso nem em configurações', async () => {
    await assertFails(updateDoc(ref(db(), ['roles', 'role-membro']), { name: 'x' }))
    await assertFails(updateDoc(ref(db(), ['settings', 'settings-1']), { showSplash: false }))
    await assertFails(updateDoc(ref(db(), ['church', 'church-1']), { name: 'x' }))
  })
  it('exclui eventos e escalas', async () => {
    await assertSucceeds(deleteDoc(ref(db(), ['events', 'ev-1'])))
    await assertSucceeds(deleteDoc(ref(db(), ['rosters', 'r-1'])))
  })
})

describe('Administrador', () => {
  const db = () => as('u-admin')
  it('faz tudo, inclusive perfis, configurações e outro administrador', async () => {
    await assertSucceeds(updateDoc(ref(db(), ['roles', 'role-membro']), { description: 'x' }))
    await assertSucceeds(updateDoc(ref(db(), ['settings', 'settings-1']), { showSplash: false }))
    await assertSucceeds(setDoc(ref(db(), ['users', 'u-adm2']), user('u-adm2', 'role-admin')))
    await assertSucceeds(updateDoc(ref(db(), ['users', 'u-custom']), { customPermissions: ROLES['role-membro'] }))
    await assertSucceeds(list(db(), 'users'))
    await assertSucceeds(list(db(), 'members'))
    await assertSucceeds(deleteDoc(ref(db(), ['users', 'u-adm2'])))
  })
  it('não apaga o perfil "system" do administrador, nem o documento-marca', async () => {
    await assertFails(deleteDoc(ref(db(), ['roles', 'role-admin'])))
    await assertFails(deleteDoc(doc(db(), ...base())))
  })
})

describe('Patrimônio (coleção assets)', () => {
  const bem = { name: 'Mesa', assetNumber: '002', category: 'movel', condition: 'bom' }
  it('visitante, Membro, Líder e Secretaria (sem o módulo) não leem nem gravam', async () => {
    for (const db of [visitor(), as('u-membro'), as('u-lider'), as('u-sec')]) {
      await assertFails(getDoc(ref(db, ['assets', 'ast-1'])))
      await assertFails(list(db, 'assets'))
      await assertFails(setDoc(ref(db, ['assets', 'ast-x']), bem))
    }
  })
  it('o Administrador lista, cadastra, edita e exclui', async () => {
    const db = as('u-admin')
    await assertSucceeds(list(db, 'assets'))
    await assertSucceeds(setDoc(ref(db, ['assets', 'ast-a']), bem))
    await assertSucceeds(updateDoc(ref(db, ['assets', 'ast-a']), { condition: 'regular' }))
    await assertSucceeds(deleteDoc(ref(db, ['assets', 'ast-a'])))
  })
  it('permissão personalizada libera só o que foi marcado', async () => {
    const db = as('u-pat')
    await assertSucceeds(getDoc(ref(db, ['assets', 'ast-1'])))
    await assertSucceeds(setDoc(ref(db, ['assets', 'ast-p']), bem))
    await assertFails(updateDoc(ref(db, ['assets', 'ast-1']), { condition: 'ruim' }))
    await assertFails(deleteDoc(ref(db, ['assets', 'ast-1'])))
  })
  it('perfil gravado antes do módulo existir: sem acesso ao Patrimônio, mas o resto segue funcionando', async () => {
    const db = as('u-antigo')
    await assertFails(getDoc(ref(db, ['assets', 'ast-1'])))
    await assertSucceeds(getDoc(ref(db, ['events', 'ev-1'])))
    await assertSucceeds(getDoc(ref(db, ['departments', 'dep-1'])))
  })
})

describe('permissões personalizadas e contas sem acesso', () => {
  it('permissão do usuário vale no lugar da do perfil', async () => {
    // o teste do administrador acima já mexeu neste usuário: recria como no começo
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), ...base(), 'users', 'u-custom'), user('u-custom', 'role-membro', { customPermissions: matrix({ eventos: ['view', 'create'] }) })),
    )
    const db = as('u-custom')
    await assertSucceeds(setDoc(ref(db, ['events', 'ev-c']), { title: 'x' })) // eventos.create liberado
    await assertFails(updateDoc(ref(db, ['events', 'ev-1']), { title: 'x' })) // eventos.edit não
  })
  it('usuário inativo só enxerga o que o visitante enxerga (e o próprio perfil)', async () => {
    const db = as('u-off')
    await assertSucceeds(getDoc(ref(db, ['users', 'u-off'])))
    await assertSucceeds(getDoc(ref(db, ['events', 'ev-1'])))
    await assertFails(getDoc(ref(db, ['departments', 'dep-1'])))
    await assertFails(list(db, 'members'))
    await assertFails(setDoc(ref(db, ['events', 'ev-i']), { title: 'x' }))
  })
  it('conta logada sem perfil não lê nada além do público', async () => {
    const db = as('u-estranho')
    await assertSucceeds(getDoc(ref(db, ['users', 'u-estranho']))) // documento que não existe: a tela mostra "sem acesso"
    await assertSucceeds(getDoc(ref(db, ['events', 'ev-1'])))
    await assertFails(list(db, 'members'))
    await assertFails(getDoc(ref(db, ['departments', 'dep-1'])))
  })
})

describe('primeiro acesso do administrador (admin@admin.com)', () => {
  const adminProfile = (uid) => user(uid, 'role-admin', { email: 'admin@admin.com' })
  it('cria o próprio perfil de administrador', () => assertSucceeds(setDoc(ref(as('uid-boot', 'admin@admin.com'), ['users', 'uid-boot']), adminProfile('uid-boot'))))
  it('não vale para outro e-mail', async () => {
    await assertFails(setDoc(ref(as('uid-x', 'outro@teste.com'), ['users', 'uid-x']), user('uid-x', 'role-admin')))
    await assertFails(setDoc(ref(as('uid-y', 'admin@admin.com.evil'), ['users', 'uid-y']), user('uid-y', 'role-admin')))
  })
  it('não cria perfil para outro uid nem com outro perfil de acesso', async () => {
    await assertFails(setDoc(ref(as('uid-boot2', 'admin@admin.com'), ['users', 'uid-outro']), adminProfile('uid-outro')))
    await assertFails(setDoc(ref(as('uid-boot3', 'admin@admin.com'), ['users', 'uid-boot3']), user('uid-boot3', 'role-membro')))
  })
  it('numa igreja nova (sem perfis nem dados) o administrador monta tudo', async () => {
    const db = as('uid-fresh', 'admin@admin.com')
    await assertSucceeds(setDoc(ref(db, ['users', 'uid-fresh'], FRESH), adminProfile('uid-fresh')))
    await assertSucceeds(setDoc(doc(db, ...base(FRESH)), { seededAt: 'x', version: '1' }))
    await assertSucceeds(setDoc(ref(db, ['roles', 'role-admin'], FRESH), { name: 'Admin', permissions: ROLES['role-admin'], system: true }))
    await assertSucceeds(setDoc(ref(db, ['members', 'm1'], FRESH), { fullName: 'x' }))
    await assertSucceeds(setDoc(ref(db, ['directory', 'm1'], FRESH), { fullName: 'x' }))
    await assertSucceeds(list(db, 'users', FRESH))
  })
  it('uma conta qualquer não cria o documento-marca nem dados', async () => {
    const db = as('uid-qq', 'qualquer@teste.com')
    await assertFails(setDoc(doc(db, ...base(FRESH + '2')), { seededAt: 'x' }))
    await assertFails(setDoc(ref(db, ['members', 'm1'], FRESH + '2'), { fullName: 'x' }))
  })
})

describe('aparelhos das notificações (devices)', () => {
  const web = (uid, id, extra = {}) => ({ id, userId: uid, kind: 'web', label: 'Android (navegador)', subscription: { endpoint: `https://push.example/${id}`, keys: { p256dh: 'k', auth: 'a' } }, updatedAt: '2026-11-04T00:00:00.000Z', ...extra })
  const android = (uid, id, extra = {}) => ({ id, userId: uid, kind: 'android', label: 'Aplicativo Android', token: `token-${id}`, updatedAt: '2026-11-04T00:00:00.000Z', ...extra })
  const dev = (db, id) => ref(db, ['devices', id])

  it('cada pessoa cadastra e renova o próprio aparelho (navegador ou Android)', async () => {
    await assertSucceeds(setDoc(dev(as('u-membro'), 'd-web'), web('u-membro', 'd-web')))
    await assertSucceeds(setDoc(dev(as('u-membro'), 'd-web'), web('u-membro', 'd-web', { updatedAt: '2026-11-05T00:00:00.000Z' })))
    await assertSucceeds(setDoc(dev(as('u-lider'), 'd-and'), android('u-lider', 'd-and')))
    await assertSucceeds(setDoc(dev(as('u-sec'), 'd-sec'), web('u-sec', 'd-sec')))
  })

  it('NÃO cadastra aparelho em nome de outra pessoa, de visitante, de usuário inativo ou sem perfil', async () => {
    await assertFails(setDoc(dev(as('u-membro'), 'd-x1'), web('u-lider', 'd-x1')))
    await assertFails(setDoc(dev(visitor(), 'd-x2'), web('u-membro', 'd-x2')))
    await assertFails(setDoc(dev(as('u-off'), 'd-x3'), web('u-off', 'd-x3')))
    await assertFails(setDoc(dev(as('u-sem-perfil'), 'd-x4'), web('u-sem-perfil', 'd-x4')))
  })

  it('NÃO aceita código diferente do id, campo extra, tipo inválido ou dados incompletos', async () => {
    const db = () => as('u-membro')
    await assertFails(setDoc(dev(db(), 'd-y1'), web('u-membro', 'outro-id')))
    await assertFails(setDoc(dev(db(), 'd-y2'), web('u-membro', 'd-y2', { roleId: 'role-admin' })))
    await assertFails(setDoc(dev(db(), 'd-y3'), web('u-membro', 'd-y3', { kind: 'ios' })))
    await assertFails(setDoc(dev(db(), 'd-y4'), web('u-membro', 'd-y4', { subscription: { endpoint: 'https://x', keys: 'nada' } })))
    await assertFails(setDoc(dev(db(), 'd-y5'), web('u-membro', 'd-y5', { subscription: { endpoint: 'x'.repeat(1200), keys: {} } })))
    await assertFails(setDoc(dev(db(), 'd-y6'), android('u-membro', 'd-y6', { token: 'x'.repeat(600) })))
    await assertFails(setDoc(dev(db(), 'd-y7'), { id: 'd-y7', userId: 'u-membro', kind: 'android' }))
  })

  it('lê só o próprio aparelho e não lista os dos outros', async () => {
    await assertSucceeds(setDoc(dev(as('u-membro'), 'd-ler'), web('u-membro', 'd-ler')))
    await assertSucceeds(getDoc(dev(as('u-membro'), 'd-ler')))
    await assertFails(getDoc(dev(as('u-lider'), 'd-ler')))
    await assertFails(getDoc(dev(visitor(), 'd-ler')))
    await assertSucceeds(getDoc(dev(as('u-membro'), 'd-nao-existe')))
    await assertFails(list(as('u-membro'), 'devices'))
    await assertFails(list(as('u-admin'), 'devices'))
  })

  it('apaga só o próprio aparelho (ao sair da conta); o servidor limpa os demais', async () => {
    await assertSucceeds(setDoc(dev(as('u-membro'), 'd-del'), web('u-membro', 'd-del')))
    await assertFails(deleteDoc(dev(as('u-lider'), 'd-del')))
    await assertFails(deleteDoc(dev(as('u-admin'), 'd-del')))
    await assertFails(deleteDoc(dev(visitor(), 'd-del')))
    await assertSucceeds(deleteDoc(dev(as('u-membro'), 'd-del')))
  })

  it('o aparelho passa para quem entra depois na mesma conta do navegador, e quem saiu deixa de poder apagá-lo', async () => {
    await assertSucceeds(setDoc(dev(as('u-membro'), 'd-troca'), web('u-membro', 'd-troca')))
    await assertSucceeds(setDoc(dev(as('u-lider'), 'd-troca'), web('u-lider', 'd-troca')))
    await assertFails(deleteDoc(dev(as('u-membro'), 'd-troca')))
    await assertSucceeds(deleteDoc(dev(as('u-lider'), 'd-troca')))
  })

  it('a configuração do envio (chaves do servidor) não é legível nem gravável por nenhum perfil', async () => {
    for (const who of [visitor(), as('u-membro'), as('u-sec'), as('u-admin')]) {
      await assertFails(getDoc(ref(who, ['pushConfig', 'vapid'])))
      await assertFails(setDoc(ref(who, ['pushConfig', 'vapid']), { publicKey: 'x', privateKey: 'y' }))
    }
  })

  it('a marca de envio da notificação continua só com o servidor: quem lê/marca como lida não mexe nela', async () => {
    await assertSucceeds(updateDoc(ref(as('u-membro'), ['notifications', 'n-1']), { readBy: ['u-membro'] }))
    await assertFails(updateDoc(ref(as('u-membro'), ['notifications', 'n-1']), { pushedAt: null }))
    await assertFails(updateDoc(ref(visitor(), ['notifications', 'n-1']), { pushedAt: 'x' }))
  })
})
