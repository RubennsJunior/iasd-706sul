# Gestão — IASD 706 Sul

Sistema de gestão para igreja local — membros, usuários, equipes e ministérios, eventos, escalas, cultos,
liturgia e controle de acesso. Um único código gera três formatos:

| Formato | Como |
| --- | --- |
| **Web** | Navegador no computador, com menu lateral, tabelas e painel de indicadores |
| **PWA** | Mesmo site, instalável (Android, iOS, computador) e com abertura offline |
| **APK** | Empacotado com Capacitor, usando a mesma interface mobile (barra inferior) |

> **Etapa atual: dados no Firebase (Firestore), ainda com dados fictícios.** Os cadastros são sincronizados entre
> aparelhos; se a nuvem não puder ser acessada, o sistema cai sozinho para o `localStorage` e avisa na tela
> (veja [Firebase](#firebase)). Os nomes e dados são inventados; o nome exibido (provisório: **IASD 706 Sul**) fica em
> `src/config.ts`; o logotipo é uma marca simplificada — troque pelo oficial em
> `src/components/ui/Logo.tsx` e `public/icons/icon.svg` (depois rode `npm run icons`).

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes da camada de dados, regras e utilitários
npm run build      # gera dist/ (com service worker)
npm run preview    # serve o build em http://localhost:4173 (necessário para testar o PWA)
```

### Contas de demonstração

Todas com a senha `123456` (a tela de login lista os perfis com entrada em um toque):

| Perfil | E-mail |
| --- | --- |
| Administrador Geral | `ana.paula@igreja.demo` |
| Pastor | `pastor@igreja.demo` |
| Secretaria | `secretaria@igreja.demo` |
| Líder de Departamento | `lider.depto@igreja.demo` |
| Líder de Equipe | `lider.equipe@igreja.demo` |
| Membro | `membro@igreja.demo` |

No avatar (canto superior) há **"Testar outro perfil"** para trocar de usuário sem senha e ver como cada
perfil enxerga o sistema. Em **Configurações do Aplicativo** é possível exportar/importar backup e restaurar os
dados fictícios. Para esconder a lista de contas e o "Testar outro perfil" (antes de usar dados reais), publique com
`VITE_DEMO_MODE=false`.

## O que existe

- **Entrada (sem login)** — a tela inicial (`/login`) oferece **Entrar como visitante**, **Fazer meu cadastro** e
  **Tem login?** (abre `/entrar`). O visitante vê só os eventos (datas) e as escalas das equipes, com busca pelo
  próprio nome. O cadastro público cria uma **solicitação de membro** (não um usuário), com escolha das equipes de
  interesse; a secretaria e a liderança analisam em **Cadastros → Solicitações de Cadastro**: aprovar cria o
  membro e o coloca nas equipes confirmadas, recusar exige o motivo. Pedidos novos geram notificação e aviso no Início.
- **Início** — indicadores, próximo evento, minha semana, ações rápidas, minha próxima escala (com confirmação),
  próximos cultos, escalas da igreja e atividades recentes.
- **Eventos** — filtros (todos, próximos, este mês, realizados, cancelados), busca, cadastro/edição/exclusão,
  detalhes com participantes e escalas vinculadas.
- **Equipes** — lista, "minhas equipes", liderança, detalhes com integrantes (adicionar/remover) e próximas escalas.
- **Liturgia** — leitura do dia, calendário de leituras, hinário e favoritos, orações e pedidos de oração,
  mensagens e reflexões, Escola Sabatina e programação dos cultos.
- **Cadastro e edição em telas próprias** — todo "Novo"/"Editar" abre uma tela separada da consulta, com endereço
  próprio (`/usuarios/novo`, `/usuarios/:id/editar`, `/eventos/:id/editar`…). A consulta continua com a opção
  Visualizar (janela de detalhes). Os cadastros genéricos usam `CrudPage` + `FormPage`.
- **Cadastro de usuário** — tela com abas **Dados** (informações pessoais e acesso) e **Permissão** (perfil de acesso e,
  opcionalmente, permissões personalizadas módulo a módulo para aquele usuário). Clicar numa linha ou card da lista
  abre a edição direto, sem janela de prévia. O membro do usuário (para "minhas escalas" e "minhas equipes") é
  reconhecido sozinho pelo e-mail ou pelo nome.
- **Menu administrativo** — Cadastros (membros, usuários, equipes, líderes, cargos, departamentos),
  Gerenciamento (eventos, **escalas**, cultos e programações, liturgias, participantes),
  Administração (perfis, permissões, notificações, relatórios) e Configurações.
- **Escalas** — montagem por equipe, vínculo opcional a evento/culto, aviso de **conflito de horário**,
  confirmação/recusa pelo próprio integrante e acompanhamento da liderança.
- **Perfis e permissões** — seis perfis iniciais; cada um com matriz módulo × (visualizar, cadastrar, editar,
  excluir, gerenciar), editável pelo administrador. Menus, botões e rotas respeitam as permissões.

## Arquitetura

```
src/
  models/         tipos do domínio e matriz de permissões
  data/seed/      dados fictícios (nunca dentro das telas)
  repositories/   acesso aos dados: interface Repository<T> + implementações Firestore e localStorage
  lib/            Firebase (configuração, Analytics) e estado da sincronização
  services/       regras de negócio (cascatas, conflitos, líderes, relatórios) — independentes da interface
  hooks/          useCollection e atalhos reativos por entidade
  contexts/       autenticação, avisos (toast) e confirmação
  components/     ui/ (botões, cartões, modais), forms/ (motor de formulários), crud/ (CrudPage), ...
  layouts/        MobileShell (barra inferior) e DesktopShell (menu lateral)
  pages/          telas, agrupadas por área
  routes/         rotas, guardas de permissão e navegação
pwa/              modelo do service worker (preenchido no build)
scripts/          geração dos ícones
```

**Fluxo de dados:** tela → serviço (regras) → repositório (armazenamento). As telas leem pelos hooks
(`useMembers`, `useEvents`…) e se atualizam sozinhas quando qualquer outra tela altera os dados.

## Firebase

Os dados ficam no **Firestore** do projeto `erp-igrejaadventista`, em `igrejas/iasd-706-sul/<coleção>/<id>`
(a configuração está em `src/lib/firebase.ts`; cada valor pode ser trocado por `VITE_FIREBASE_*`, veja `.env.example`).

- **Tempo real:** o que uma pessoa cadastra aparece nos outros aparelhos sem recarregar.
- **Offline:** o Firestore guarda um cache no aparelho; sem internet o sistema continua abrindo e as alterações
  são enviadas quando a conexão volta.
- **Primeira execução:** se a igreja ainda não tem dados na nuvem, o sistema grava os dados fictícios (uma única vez).
  Em *Configurações do Aplicativo* dá para restaurá-los, importar ou exportar um backup (exige conexão).
- **Senhas:** na nuvem são gravadas como resumo PBKDF2-SHA256 com sal, nunca em texto aberto.
- **Analytics:** ligado só no site publicado (não no desenvolvimento nem no APK).
- **Modo local automático:** se o Firestore recusar o acesso (regras), o banco não existir ou a nuvem não responder em
  10 segundos, a coleção passa a usar o `localStorage` e aparece um aviso vermelho "Modo local".
  `VITE_DATA_BACKEND=local` força esse modo.

### Publicar as regras de segurança (obrigatório para a nuvem funcionar)

Um projeto novo do Firestore bloqueia todo acesso. Publique o arquivo [`firestore.rules`](firestore.rules):

- pelo console: *Firebase → Firestore Database → Regras* → cole o conteúdo → **Publicar**; ou
- pela linha de comando: `npx firebase-tools login` e depois `npx firebase-tools deploy --only firestore:rules`.

> **Segurança.** O login do sistema é próprio (guardado na coleção `users`), então o Firestore não sabe quem está
> acessando e as regras liberam as coleções da igreja para quem conhecer o endereço do sistema. Isso serve para a fase
> de avaliação com dados fictícios. **Antes de cadastrar membros reais**: publique com `VITE_DEMO_MODE=false`, troque as
> senhas das contas de demonstração e migre o login para o Firebase Authentication com regras por perfil.

### Trocar a origem dos dados

`src/repositories/index.ts` é o **único** lugar que escolhe a origem (`createFirestoreRepository` ou
`createLocalRepository`). Para outro banco/API, implemente `Repository<T>` (`src/repositories/repository.ts`) e troque a
fábrica; serviços e telas não mudam.

Regras que hoje vivem nos serviços e precisarão ser garantidas também no servidor: exclusão em cascata de
membros, sincronização líder ↔ equipe/departamento, detecção de conflito de escalas, proteção do último
administrador. As permissões hoje escondem telas e botões; a validação no servidor virá com o Firebase Authentication.

## Publicar na Vercel

O repositório já traz `vercel.json` (SPA, cabeçalhos do service worker e cache dos arquivos). Na Vercel:
**Add New → Project → importe o repositório** (framework Vite, build `npm run build`, saída `dist`). As variáveis do
`.env.example` são opcionais. Depois do primeiro deploy, publique as regras do Firestore (seção acima).

## PWA

- `public/manifest.webmanifest`, ícones em `public/icons/` (gerados por `npm run icons`).
- `pwa/sw.template.js` vira `dist/sw.js` no build, com a lista de todos os arquivos (pré-cache).
  Navegação usa rede primeiro e cai para o app em cache quando offline.
- O service worker só é registrado no build de produção (`npm run preview` ou site publicado em https).
- Instalação: **Menu → Sobre o Aplicativo → Instalar aplicativo** (no iPhone: Compartilhar → Adicionar à Tela de Início).

## APK (Android)

O projeto Android já foi gerado em `android/` (Capacitor), com ícone e tela de abertura nas cores da igreja. O botão
Voltar do Android fecha janelas e listas abertas, volta uma tela e só sai do app na tela inicial
(`src/components/NativeBackButton.tsx`, plugin `@capacitor/app`).

```bash
npm run cap:sync    # build + copia o site para o projeto Android
npm run cap:open    # abre no Android Studio (Build > Build APK)
# ou, pela linha de comando, com JDK 21 e Android SDK instalados
# (defina JAVA_HOME e ANDROID_HOME, ou crie android/local.properties com sdk.dir=...):
npm run android:apk # gera android/app/build/outputs/apk/debug/app-debug.apk
```

Antes de publicar: troque `appId` em `capacitor.config.ts` e assine o APK/AAB com sua chave. Para regerar
ícone e splash depois de trocar o logotipo: `npm run icons` e `npx @capacitor/assets generate --android`.

## Limitações conhecidas desta etapa

- Sem as regras publicadas (ou sem rede na primeira abertura) os dados ficam só no aparelho, no modo local.
- Login e permissões ainda são do próprio sistema, sem Firebase Authentication: as regras do Firestore não distinguem
  usuários (veja o aviso de segurança acima). As telas do visitante e o cadastro público leem e gravam nas mesmas
  coleções; com regras por perfil, essas rotas precisarão de regras públicas próprias (com limite de envios) e o
  visitante não deve receber nomes de integrantes sem regra definida pela igreja.
- Os campos de data e hora (`<input type="date">`) abrem o seletor do próprio navegador/Android, que não aceita estilo.
- Permissões valem por módulo; ainda não há restrição por equipe ou departamento do líder.
- Conflito de escala compara dia e horário de início iguais (não há duração).
- Hinos e leituras são exemplos curtos; insira conteúdo com direitos de uso adequados.
