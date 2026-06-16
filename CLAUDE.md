# CLAUDE.md — Cauril

Plataforma web de análise de carteira de investimentos da B3 com IA (Gemini 2.5 Flash), cotações em tempo real e visualizações ricas.

**Produção:** https://cauril.com.br  
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
| `profiles` | Perfil do usuário (criado via trigger na auth) — `plano` ('trial'\|'mensal'\|'anual'\|'vitalicio'), `trial_fim` (signup + 7 dias), `plano_expira_em`, `nome`, `data_nascimento` (capturados no signup). Somente leitura para o cliente (mudança de plano = SQL/service role) |
| `carteiras` | Portfólios (1+ por usuário; `nome`, `user_id`) |
| `ativos` | Ativos da carteira (`ticker`, `qtd`, `pm`, `peso_alvo`, `carteira_id`) |
| `compras` | Histórico imutável de compras |
| `watchlist` | Tickers com preço-alvo e nota |
| `proventos` | Dividendos recebidos |
| `analises` | Snapshots das análises IA |
| `patrimonio_snapshots` | Evolução do patrimônio (gráfico) |
| `universo_usuario` | Universo customizável de tickers para a IA |
| `screening_catalogo` | ~1430 tickers B3 (atualizado diariamente) |
| `screening_fundamentos` | Fundamentos cacheados semanalmente (bolsai) |
| `pagamentos` | Caixa real recebido (controle do teto de R$5k do CPF). RLS libera só o dono. Lido/escrito pelo Painel (aba `admin`) |

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
| `admin` | TabAdmin | **Painel estratégico — só o dono** (`OWNER_EMAIL`). Usuários ativos/inativos, planos, faixa etária, MRR e receita do mês vs. teto R$5k. Dados via RPC `admin_metrics()` (security definer guardado pelo e-mail). Registra pagamentos na tabela `pagamentos` |

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
MERCADOPAGO_ACCESS_TOKEN=...   # assinatura recorrente (preapproval) + webhook
SUPABASE_SERVICE_ROLE=...      # usado pelo webhook/cancelamento p/ ativar plano

# Supabase (embutidas no frontend — anon key pública)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# Monetização (opcionais — sem elas o botão "Assinar" cai no contato por email)
VITE_CHECKOUT_URL_MENSAL=...   # link de pagamento ESTÁTICO (pula o MP recorrente)
VITE_CHECKOUT_URL_ANUAL=...
VITE_CONTATO_EMAIL=...         # default: contato@cauril.com.br
```

> A anon key é pública (protegida por RLS). A chave do Gemini e a SERVICE_ROLE ficam apenas no servidor (Vercel).
>
> **Pagamentos (Mercado Pago):** as ações ficam em **`/api/mp`** (1 function, dispatch por `action` — consolidado por causa do limite de 12 Serverless Functions do plano Hobby): `assinar` (preapproval recorrente; guarda `mp_preapproval_id` no perfil já na criação), `pagar_avulso` (Checkout Pro avulso), `cancelar`. O **`cancelar`** encerra a recorrência e, se o último pagamento foi há **≤7 dias**, faz **reembolso integral automático** (CDC Art. 49) — marca `pagamentos.reembolsado_em` e encerra o acesso. O `/api/mp-webhook` (separado, URL fixa) trata `payment` e `subscription_authorized_payment` (ativa/estende plano + grava receita, idempotente por `referencia`) e `subscription_preapproval` (guarda/limpa `mp_preapproval_id`); mapeia o usuário por `external_reference` (`<userId>:<plano>`), com backup por `mp_preapproval_id` e por e-mail do pagador. Paywall oferece assinar (cartão) ou avulso (Pix/boleto) + política de reembolso; cancelamento via botão no header (só aparece com assinatura ativa). **No painel do MP configure o webhook em PRODUÇÃO** com URL **`https://www.cauril.com.br/api/mp-webhook`** (com `www` — o apex dá 502) e eventos Pagamentos + Planos e assinaturas. ⚠️ O **`service_role` precisa de DML em `public`** (ver migração `2026-06-16_grant_service_role_dml.sql`) senão o webhook dá 403 em toda escrita. Se `VITE_CHECKOUT_URL_*` estiver setada, o app usa o link estático e pula o MP.

---

## Monetização (planos + trial de 7 dias)

- **Signup** → trigger `on_auth_user_created` cria linha em `profiles` com `plano='trial'` e `trial_fim = now() + 7 dias` (ver `sql/migrations/2026-06-12_planos_trial.sql`).
- **Frontend** (`src/lib/plano.js` + `src/components/Paywall.jsx`): pill "Teste grátis · Xd" no header durante o trial; quando expira, o app bloqueia com a tela de planos (Mensal R$ 24,90 / Anual R$ 199).
- **Backend** (`api/analyze.js`): valida o JWT do usuário contra `profiles` antes de gastar Gemini (HTTP 402 se expirado; fail-open em erro de infra para nunca derrubar usuário pagante por bug).
- **Ativar plano pago** (recomendado): registrar o pagamento no **Painel** (aba `admin`) com o e-mail do cliente — a RPC `admin_registrar_pagamento` grava o caixa e **ativa/renova o plano automaticamente** (mensal +1 mês, anual +1 ano a partir do vencimento atual, vitalício sem expiração).
- **Ativar plano pago** (alternativa manual via SQL):
  ```sql
  update public.profiles
     set plano = 'mensal',                            -- ou 'anual'
         plano_expira_em = now() + interval '1 month', -- ou '1 year'
         updated_at = now()
   where email = 'cliente@email.com';
  ```
- **Estender trial:** `update public.profiles set trial_fim = now() + interval '7 days' where email = '...';`
- Usuários pré-existentes (dono + e2e) têm `plano='vitalicio'` (nunca expira).
- **`vitalicio` é interno** — uso exclusivo do dono e do usuário de testes E2E. Nunca deve aparecer como opção de compra na Paywall/Landing (o catálogo de venda é só `PLANOS` em `src/lib/plano.js`: mensal e anual).
- **Landing page** (`src/Landing.jsx`): página de vendas para visitante deslogado (hero, features, planos, FAQ). "Entrar"/"Teste grátis" levam ao `Login.jsx` (`modoInicial` login/signup).

### ⚠️ Pendências manuais (painel do Supabase — só o dono consegue)

1. **Reabrir signups:** Authentication → Sign In/Up → habilitar "Allow new users to sign up" (foi desligado quando o app era de uso pessoal). Sem isso, ninguém consegue criar conta mesmo com o formulário aberto.
2. **Ativar Leaked Password Protection:** Authentication → Policies (recomendação do security advisor).

### 💡 Backlog / ideias futuras

- **Rastreador de consumo de IA no Painel:** capturar `usageMetadata` (tokens) de cada resposta do Gemini em `api/analyze.js` e gravar numa tabela `uso_ia` (log fire-and-forget, à prova de falha). No Painel: chamadas/tokens/custo estimado do mês (preço por 1M tokens configurável) e, opcionalmente, ranking de quem mais consome. Obs.: "saldo/créditos" do Gemini **não** é exposto via API (fica no Google Cloud Billing).

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
