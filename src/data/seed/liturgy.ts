import type { ChurchMessage, Hymn, PrayerItem, Reading, SabbathMaterial } from '../../models'
import { addDays, todayISO } from '../../utils/date'

/** Versículos curtos, em linguagem tradicional. Hinos: apenas títulos e letras de exemplo. */
const READINGS: Array<[reference: string, text: string, theme: string]> = [
  ['Salmo 119:105', 'Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho.', 'A Palavra que guia'],
  ['Salmo 23:1', 'O Senhor é o meu pastor; nada me faltará.', 'O cuidado do Pastor'],
  ['Provérbios 3:5', 'Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.', 'Confiança'],
  ['Mateus 11:28', 'Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.', 'Descanso em Cristo'],
  ['Isaías 41:10', 'Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.', 'Coragem'],
  ['João 3:16', 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.', 'O amor de Deus'],
  ['Josué 1:9', 'Esforça-te e tem bom ânimo; não pasmes, nem te espantes, porque o Senhor, teu Deus, é contigo.', 'Bom ânimo'],
  ['Salmo 46:1', 'Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.', 'Refúgio'],
  ['Filipenses 4:13', 'Posso todas as coisas em Cristo que me fortalece.', 'Força'],
  ['Romanos 8:28', 'E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus.', 'Propósito'],
  ['Salmo 121:1-2', 'Elevo os meus olhos para os montes, de onde vem o meu socorro. O meu socorro vem do Senhor, que fez os céus e a terra.', 'Socorro'],
  ['Mateus 6:33', 'Buscai primeiro o reino de Deus e a sua justiça, e todas essas coisas vos serão acrescentadas.', 'Prioridades'],
  ['Apocalipse 21:4', 'Deus limpará de seus olhos toda lágrima; e não haverá mais morte, nem pranto, nem dor.', 'A esperança final'],
  ['Hebreus 11:1', 'Ora, a fé é o firme fundamento das coisas que se esperam e a prova das coisas que se não veem.', 'Fé'],
  ['Salmo 37:5', 'Entrega o teu caminho ao Senhor; confia nele, e ele o fará.', 'Entrega'],
]

export function seedReadings(): Reading[] {
  const today = todayISO()
  return READINGS.map(([reference, text, theme], index) => ({
    id: `read-${String(index + 1).padStart(2, '0')}`,
    date: addDays(today, index - 3),
    reference,
    text,
    theme,
  }))
}

const HYMN_ROWS: Array<[title: string, category: string, lyrics: string]> = [
  ['Cantai ao Senhor', 'Louvor', 'Cantai ao Senhor um cântico novo; louvai o seu nome com alegria.'],
  ['Grandes Maravilhas', 'Louvor', 'Grandes maravilhas fez o Senhor; o nosso coração transborda de gratidão.'],
  ['Luz do Mundo', 'Cristo', 'Tua palavra é luz que ilumina os passos de quem confia em ti.'],
  ['Doce Hora de Oração', 'Oração', 'Há uma hora de paz em que o coração descansa aos pés do Senhor.'],
  ['Segurança em Jesus', 'Confiança', 'Nas mãos de Jesus há refúgio e descanso para a alma cansada.'],
  ['Rude Cruz', 'Cristo', 'Na cruz está o amor que perdoa e que nos chama a seguir.'],
  ['Eis que Vem Jesus', 'Segunda Vinda', 'Eis que vem Jesus nas nuvens, e o povo fiel o aguarda em esperança.'],
  ['Amor Sem Fim', 'Amor de Deus', 'Amor sem fim, que nos alcançou e nos transforma a cada dia.'],
  ['Castelo Forte', 'Confiança', 'Deus é o nosso castelo forte, auxílio sempre presente.'],
  ['Fonte de Paz', 'Paz', 'Quem bebe desta fonte nunca mais terá sede de paz.'],
  ['Sábado Santo', 'Sábado', 'Bem-vindo, sábado santo, dia de descanso e comunhão com o Criador.'],
  ['Mãos que Servem', 'Serviço', 'Mãos que servem e corações que amam refletem o caráter de Cristo.'],
  ['Pelo Mundo Inteiro', 'Missão', 'Pelo mundo inteiro levaremos as boas-novas de salvação.'],
  ['Mais Perto', 'Consagração', 'Mais perto quero estar, meu Deus, de ti, em cada passo do caminho.'],
  ['Aleluia ao Rei', 'Louvor', 'Aleluia ao Rei dos reis, que reina para sempre.'],
]

export function seedHymns(): Hymn[] {
  return HYMN_ROWS.map(([title, category, lyrics], index) => ({
    id: `hymn-${String(index + 1).padStart(2, '0')}`,
    number: index + 1,
    title,
    category,
    lyrics,
    favoriteBy: index % 4 === 0 ? ['user-01'] : [],
  }))
}

export function seedPrayers(): PrayerItem[] {
  const today = todayISO()
  const row = (
    n: number,
    kind: PrayerItem['kind'],
    title: string,
    text: string,
    author: string,
    daysAgo: number,
    status: PrayerItem['status'],
    prayedBy: string[] = [],
  ): PrayerItem => ({
    id: `pray-${String(n).padStart(2, '0')}`,
    kind,
    title,
    text,
    author,
    date: addDays(today, -daysAgo),
    status,
    prayedBy,
  })
  return [
    row(1, 'oracao', 'Oração pela Família', 'Senhor, abençoa e protege os lares da nossa igreja, enche-os de paz e de amor.', 'Equipe de Intercessão', 1, 'aberto', ['user-02']),
    row(2, 'oracao', 'Oração pelos Doentes', 'Pai, concede restauração e conforto aos irmãos que enfrentam enfermidades.', 'Equipe de Intercessão', 3, 'aberto'),
    row(3, 'pedido', 'Cirurgia de um irmão', 'Peço oração por um irmão da igreja que fará uma cirurgia na próxima semana.', 'Maria Oliveira', 2, 'aberto', ['user-01', 'user-03']),
    row(4, 'pedido', 'Provas e vestibular', 'Os jovens da igreja que farão provas importantes precisam de calma e sabedoria.', 'Letícia Monteiro', 4, 'aberto', ['user-02']),
    row(5, 'pedido', 'Emprego para um pai de família', 'Peço orações para que Deus abra portas de trabalho para um pai de família da igreja.', 'Roberto Alves', 9, 'atendido', ['user-01', 'user-02', 'user-03']),
    row(6, 'pedido', 'Viagem missionária', 'Oração pela equipe que viajará para apoiar uma igreja em formação.', 'Pr. Marcos Lima', 6, 'aberto'),
  ]
}

export function seedMessages(): ChurchMessage[] {
  const today = todayISO()
  return [
    {
      id: 'msg-01',
      kind: 'mensagem',
      title: 'A Esperança em Cristo',
      author: 'Pr. Marcos Lima',
      date: addDays(today, -1),
      body: 'Em meio às incertezas, a esperança que temos em Cristo é uma âncora para a alma. Ele prometeu estar conosco todos os dias e nos conduzir com segurança.\n\nNesta semana, reserve um momento a cada manhã para entregar suas preocupações a Deus e agradecer por um motivo específico.',
    },
    {
      id: 'msg-02',
      kind: 'reflexao',
      title: 'Servir com alegria',
      author: 'Roberto Alves',
      date: addDays(today, -4),
      body: 'Servir não é apenas cumprir uma escala: é refletir o caráter de Jesus. Quando servimos com alegria, as pessoas ao redor percebem a diferença.\n\nPergunta para refletir: de que forma posso servir alguém ainda hoje?',
    },
    {
      id: 'msg-03',
      kind: 'reflexao',
      title: 'O poder da oração em família',
      author: 'Patrícia Gomes',
      date: addDays(today, -8),
      body: 'A oração em família cria um ambiente de confiança e gratidão. Mesmo cinco minutos por dia, de forma constante, transformam a rotina do lar.',
    },
    {
      id: 'msg-04',
      kind: 'mensagem',
      title: 'Descanso para a alma',
      author: 'Pr. Marcos Lima',
      date: addDays(today, -12),
      body: 'O sábado nos convida a desacelerar e a lembrar que nossa identidade não depende do que produzimos, mas de quem nos criou e nos redimiu.',
    },
  ]
}

export function seedMaterials(): SabbathMaterial[] {
  const today = todayISO()
  return [
    ['mat-01', 'Lição 6', 'A Esperança que nos Sustenta', 'Estudo dirigido sobre a esperança cristã, com perguntas para a classe.', 'Adultos'],
    ['mat-02', 'Lição 6', 'Aventuras com a Palavra', 'Atividades, histórias e desenhos sobre a lição da semana.', 'Crianças'],
    ['mat-03', 'Lição 6', 'Jovens com Propósito', 'Roteiro de discussão em grupos pequenos e aplicação prática.', 'Jovens'],
    ['mat-04', 'Lição 5', 'Fé em Tempos Difíceis', 'Material complementar com texto-chave e sugestões de memorização.', 'Adultos'],
  ].map(([id, lesson, title, description, ageGroup], index) => ({
    id,
    quarter: '4º Trimestre',
    lesson,
    title,
    description,
    ageGroup,
    date: addDays(today, index < 3 ? -2 : -9),
  }))
}
