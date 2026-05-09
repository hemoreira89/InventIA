# CLAUDE.md — InventIA

Plataforma web de análise de carteira de investimentos da B3 com IA (Gemini 2.5 Flash), cotações em tempo real e visualizações ricas.

**Produção:** https://invent-ia.vercel.app  
**Rollback:** `git checkout backup/pre-pending-tasks-20260509`

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite 5 (SPA) |
| Backend | Vercel Serverless Functions (Node.js, 60s timeout) |
| Banco | Supabase (PostgreSQL + RLS) |
| IA | Gemini 2.5 Flash (`/api/analyze`) |
| Cotações | brapi.dev (real-time, free tier) |
| Screening | bolsai API (R$29/mês Pro) |
| Testes | Vitest (unit) + Playwright (E2E) |

---

## Comandos principais

```bash
npm run dev        # Dev server (Vite)
npm test           # Unit tests (Vitest, ~3s)
npm run build      # Build de produção
npm run preview    # Preview do build local
```

**Testes E2E (requer secrets):**
```bash
E2E_USER=... E2E_PASSWORD=... npx playwright test
```

---

## Arquitetura de arquivos

```
src/
├── App.jsx              # Componente raiz (estado global + todas as abas)
│                        # ~5000 linhas — intencional: estado compartilhado em 1 lugar
├── Login.jsx            # Auth (signup/signin Supabase)
├── supabase.js          # Cliente Supabase + helpers CRUD
├── components/
│   ├── CommandPalette.jsx   # Ctrl+K — busca/navegação
│   ├── EmptyState.jsx       # Tela vazia genérica
│   ├── LoadingSteps.jsx     # Animação de loading da IA
│   ├── OnboardingHero.jsx   # Tela boas-vindas (carteira vazia)
│   ├── PrivacyMode.jsx      # Oculta valores (modo privacidade)
│   ├── Sparkline.jsx        # Mini gráfico de linha
│   ├── TabUniverso.jsx      # Aba universo de tickers
│   ├── ThemeToggle.jsx      # Light/dark + CSS variables
│   └── TickerAutocomplete.jsx # Autocomplete de tickers (B3)
├── hooks/
│   └── useCotacoes.js       # Hook de cotações em tempo real (brapi, 60s)
└── lib/
    ├── calc.js              # Cálculos financeiros puros (testados)
    ├── catalogoB3.js        # Lista estática de ~350 tickers B3
    ├── catalogoScreening.js # Catálogo dinâmico do Supabase (~1430 tickers)
    ├── cotacoes.js          # Busca cotações via /api/cotacoes
    ├── criterios.js         # Avaliação de critérios de investimento (testada)
    ├── fundamentos.js       # Busca fundamentos via bolsai
    ├── fundamentosCached.js # Lê screening_fundamentos (cache semanal)
    ├── historico.js         # Histórico de preços
    ├── risco.js             # Análise de risco: HHI, concentração, score (testada)
    └── setorB3.js           # Normalização de setores B3 (testada)

api/                     # Vercel Serverless Functions
├── analyze.js           # Proxy Gemini 2.5 Flash
├── cotacoes.js          # Proxy brapi.dev
├── cron-fundamentos.js  # Cron semanal: cacheia fundamentos da bolsai
├── cron-screening.js    # Cron diário: atualiza catálogo de tickers
├── debug-screening.js   # Diagnóstico do screening
├── fundamentos.js       # Proxy bolsai
└── historico.js         # Proxy brapi histórico

sql/
├── 03_universo_usuario.sql   # Tabela universo_usuario
├── screening_catalogo.sql    # Tabela screening_catalogo
├── screening_fundamentos.sql # Tabela screening_fundamentos
└── migrations/               # Migrações incrementais

tests/
├── unit/                # Vitest — funções puras
└── e2e/                 # Playwright — fluxo completo

.github/workflows/
├── ci.yml               # CI: testes + build + smoke (push/PR/daily)
├── cron-fundamentos.yml # Cron semanal via GitHub Actions
└── seed.yml             # Seed de usuário de teste (dispatch manual)
```

---

## Banco de dados (Supabase)

Todas as tabelas têm RLS habilitado. Usuário só acessa os próprios dados.

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfil do usuário (criado via trigger na auth) |
| `carteiras` | Portfólios (1+ por usuário; `nome`, `user_id`) |
| `ativos` | Ativos da carteira (`ticker`, `qtd`, `pm`, `peso_alvo`, `carteira_id`) |
| `compras` | Histórico imutável de compras |
| `watchlist` | Tickers com preço-alvo e nota |
| `proventos` | Dividendos recebidos |
| `analises_salvas` | Snapshots das análises IA |
| `patrimonio_snapshots` | Evolução do patrimônio (gráfico) |
| `universos_usuario` | Universo customizável de tickers para a IA |
| `screening_catalogo` | ~1430 tickers B3 (atualizado diariamente) |
| `screening_fundamentos` | Fundamentos cacheados semanalmente (bolsai) |

---

## Abas do app

| Chave | Componente | Descrição |
|-------|-----------|-----------|
| `carteira` | TabCarteira | CRUD de ativos, compras, rebalanceamento |
| `patrimonio` | TabPatrimonio | Evolução histórica vs CDI |
| `analise` | TabAnalise | Análise IA da carteira completa |
| `ticker` | TabTicker | Análise individual de ticker |
| `comparador` | TabComparador | Comparação de até 4 ativos |
| `oportunidades` | TabOportunidades | Buscador de oportunidades B3 |
| `risco` | TabRisco | Dashboard de risco quantitativo (HHI, concentração por ativo/setor, score) |
| `rebalanceamento` | TabRebalanceamento | Atual vs. ideal com ações de compra e simulação de aporte |
| `renda` | TabRendaPassiva | Projeção de renda passiva futura (DY%, aporte, horizonte) |
| `historico` | TabHistorico | Histórico de análises salvas |
| `proventos` | TabProventos | Registro e visualização de dividendos |
| `watchlist` | TabWatchlist | Preços-alvo e alertas |
| `universo` | TabUniverso | Universo customizável da IA |
| `ir` | TabIR | Calculadora de IR sobre vendas |
| `meta` | TabMeta | Simulador do 1º Milhão |
| `cenarios` | TabCenarios | Cenários de rentabilidade futura |

---

## Atalhos de teclado

- `Ctrl+K` / `/` — Paleta de comandos
- `?` — Painel de atalhos
- `g + c` Carteira · `g + p` Patrimônio · `g + r` Risco · `g + b` Rebalancear
- `g + a` Análise IA · `g + t` Ticker · `g + o` Oportunidades
- `g + h` Histórico · `g + d` Proventos · `g + w` Watchlist · `g + u` Universo · `g + i` IR
- `g + m` 1º Milhão · `g + e` Renda Passiva · `g + x` Cenários

---

## Fluxo de dados

```
Usuário → TabCarteira → supabase.js (CRUD)
                     → useCotacoes → brapi.dev (cotações ao vivo, 60s)

Usuário → "Analisar" → /api/analyze → Gemini 2.5 Flash
                     → /api/fundamentos → bolsai (fundamentos reais)
                     → /api/cotacoes → brapi.dev (preços)

Cron diário  → /api/cron-screening   → bolsai → screening_catalogo (Supabase)
Cron semanal → /api/cron-fundamentos → bolsai → screening_fundamentos (Supabase)
```

---

## Variáveis de ambiente

```bash
# Vercel (backend)
GEMINI_API_KEY=...
BOLSAI_TOKEN=...
CRON_SECRET=...

# Supabase (embutidas no frontend — anon key pública)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

> A anon key é pública (protegida por RLS). A chave do Gemini fica apenas no servidor (Vercel).

---

## Decisões de design

- **App.jsx monolítico (~5000 linhas):** estado compartilhado (carteira, perfil, cotações) evita prop drilling. Componentes só são extraídos quando autônomos.
- **CSS Variables em vez de Tailwind:** theming nativo `[data-theme="light|dark"]`, zero runtime, inspecionável no DevTools.
- **brapi.dev em vez de Yahoo:** foco em B3, sem rate limit no free tier para uso pessoal.
- **Sem B3 API direta:** exige contrato comercial + compliance LGPD.
- **Sem Open Finance (Pluggy/Belvo):** caro e desnecessário para uso pessoal.
- **Sazonalidade de dividendos real:** pesos mensais customizados (FIIs mensais; ações concentradas em mar/mai/ago/nov) em vez de distribuição flat.

---

## Como adicionar uma nova aba

1. Crie a função `TabNome({ ...props })` em `App.jsx`
2. Adicione `{k:"nome", icon:Icon, label:"Label", cor:"var(--ui-...)", grupo:"..."}` ao array `TABS`
3. Adicione `{tab==="nome" && <TabNome .../>}` na área de conteúdo
4. Adicione o atalho de teclado no `navMap` do `useEffect` de atalhos (opcional)
5. Adicione ao `CommandPalette` se relevante

---

## Rollback

```bash
# Ver o ponto de backup
git log --oneline backup/pre-pending-tasks-20260509

# Rollback completo (cria nova branch a partir do backup)
git checkout -b rollback/emergency backup/pre-pending-tasks-20260509
git push -u origin rollback/emergency
```
