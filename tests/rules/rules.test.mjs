// Testes das regras de segurança (firestore.rules) contra o emulador do Firestore.
// Rodar (com Java 21): npm run test:rules  — veja tests/rules/README.md
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'

const MODULES = ['eventos', 'equipes', 'liturgia', 'membros', 'usuarios', 'lideres', 'cargos', 'departamentos', 'escalas', 'cultos', 'participantes', 'perfis', 'permissoes', 'notificacoes', 'relatorios', 'configuracoes']
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
  const pedido = { fullName: 'Maria Souza', birthDate: '', phone: '(11) 9', email: '', address: '', baptized: false, baptismDate: '', teamIds: ['team-1'], message: 'oi', status: 'pendente' }
  it('envia um pedido de cadastro pendente', () => assertSucceeds(setDoc(ref(visitor(), ['requests', 'req-novo']), pedido)))
  it('NÃO envia pedido já aprovado, com campo extra ou nome gigante', async () => {
    await assertFails(setDoc(ref(visitor(), ['requests', 'r2']), { ...pedido, status: 'aprovada' }))
    await assertFails(setDoc(ref(visitor(), ['requests', 'r3']), { ...pedido, memberId: 'mem-01' }))
    await assertFails(setDoc(ref(visitor(), ['requests', 'r4']), { ...pedido, fullName: 'x'.repeat(500) }))
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
    await assertFails(setDoc(ref(db(), ['members', 'mem-x']), { fullName: 'x' }))
    await assertFails(updateDoc(ref(db(), ['teams', 'team-1']), { name: 'x' }))
    await assertFails(updateDoc(ref(db(), ['settings', 'settings-1']), { showSplash: false }))
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
