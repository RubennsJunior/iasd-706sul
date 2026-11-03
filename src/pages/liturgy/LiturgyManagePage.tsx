import type { ReactNode } from 'react'
import { BookOpen, GraduationCap, HandHeart, MessageSquareHeart, Music } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CrudPage } from '../../components/crud/CrudPage'
import type { FieldDef } from '../../components/forms/types'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { SegmentedTabs } from '../../components/ui/Tabs'
import type { ChurchMessage, Hymn, PrayerItem, Reading, SabbathMaterial } from '../../models'
import { hymnsService, materialsService, messagesService, prayersService, readingsService } from '../../services'
import { formatDate, todayISO } from '../../utils/date'
import {
  AGE_GROUPS,
  MESSAGE_KIND,
  MESSAGE_KIND_OPTIONS,
  PRAYER_KIND,
  PRAYER_KIND_OPTIONS,
  PRAYER_STATUS_OPTIONS,
} from '../../utils/labels'

type Tab = 'leituras' | 'hinos' | 'oracoes' | 'mensagens' | 'materiais'

const sortByDateDesc = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date)

function Readings({ header }: { header: ReactNode }) {
  const fields: FieldDef[] = [
    { name: 'date', label: 'Data', type: 'date', required: true },
    { name: 'reference', label: 'Referência bíblica', type: 'text', required: true, placeholder: 'Ex.: Salmo 119:105' },
    { name: 'theme', label: 'Tema', type: 'text', span: 2 },
    { name: 'text', label: 'Texto do versículo', type: 'textarea', required: true, rows: 3 },
  ]
  return (
    <CrudPage<Reading>
      module="liturgia"
      basePath="/liturgias/leituras"
      title="Liturgias"
      subtitle="Gerencie as liturgias"
      icon={BookOpen}
      header={header}
      service={readingsService}
      entityLabel="Leitura"
      feminine
      newLabel="Nova Leitura"
      fields={fields}
      defaultValues={{ date: todayISO(), reference: '', theme: '', text: '' }}
      searchText={(r) => [r.reference, r.theme, r.text]}
      sortBy={sortByDateDesc}
      fromForm={(v) => ({ date: v.date, reference: String(v.reference).trim(), theme: String(v.theme ?? '').trim(), text: String(v.text).trim() })}
      columns={[
        { header: 'Data', sortValue: (r) => r.date, cell: (r) => formatDate(r.date) },
        { header: 'Referência', sortValue: (r) => r.reference, cell: (r) => <span className="font-medium text-navy-900">{r.reference}</span> },
        { header: 'Tema', cell: (r) => r.theme || '—' },
        { header: 'Texto', cell: (r) => <span className="line-clamp-1 max-w-sm">{r.text}</span> },
      ]}
      card={(r) => ({ title: r.reference, subtitle: r.theme || undefined, meta: `${formatDate(r.date)} • ${r.text}` })}
    />
  )
}

function Hymns({ header }: { header: ReactNode }) {
  const fields: FieldDef[] = [
    { name: 'number', label: 'Número', type: 'number', required: true, min: 1 },
    { name: 'category', label: 'Categoria', type: 'text', required: true, placeholder: 'Ex.: Louvor' },
    { name: 'title', label: 'Título', type: 'text', required: true, span: 2 },
    { name: 'lyrics', label: 'Letra', type: 'textarea', rows: 5, hint: 'Use apenas letras de domínio público ou autorizadas.' },
  ]
  return (
    <CrudPage<Hymn>
      module="liturgia"
      basePath="/liturgias/hinos"
      title="Liturgias"
      subtitle="Gerencie as liturgias"
      icon={BookOpen}
      header={header}
      service={hymnsService}
      entityLabel="Hino"
      fields={fields}
      defaultValues={{ number: '', category: '', title: '', lyrics: '' }}
      searchText={(h) => [h.title, h.category, String(h.number)]}
      sortBy={(a, b) => a.number - b.number}
      fromForm={(v, editing) => ({
        number: Number(v.number),
        category: String(v.category).trim(),
        title: String(v.title).trim(),
        lyrics: String(v.lyrics ?? '').trim(),
        favoriteBy: editing?.favoriteBy ?? [],
      })}
      validate={(v) => (Number(v.number) >= 1 ? undefined : { number: 'Informe um número válido.' })}
      columns={[
        { header: 'Nº', sortValue: (h) => h.number, cell: (h) => h.number },
        { header: 'Título', sortValue: (h) => h.title, cell: (h) => <span className="font-medium text-navy-900">{h.title}</span> },
        { header: 'Categoria', sortValue: (h) => h.category, cell: (h) => <Badge tone="info">{h.category}</Badge> },
        { header: 'Favoritos', sortValue: (h) => h.favoriteBy.length, cell: (h) => h.favoriteBy.length },
      ]}
      card={(h) => ({ title: `${h.number}. ${h.title}`, badge: <Badge tone="info">{h.category}</Badge>, meta: `${h.favoriteBy.length} favorito(s)` })}
    />
  )
}

function Prayers({ header }: { header: ReactNode }) {
  const fields: FieldDef[] = [
    { name: 'kind', label: 'Tipo', type: 'select', required: true, options: PRAYER_KIND_OPTIONS },
    { name: 'status', label: 'Situação', type: 'select', required: true, options: PRAYER_STATUS_OPTIONS },
    { name: 'title', label: 'Título', type: 'text', required: true, span: 2 },
    { name: 'author', label: 'Autor', type: 'text', required: true },
    { name: 'date', label: 'Data', type: 'date', required: true },
    { name: 'text', label: 'Descrição', type: 'textarea', required: true, rows: 4 },
  ]
  return (
    <CrudPage<PrayerItem>
      module="liturgia"
      basePath="/liturgias/oracoes"
      title="Liturgias"
      subtitle="Gerencie as liturgias"
      icon={BookOpen}
      header={header}
      service={prayersService}
      entityLabel="Oração"
      feminine
      newLabel="Nova Oração"
      fields={fields}
      defaultValues={{ kind: 'oracao', status: 'aberto', title: '', author: '', date: todayISO(), text: '' }}
      searchText={(p) => [p.title, p.text, p.author]}
      sortBy={sortByDateDesc}
      fromForm={(v, editing) => ({
        kind: v.kind,
        status: v.status,
        title: String(v.title).trim(),
        author: String(v.author).trim(),
        date: v.date,
        text: String(v.text).trim(),
        prayedBy: editing?.prayedBy ?? [],
      })}
      filters={[{ key: 'kind', label: 'Tipo', options: PRAYER_KIND_OPTIONS, predicate: (p, value) => p.kind === value }]}
      columns={[
        { header: 'Título', sortValue: (p) => p.title, cell: (p) => <span className="font-medium text-navy-900">{p.title}</span> },
        { header: 'Tipo', cell: (p) => PRAYER_KIND[p.kind] },
        { header: 'Autor', cell: (p) => p.author },
        { header: 'Data', sortValue: (p) => p.date, cell: (p) => formatDate(p.date) },
        { header: 'Situação', cell: (p) => <StatusBadge kind="prayer" value={p.status} /> },
      ]}
      card={(p) => ({
        title: p.title,
        subtitle: `${PRAYER_KIND[p.kind]} • ${p.author}`,
        badge: <StatusBadge kind="prayer" value={p.status} />,
        meta: `${formatDate(p.date)} • ${p.prayedBy.length} oraram`,
      })}
    />
  )
}

function Messages({ header }: { header: ReactNode }) {
  const fields: FieldDef[] = [
    { name: 'kind', label: 'Tipo', type: 'select', required: true, options: MESSAGE_KIND_OPTIONS },
    { name: 'date', label: 'Data', type: 'date', required: true },
    { name: 'title', label: 'Título', type: 'text', required: true, span: 2 },
    { name: 'author', label: 'Autor', type: 'text', required: true, span: 2 },
    { name: 'body', label: 'Texto', type: 'textarea', required: true, rows: 6 },
  ]
  return (
    <CrudPage<ChurchMessage>
      module="liturgia"
      basePath="/liturgias/mensagens"
      title="Liturgias"
      subtitle="Gerencie as liturgias"
      icon={BookOpen}
      header={header}
      service={messagesService}
      entityLabel="Mensagem"
      feminine
      newLabel="Nova Mensagem"
      fields={fields}
      defaultValues={{ kind: 'mensagem', date: todayISO(), title: '', author: '', body: '' }}
      searchText={(m) => [m.title, m.author, m.body]}
      sortBy={sortByDateDesc}
      fromForm={(v) => ({ kind: v.kind, date: v.date, title: String(v.title).trim(), author: String(v.author).trim(), body: String(v.body).trim() })}
      filters={[{ key: 'kind', label: 'Tipo', options: MESSAGE_KIND_OPTIONS, predicate: (m, value) => m.kind === value }]}
      columns={[
        { header: 'Título', sortValue: (m) => m.title, cell: (m) => <span className="font-medium text-navy-900">{m.title}</span> },
        { header: 'Tipo', cell: (m) => <Badge tone={m.kind === 'mensagem' ? 'info' : 'gold'}>{MESSAGE_KIND[m.kind]}</Badge> },
        { header: 'Autor', cell: (m) => m.author },
        { header: 'Data', sortValue: (m) => m.date, cell: (m) => formatDate(m.date) },
      ]}
      card={(m) => ({
        title: m.title,
        subtitle: m.author,
        badge: <Badge tone={m.kind === 'mensagem' ? 'info' : 'gold'}>{MESSAGE_KIND[m.kind]}</Badge>,
        meta: formatDate(m.date),
      })}
    />
  )
}

function Materials({ header }: { header: ReactNode }) {
  const fields: FieldDef[] = [
    { name: 'quarter', label: 'Trimestre', type: 'text', required: true, placeholder: 'Ex.: 4º Trimestre' },
    { name: 'lesson', label: 'Lição', type: 'text', required: true, placeholder: 'Ex.: Lição 6' },
    { name: 'title', label: 'Título', type: 'text', required: true, span: 2 },
    { name: 'ageGroup', label: 'Público', type: 'select', required: true, options: AGE_GROUPS },
    { name: 'date', label: 'Data de publicação', type: 'date', required: true },
    { name: 'description', label: 'Descrição', type: 'textarea', rows: 4 },
  ]
  return (
    <CrudPage<SabbathMaterial>
      module="liturgia"
      basePath="/liturgias/materiais"
      title="Liturgias"
      subtitle="Gerencie as liturgias"
      icon={BookOpen}
      header={header}
      service={materialsService}
      entityLabel="Material"
      newLabel="Novo Material"
      fields={fields}
      defaultValues={{ quarter: '', lesson: '', title: '', ageGroup: 'Adultos', date: todayISO(), description: '' }}
      searchText={(m) => [m.title, m.lesson, m.quarter, m.ageGroup]}
      sortBy={sortByDateDesc}
      fromForm={(v) => ({
        quarter: String(v.quarter).trim(),
        lesson: String(v.lesson).trim(),
        title: String(v.title).trim(),
        ageGroup: v.ageGroup,
        date: v.date,
        description: String(v.description ?? '').trim(),
      })}
      filters={[{ key: 'age', label: 'Público', options: AGE_GROUPS, predicate: (m, value) => m.ageGroup === value }]}
      columns={[
        { header: 'Material', sortValue: (m) => m.title, cell: (m) => <span className="font-medium text-navy-900">{m.title}</span> },
        { header: 'Lição', cell: (m) => `${m.quarter} • ${m.lesson}` },
        { header: 'Público', cell: (m) => <Badge tone="info">{m.ageGroup}</Badge> },
        { header: 'Publicado', sortValue: (m) => m.date, cell: (m) => formatDate(m.date) },
      ]}
      card={(m) => ({
        title: m.title,
        subtitle: `${m.quarter} • ${m.lesson}`,
        badge: <Badge tone="info">{m.ageGroup}</Badge>,
        meta: `Publicado em ${formatDate(m.date)}`,
      })}
    />
  )
}

const TABS: Tab[] = ['leituras', 'hinos', 'oracoes', 'mensagens', 'materiais']

export function LiturgyManagePage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // A aba vem do endereço (/liturgias/hinos), para o cadastro e a edição abrirem em telas próprias.
  const segment = pathname.split('/')[2] as Tab | undefined
  const tab = segment && TABS.includes(segment) ? segment : 'leituras'
  const header = (
    <SegmentedTabs<Tab>
      value={tab}
      onChange={(key) => navigate(`/liturgias/${key}`)}
      items={[
        { key: 'leituras', label: 'Leituras', icon: BookOpen },
        { key: 'hinos', label: 'Hinos', icon: Music },
        { key: 'oracoes', label: 'Orações', icon: HandHeart },
        { key: 'mensagens', label: 'Mensagens', icon: MessageSquareHeart },
        { key: 'materiais', label: 'Escola Sabatina', icon: GraduationCap },
      ]}
    />
  )
  return (
    <>
      {tab === 'leituras' && <Readings header={header} />}
      {tab === 'hinos' && <Hymns header={header} />}
      {tab === 'oracoes' && <Prayers header={header} />}
      {tab === 'mensagens' && <Messages header={header} />}
      {tab === 'materiais' && <Materials header={header} />}
    </>
  )
}
