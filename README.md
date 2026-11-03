# Gestão — IASD 706 Sul

Sistema de gestão para igreja local — membros, usuários, equipes e ministérios, eventos, escalas, cultos,
liturgia e controle de acesso. Um único código gera três formatos:

| Formato | Como |
| --- | --- |
| **Web** | Navegador no computador, com menu lateral, tabelas e painel de indicadores |
| **PWA** | Mesmo site, instalável (Android, iOS, computador) e com abertura offline |
| **APK** | Empacotado com Capacitor, usando a mesma interface mobile (barra inferior) |

> **Etapa atual: nuvem com login (Firebase), ainda com dados fictícios.** O acesso é pelo Firebase Authentication
> (e-mail e senha) e os cadastros ficam no Firestore, sincronizados entre aparelhos; se a nuvem não puder ser acessada,
> o sistema cai sozinho para o `localStorage` e avisa na tela (veja [Firebase](#firebase)). Os nomes e dados são inventados; o nome exibido (provisório: **IASD 706 Sul**) fica em
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

**Só no modo local** (`VITE_DATA_BACKEND=local`, nos testes automatizados). Com a nuvem ligada o acesso é pelo Firebase
Authentication e estas contas não existem. Todas com a senha `123456` (a tela de login lista os perfis com entrada em um toque):

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
  próprio nome. O cadastro público cria uma **solicitação de membro** (não um usuário), com **e-mail obrigatório** e
  escolha das equipes de interesse; a secretaria e a liderança analisam em **Cadastros → Solicitações de Cadastro**:
  aprovar cria o membro e o coloca nas equipes confirmadas, recusar exige o motivo. Pedidos novos geram notificação e
  aviso no Início.
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
  abre a edição direto, sem janela de prévia. No cadastro novo, **"Aproveitar cadastro de membro"** preenche os dados a
  partir de um membro que ainda não tem usuário. Todo usuário criado manualmente também ganha (ou é vinculado a) um
  cadastro de membro, usado em "minhas escalas" e "minhas equipes".
- **Menu administrativo** — Cadastros (membros, usuários, equipes, líderes, cargos, departamentos, patrimônio),
  Gerenciamento (eventos, **escalas**, cultos e programações, liturgias, participantes),
  Administração (perfis, permissões, notificações, relatórios) e Configurações.
- **Escalas** — montagem por equipe, vínculo opcional a evento/culto, aviso de **conflito de horário**,
  confirmação/recusa pelo próprio integrante e acompanhamento da liderança.
- **Perfis e permissões** — seis perfis iniciais; cada um com matriz módulo × (visualizar, cadastrar, editar,
  excluir, gerenciar), editável pelo administrador. Menus, botões e rotas respeitam as permissões.
- **Abrangência do perfil** — além de *o que* o perfil pode fazer, cada perfil define *em quais dados* vale:
  **toda a igreja** (padrão), **só o(s) departamento(s) do usuário** ou **só a(s) equipe(s) do usuário**. É aqui que
  **Departamentos, Equipes, Cargos e Funções e Líderes** passam a valer para o acesso: a pessoa (pelo membro vinculado ao
  usuário) pertence às equipes em que é líder ou integrante e aos departamentos que lidera (e aos das suas equipes).
  Opcionalmente o perfil escolhe **quais cargos e funções contam** (ex.: só "Líder" e "Coordenador"); vazio vale
  qualquer ligação. A abrangência filtra Equipes, Escalas, Líderes, Departamentos e os totais da Home/Relatórios, e as
  gravações desses módulos são recusadas fora dela. O Administrador Geral nunca é limitado. Os perfis *Líder de
  Departamento* e *Líder de Equipe* dos dados de exemplo já vêm limitados; perfis já gravados continuam em "toda a
  igreja" até alguém configurar a abrangência em **Perfis de Acesso**. A tela **Cargos e Funções** mostra em quais
  perfis cada cargo define o acesso.

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
- **Primeira execução:** se a igreja ainda não tem dados na nuvem, o sistema cria só o necessário para funcionar
  (perfis de acesso, identidade e configurações da igreja). Membros, equipes, agenda e liturgia começam vazios: a
  igreja cadastra os dados reais, sem exemplos fictícios. Em *Configurações do Aplicativo* dá para importar/exportar
  um backup ou **limpar todos os dados** (mantém usuários, perfis e configurações; exige conexão).
- **Login:** Firebase Authentication (e-mail e senha). As senhas ficam no Firebase, nunca no Firestore. O perfil de cada
  pessoa é o documento `users/<uid>` (perfil de acesso, situação e permissões personalizadas); a sessão continua
  guardada no aparelho, inclusive sem internet. Cada pessoa troca a própria senha em *Minha conta* e, para as outras,
  o administrador envia o e-mail de nova senha (a senha de outra pessoa não pode ser trocada pelo navegador).
- **Primeiro administrador:** a conta `admin@admin.com` (criada no Firebase Authentication) ganha o perfil de
  administrador ao entrar pela primeira vez; ao entrar, o administrador também cria o que o sistema precisa (se a
  igreja ainda não tem nada) e acerta o diretório público de nomes. As contas de demonstração antigas (`@igreja.demo`) não
  funcionam na nuvem: exclua-as em *Usuários*. **Troque a senha da conta de administrador** em *Minha conta*. Para
  usar outro e-mail, mude-o em `firestore.rules` e em `VITE_ADMIN_EMAIL`.
- **Diretório de nomes:** a coleção `directory` guarda só o nome de cada membro (mesmo código). É o que o visitante e os
  perfis sem acesso a *Membros* usam para ver quem está nas escalas, sem expor telefone, e-mail ou endereço.
- **Analytics:** ligado só no site publicado (não no desenvolvimento nem no APK).
- **Modo local automático:** se o Firestore recusar o acesso (regras), o banco não existir ou a nuvem não responder em
  10 segundos, a coleção passa a usar o `localStorage` e aparece um aviso vermelho "Modo local".
  `VITE_DATA_BACKEND=local` força esse modo.

### Regras de segurança (publique para valerem)

O arquivo [`firestore.rules`](firestore.rules) só libera o que o perfil de quem está logado permite: o visitante lê eventos,
escalas, equipes e nomes (e só envia pedidos de cadastro); cada pessoa logada precisa de um perfil `ativo` e as permissões
vêm da mesma matriz módulo × (ver, cadastrar, editar, excluir, gerenciar) da tela de Permissões; só o administrador cria
administradores e só quem tem *Permissões* mexe em permissões personalizadas. Publique-o:

- pelo console: *Firebase → Firestore Database → Regras* → cole o conteúdo → **Publicar**; ou
- pela linha de comando: `npx firebase-tools login` e depois `npx firebase-tools deploy --only firestore:rules`.

Enquanto as regras antigas (abertas) seguirem publicadas, o sistema funciona, mas **qualquer pessoa que conheça o endereço
lê e grava os dados**. Depois de publicar as novas regras, quem não tem acesso a uma coleção vê a lista vazia e o servidor
recusa gravações sem permissão (a tela avisa).

**Testes das regras** (emulador do Firestore, precisa de Java 21): `cd tests/rules && npm install && npm test` — 52 testes
cobrem visitante, Membro, Líder de Equipe, Secretaria, Administrador, usuário inativo, permissões personalizadas, o Patrimônio e o
primeiro acesso do administrador. Para abrir o app contra os emuladores (Firestore e Authentication) em vez do projeto real,
use `VITE_FIREBASE_EMULATOR=1` e `VITE_FIREBASE_PROJECT_ID=demo-igreja` (em `.env.local`) e `firebase emulators:start`.

> **Limite conhecido:** gravações que o app faz em coleções de outros módulos como efeito de uma ação permitida (por exemplo,
> aprovar um cadastro mexe em equipes) são liberadas por regras aproximadas, e um perfil com `escalas` pode alterar o campo
> de integrantes de qualquer escala. Para uma igreja pequena é um bom ponto de partida; regras mais finas (por equipe ou
> departamento) ficam para uma próxima etapa. A **abrangência do perfil** (departamento/equipe) é aplicada pelo aplicativo
> (telas e serviços), não pelas regras do Firestore: quem tem permissão no módulo e acessa o banco por fora do app ainda
> alcança dados de outras equipes.

### Trocar a origem dos dados

`src/repositories/index.ts` é o **único** lugar que escolhe a origem (`createFirestoreRepository` ou
`createLocalRepository`). Para outro banco/API, implemente `Repository<T>` (`src/repositories/repository.ts`) e troque a
fábrica; serviços e telas não mudam.

Regras que hoje vivem nos serviços e precisarão ser garantidas também no servidor: exclusão em cascata de
membros, sincronização líder ↔ equipe/departamento, detecção de conflito de escalas, proteção do último
administrador. As permissões escondem telas e botões e as regras do Firestore as aplicam no servidor (veja acima).

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
npm run build:apk               # APK de lançamento assinado: apk/iasd-<versão>.apk (ex.: apk/iasd-1.0.2.apk)
npm run build:apk -- --debug    # APK de teste (depurável): apk/iasd-<versão>-debug.apk
npm run cap:sync                # só build + copia o site para o projeto Android
npm run cap:open                # abre no Android Studio
```

O APK é gerado como no projeto ERP_Controle_Produção (`scripts/build-apk.mjs`): a **versão vem do `package.json`** (hoje
**1.0.2**; o `versionCode` é `major×10000 + minor×100 + patch`, então 1.0.1 vira 10001 e um APK mais novo sempre atualiza o
instalado). Sai um **único arquivo**, no padrão `iasd-<versão>.apk`. Em `apk/` fica só o da versão atual (os antigos
continuam no histórico do Git) e o de teste sai à parte, sem mexer no de lançamento. Para lançar uma versão nova, mude
`version` no `package.json` (e `APP_VERSION` em `src/config.ts`) e rode `npm run build:apk`.

Pré-requisitos: JDK 21 e Android SDK (o script usa `~/android-tools/jdk-21` e `~/android-tools/android-sdk` quando existem;
senão `JAVA_HOME` e `ANDROID_HOME`). A **assinatura** usa uma chave criada na primeira vez em `~/.techsoft/iasd706sul.keystore`
(com a senha em `iasd706sul.keystore.senha`), **fora do repositório**. **Guarde esses dois arquivos**: sem eles não é possível
atualizar o app já instalado. Instalar no aparelho: `adb install -r apk/iasd-<versão>.apk` (um app instalado com
outra assinatura, como o APK de teste, precisa ser desinstalado antes).

Antes de publicar em loja: troque `appId` em `capacitor.config.ts` (e `applicationId` em `android/app/build.gradle`) pelo
definitivo. Para regerar ícone e splash depois de trocar o logotipo: `npm run icons` e `npx @capacitor/assets generate --android`.

## Limitações conhecidas desta etapa

- Sem as regras publicadas (ou sem rede na primeira abertura) os dados ficam só no aparelho, no modo local.
- O cadastro público (visitante) aceita qualquer pedido que siga o formato; não há limite de envios (isso exigiria o App Check
  do Firebase). O visitante enxerga eventos, escalas, equipes e os **nomes** dos membros (diretório); nenhum outro dado pessoal.
- Excluir um usuário apaga o perfil dele (o acesso some), mas a conta continua no Firebase Authentication e o e-mail fica
  reservado: para reaproveitá-lo, apague a conta no console do Firebase (*Authentication → Usuários*). Prefira marcar como inativo.
- Os campos de data e hora (`<input type="date">`) abrem o seletor do próprio navegador/Android, que não aceita estilo.
- Permissões valem por módulo; ainda não há restrição por equipe ou departamento do líder.
- Conflito de escala compara dia e horário de início iguais (não há duração).
- Hinos e leituras são exemplos curtos; insira conteúdo com direitos de uso adequados.
