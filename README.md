# InvestIA Advisor Pro

> Plataforma web de análise de carteira de investimentos da B3 com IA (Gemini 2.5 + Google Search), cotações em tempo real e visualizações ricas.

🌐 **Produção:** [invent-ia.vercel.app](https://invent-ia.vercel.app)

---

## 📋 Sumário

- [O que é](#-o-que-é)
- [Funcionalidades](#-funcionalidades)
- [Stack tecnológica](#-stack-tecnológica)
- [Arquitetura](#-arquitetura)
- [Setup local](#-setup-local)
- [Deploy](#-deploy)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [Testes](#-testes)
- [Atalhos de teclado](#-atalhos-de-teclado)
- [Roadmap](#-roadmap)
- [Decisões de design](#-decisões-de-design)

---

## 🎯 O que é

InvestIA Advisor Pro é um assistente pessoal de investimentos para a B3 (bolsa brasileira). Ele combina:

- **Análise de carteira por IA** — recomendações personalizadas baseadas em perfil (conservador/moderado/arrojado) e foco (ações/FIIs/misto), com cotações reais buscadas via Google Search.
- **Cotações em tempo real** — atualização automática a cada 60 segundos via API gratuita brapi.dev (sem rodar IA).
- **Visualizações ricas** — alocação, setores, canal de 52 semanas, performance vs PM, projeção sazonal de dividendos, radar de saúde.
- **Gestão completa** — histórico de compras, proventos recebidos, watchlist com preço-alvo, calculadora de IR, simulador "1º milhão".

O app é otimizado para o investidor pessoa física brasileira que quer um overview profissional sem precisar montar planilhas.

---

## ✨ Funcionalidades

### 🧠 Inteligência

- **Análise IA da carteira completa** com diagnóstico textual, score de saúde, recomendações de aporte distribuídas por ativo, e visualizações da carteira em seção expansível.
- **Análise individual de ticker** com tese (comprar/aguardar/evitar), preço-alvo 12 meses, indicadores fundamentalistas e ativos comparáveis sugeridos.
- **Comparador de até 4 ativos** lado a lado com pontos fortes, riscos e veredicto.
- **Buscador de oportunidades** por critério: ações sub-precificadas, FIIs com alto DY, empresas em crescimento, blue chips em desconto, pagadoras consistentes.
- **Universo customizável** — usuário define quais tickers a IA deve considerar nas análises.

### 💰 Gestão de carteira

- **Múltiplos ativos** com PM, quantidade, peso-alvo.
- **Histórico de compras** com data e preço.
- **Importação/exportação CSV** para migração.
- **Proventos** registrados manualmente com gráfico mensal e ranking de top pagadores.
- **Watchlist** com preço-alvo e alerta visual quando atingido.
- **Snapshots de patrimônio** salvos automaticamente após cada análise (gráfico de evolução vs CDI).

### 📊 Visualizações (dentro de Análise IA, seção colapsável)

- Alocação por ativo (pizza)
- Concentração setorial (pizza, com normalização inteligente de aliases)
- Canal de 52 semanas (barras horizontais com legenda Oportunidade/Neutro/Caro)
- Performance vs preço médio (barras divergentes verde/vermelho)
- Projeção de dividendos 12 meses (área com sazonalidade real B3)
- Radar de saúde (Diversif./Dividendos/Valor/Liquidez/Renda)

### 🛠️ Calculadoras

- **IR sobre vendas** com isenção de R$20k/mês para ações.
- **Simulador 1º Milhão** com juros compostos + aportes mensais.
- **Cenários** de retorno futuro variando taxa e prazo.

### 🎨 Experiência

- **Tema claro/escuro** com persistência em localStorage. Claro é o padrão.
- **Modo privacidade** — oculta valores monetários (●●●●) para mostrar a tela em público.
- **Cotações ao vivo** no card de cada ativo, com badge "AO VIVO" e variação do dia.
- **Toast com Desfazer** ao deletar ativo/provento/watchlist (6s para reverter).
- **Paleta de comandos** estilo Linear/Notion com Ctrl+K.
- **Atalhos de teclado** estilo Vim para navegação rápida (g + tecla).
- **PWA** — instalável como app no desktop e mobile.

---

## 🧰 Stack tecnológica

### Frontend
- **React 18** + **Vite 5** — SPA leve, build rápido.
- **Recharts** — gráficos (pizza, barras, área, radar).
- **Lucide React** — ícones.
- **CSS Variables** com data-theme — tema claro/escuro nativo.
- **PWA** — manifest + service worker para instalação.

### Backend
- **Vercel Serverless Functions** (Node runtime, maxDuration 60s) — proxy para Gemini API.
- **Supabase** — auth + banco PostgreSQL para carteira, watchlist, proventos, snapshots, análises salvas, universo.

### IA & dados
- **Gemini 2.5 Flash** + **Google Search grounding** — análises com contexto atualizado da web. Fallback automático para `gemini-2.0-flash` se 2.5 falhar.
- **brapi.dev** — API REST gratuita para cotações em tempo real da B3.

### Ferramentas de teste
- **Vitest** — testes unitários (68 passando).
- **Testing Library** — componentes.
- **Playwright** — testes E2E.
- **Smoke tests** customizados em Node puro.

---

## 🏗️ Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │  App.jsx · 13 abas · estado local + Supabase auth  │  │
│  │   ↓                              ↓                  │  │
│  │   useCotacoes() ──────────→ brapi.dev (60s)        │  │
│  │   chamarIAComSearch() ────→ /api/analyze            │  │
│  │   supabase client ────────→ PostgreSQL              │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
        ↓ HTTPS                           ↓ HTTPS
┌─────────────────────┐         ┌──────────────────────────┐
│ Vercel Serverless   │         │  Supabase (managed)      │
│  /api/analyze.js    │         │   - Auth (JWT)           │
│   ↓                 │         │   - PostgreSQL           │
│   Gemini API        │         │   - Row-Level Security   │
│   + Google Search   │         └──────────────────────────┘
└─────────────────────┘
        ↓
┌─────────────────────┐
│ Google AI Platform  │
│  gemini-2.5-flash   │
│  + grounding        │
└─────────────────────┘
```

### Fluxo de uma análise IA

1. Usuário clica "Analisar carteira" na aba Análise IA.
2. Frontend monta prompt com carteira + perfil + foco + universo + aporte.
3. POST para `/api/analyze` com prompt e flag `useSearch=true`.
4. Vercel Function chama Gemini com Google Search habilitado.
5. Gemini retorna JSON estruturado (resumo, recomendações, alocações).
6. Frontend usa `extrairJSON()` (resiliente a smart quotes, trailing commas, zero-width chars) para parsear.
7. Resultado é renderizado + salvo no Supabase + snapshot de patrimônio é gravado.

### Schema do banco (Supabase)

```sql
profiles            -- usuário (auto via auth)
carteiras           -- 1 por usuário (multi-carteira não implementado)
ativos              -- ticker, qtd, pm, peso_alvo, carteira_id
compras             -- ticker, qtd, preco, data (histórico imutável)
watchlist           -- ticker, preço-alvo, nota
proventos           -- ticker, tipo, valor, data, observação
analises_salvas    -- snapshot completo de cada análise IA
patrimonio_snapshots -- valor total + posições (gráfico de evolução)
universos_usuario   -- tickers customizados que IA deve considerar
```

Todas as tabelas com **RLS ativo** (row-level security) — usuário só vê seus próprios dados.

---

## 🚀 Setup local

### Pré-requisitos

- **Node.js 18+**
- **npm** (vem com Node)
- Conta na **Vercel** (para functions) ou rodar `vercel dev`
- Conta no **Supabase** com projeto criado

### 1. Clone e instale

```bash
git clone https://github.com/hemoreira89/InventIA.git
cd InventIA
npm install
```

### 2. Configure variáveis de ambiente

Crie `.env.local` na raiz:

```env
# Para a função serverless (analise IA)
GEMINI_API_KEY=sua_chave_aqui
```

Pegue sua chave gratuita em [Google AI Studio](https://aistudio.google.com/apikey).

### 3. Configure Supabase

A URL e anon key estão em `src/supabase.js`. Para usar seu próprio projeto:

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Atualize `supabaseUrl` e `supabaseAnonKey` em `src/supabase.js`.
3. Rode os SQLs em `sql/` para criar as tabelas.
4. Configure RLS nas tabelas (políticas para `auth.uid() = user_id`).

### 4. Rode em modo dev

```bash
# Frontend (Vite, hot reload)
npm run dev

# Frontend + serverless (Vercel CLI - precisa: npm i -g vercel)
vercel dev
```

Acesse `http://localhost:5173` (vite) ou `http://localhost:3000` (vercel dev).

### 5. (Opcional) Seed de dados de teste

```bash
npm run seed
```

Cria conta `e2e-test@inventia.app` (senha `TesteE2E_2026!`) com 11 ativos pré-populados.

---

## 🌐 Deploy

### Vercel (recomendado)

1. Faça push para o GitHub.
2. Importe o repositório em [vercel.com](https://vercel.com/new).
3. Adicione a variável de ambiente:
   - `GEMINI_API_KEY=sua_chave`
4. Deploy automático em cada push para `main`.

### Configurações importantes

- O `vercel.json` define `maxDuration: 60` para `/api/analyze.js` (limite do plano Hobby).
- Build command: `npm run build` (gera `dist/`).
- Framework preset: Vite.

### Outros provedores

Funciona em qualquer provedor que suporte:
- Build estático Vite
- Serverless Functions Node.js (60s timeout)

Netlify, Cloudflare Pages, AWS Amplify funcionam com pequenos ajustes.

---

## 📁 Estrutura do projeto

```
InventIA/
├── api/
│   └── analyze.js          # Serverless: proxy Gemini + Google Search
├── public/
│   ├── icons/              # PWA icons
│   └── manifest.json
├── scripts/
│   └── seed-test-user.js   # Cria conta de teste com carteira
├── sql/
│   └── 03_universo_usuario.sql  # Migration mais recente
├── src/
│   ├── App.jsx             # Componente principal (~3600 linhas, 13 abas)
│   ├── Login.jsx           # Tela de auth
│   ├── main.jsx            # Bootstrap + loading screen theme-aware
│   ├── supabase.js         # Cliente + helpers de DB
│   ├── components/
│   │   ├── CommandPalette.jsx     # Ctrl+K paleta de comandos
│   │   ├── EmptyState.jsx
│   │   ├── LoadingSteps.jsx
│   │   ├── OnboardingHero.jsx     # Tela inicial sem carteira
│   │   ├── PrivacyMode.jsx        # Toggle ●●●● values
│   │   ├── Sparkline.jsx          # Mini gráfico do header
│   │   ├── TabUniverso.jsx        # Configuração de tickers
│   │   └── ThemeToggle.jsx        # Light/dark + CSS vars
│   ├── hooks/
│   │   └── useCotacoes.js         # Auto-refresh 60s via brapi
│   └── lib/
│       ├── calc.js                # Funções financeiras + extrairJSON
│       ├── catalogoB3.js          # ~150 tickers categorizados
│       └── cotacoes.js            # Integração brapi.dev + cache
├── tests/
│   ├── unit/                # 68 testes unitários (Vitest)
│   ├── e2e/                 # Playwright
│   └── smoke/               # Smoke tests Node puro
├── package.json
├── vercel.json
└── vite.config.js
```

---

## 🧪 Testes

### Unitários (Vitest)

```bash
npm test                # Roda 68 testes uma vez
npm run test:watch      # Modo watch
npm run test:ui         # UI gráfica
npm run test:coverage   # Coverage report
```

Cobertura principal:
- `calc.js` — fmt, fmtBRL, fmtK, juros compostos, projeções (16 testes)
- `extrairJSON.js` — parser resiliente (smart quotes, trailing commas, zero-width chars)
- `format.js` — utilitários de formatação
- `validacao.js` — sanitização de inputs

### E2E (Playwright)

```bash
npm run test:e2e        # Headless
npm run test:e2e:ui     # Modo interativo
```

Cenários:
- Login e logout
- Adicionar/remover ativo
- Rodar análise completa
- Navegar pelas 13 abas

### Smoke (Node puro, sem framework)

```bash
npm run test:smoke      # Verifica build + endpoints
npm run test:all        # Unit + smoke
```

---

## ⌨️ Atalhos de teclado

### Globais

| Atalho | Ação |
|---|---|
| `⌘K` / `Ctrl+K` | Abrir paleta de comandos |
| `/` | Alternativa para paleta |
| `?` | Mostrar/ocultar painel de atalhos |
| `Esc` | Fechar modais e paleta |

### Navegação rápida (estilo Vim)

Pressione `g` seguido da tecla:

| Tecla | Aba |
|---|---|
| `g c` | Carteira |
| `g p` | Patrimônio |
| `g a` | Análise IA |
| `g t` | Analisar Ticker |
| `g o` | Oportunidades |
| `g h` | Histórico |
| `g d` | Proventos (Dividendos) |
| `g w` | Watchlist |
| `g u` | Universo |
| `g m` | 1º Milhão |
| `g i` | Calculadora IR |
| `g x` | Cenários |

### Paleta de comandos (Ctrl+K)

- Digite parte do nome de qualquer aba para navegar.
- Digite um ticker (ex: `PETR4`) para abrir direto a análise individual.
- Setas ↑/↓ para navegar, Enter para confirmar.

---

## 🗺️ Roadmap

### ✅ Implementado
- [x] Tema claro/escuro com paleta semântica refinada
- [x] Cotações em tempo real (brapi.dev) com cache 1min e auto-refresh 60s
- [x] Toast com Desfazer (6s) substituindo modais de confirmação
- [x] Paleta de comandos (Ctrl+K)
- [x] Atalhos de teclado estilo Vim (g + tecla)
- [x] Modal de ajuda (?)
- [x] PWA (instalável)
- [x] Modo privacidade (oculta valores)
- [x] Visualizações da carteira em seção colapsável
- [x] Normalização inteligente de setores (aliases para evitar duplicatas)
- [x] Snapshots automáticos de patrimônio
- [x] Universo customizável de tickers
- [x] Análise IA, individual, comparador, oportunidades

### 🚧 Backlog
- [x] **Múltiplas carteiras** — separar "Aposentadoria", "Trade", "Cripto" ✅
- [x] **Análise de risco real** — HHI, concentração de ativos/setores, score de saúde ✅
- [x] **Dashboard de renda passiva projetada** — "Em 5/10/20 anos com aporte X você terá Y/mês" ✅
- [x] **Auto-completar ticker** — sugestões enquanto digita (1430+ ativos B3) ✅
- [x] **Comparar carteira atual vs ideal** — tabela com delta e ações de rebalanceamento ✅
- [ ] **Notificações push** — preço-alvo atingido, dividendo recebido (requer service worker + servidor)
- [ ] **Sidebar** ao invés de tabs (telas grandes)

### ❌ Avaliado e descartado
- **Integração direta com B3 (Área do Investidor API)** — requer contrato comercial, tarifa por consulta, compliance LGPD/regulatório. Inviável para projeto pessoal.
- **Open Finance (Pluggy/Belvo)** — exige cadastro como ITP/PISP ou pagar por conexão. Não compensa para uso pessoal.

---

## 🎨 Decisões de design

### Por que tudo em um App.jsx gigante?

O `App.jsx` tem ~3600 linhas. Isso é proposital:

- **Contexto compartilhado** entre tabs (carteira, perfil, aporte, dados da análise) sem prop drilling ou Context excessivo.
- **Refactor incremental** funciona bem: extraí `TabUniverso`, `CommandPalette`, `OnboardingHero`, `Sparkline` quando ficaram autônomos.
- **Single source of truth** para estado da carteira evita bugs de sincronização.
- Para um projeto pessoal de 1 dev, é mais produtivo do que 30 arquivos pequenos.

### Por que CSS Variables ao invés de Tailwind/styled-components?

- **Tema dinâmico nativo** — `[data-theme="light"]` vs `[data-theme="dark"]` muda tudo via cascata.
- **Zero runtime overhead** — sem CSS-in-JS.
- **Inspecionável** — abre devtools e vê os valores atuais.

### Por que aliases manuais para setores?

A IA retorna setores em formatos imprevisíveis ("Bancos", "Financeiro", "Bancário", "Petróleo e Gás", "Petróleo & Gás", "Petróleo, Gás e Biocombustíveis"). Sem normalização, o gráfico de Setores mostra duplicatas.

A solução tem 3 camadas:
1. Tabela de aliases case-insensitive (~50 entradas).
2. Heurística por palavra-chave (regex) para variações.
3. Catálogo curado (`getSetorPorTicker`) como fallback final.

### Por que projeção de dividendos sazonal?

Distribuir o DY anual igualmente nos 12 meses gera linha reta no gráfico = inútil. A realidade da B3:

- **FIIs** pagam todo mês (distribuição uniforme).
- **Ações** concentram em mar/mai/ago/nov (após assembleias trimestrais).

A função `projetarDividendos()` aplica pesos sazonais aproximados:
```js
const sazonalidadeAcoes = [0.3, 0.5, 1.8, 0.8, 1.6, 0.7, 0.4, 1.5, 0.6, 0.7, 1.7, 1.4];
```

Resultado: gráfico ondulado mostrando concentração real.

### Por que cotações via brapi e não Yahoo Finance?

- **brapi.dev** é brasileiro, focado em B3, sem rate limit no plano free para uso pessoal.
- **Yahoo Finance** quebra com tickers brasileiros (precisa sufixo `.SA`), tem rate limit agressivo, e quebra com frequência sem aviso.

### Por que Toast com Desfazer ao invés de modal "tem certeza?"

- Modal interrompe o fluxo e força decisão imediata.
- Toast com Desfazer (padrão Gmail/Linear) **assume confiança no usuário** — ele acabou de decidir, não precisa confirmar.
- Se errou, tem 6 segundos para reverter sem perder dados.
- UX significativamente melhor para ações repetitivas (deletar vários ativos).

---

## 🔒 Segurança

- **Auth via Supabase JWT** — tokens rotacionáveis, persistidos com httpOnly cookies via SDK.
- **Row-Level Security** ativo em todas as tabelas — usuário só lê/escreve seus próprios dados.
- **GEMINI_API_KEY nunca exposta no frontend** — sempre via `/api/analyze` (serverless).
- **HTTPS obrigatório** em produção.
- **Modo privacidade** para mostrar tela em público sem expor patrimônio.

⚠️ **Importante:** este é um projeto pessoal sem auditoria de segurança formal. Não armazena dados financeiros sensíveis (CPF, contas bancárias). Apenas tickers e quantidades inseridas pelo usuário.

---

## 📜 Licença

Projeto pessoal de [Henrique Moreira](https://github.com/hemoreira89). Código aberto para fins educacionais.

**Não constitui recomendação financeira profissional.** As análises são geradas por IA com fins informativos. Sempre confirme preços e dados na sua corretora antes de operar.

---

## 🤝 Contribuindo

Este é um projeto pessoal, mas sugestões via Issues são bem-vindas. Pull Requests serão avaliados caso a caso.

Para reportar bugs, abra uma Issue com:
- Passos para reproduzir
- Comportamento esperado vs observado
- Screenshots se UI
- Console do navegador se erro JS

---

**Construído com IA + cafeína por [@hemoreira89](https://github.com/hemoreira89) durante a transição de carreira para AIOps/Observability.**
