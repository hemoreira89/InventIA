# Setup do Catálogo de Screening B3

Este documento descreve o que precisa ser configurado **manualmente** para que
a Tab Oportunidades use o catálogo Supabase em vez de pedir candidatos pra IA.

## 1. Rodar SQLs no Supabase Studio

Acesse https://supabase.com/dashboard/project/bjghaqtyijvlnwlesrst/sql/new

**Em ordem:**

1. Cole e rode `sql/screening_catalogo.sql` (catálogo de tickers)
2. Cole e rode `sql/screening_fundamentos.sql` (fundamentos pré-cacheados)

Ambos devem retornar `Success. No rows returned`.

## 2. Pegar a Service Role Key do Supabase

1. Acesse https://supabase.com/dashboard/project/bjghaqtyijvlnwlesrst/settings/api-keys
2. Em "Project API keys" → copie a chave `service_role` (NÃO a `anon`)
3. **CUIDADO**: essa chave bypassa RLS — só vai pro backend, nunca pro frontend

## 3. Gerar o CRON_SECRET

Em qualquer terminal, gere um segredo aleatório:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Configurar as Env Vars no Vercel

Em https://vercel.com/hemoreira89/invent-ia/settings/environment-variables, adicione:

| Nome | Valor | Environments |
|------|-------|--------------|
| `SUPABASE_SERVICE_ROLE` | (do passo 2) | Production, Preview, Development |
| `CRON_SECRET` | (do passo 3) | Production, Preview, Development |
| `BOLSAI_API_KEY` | (chave do bolsai Pro) | Production, Preview, Development |
| `BRAPI_TOKEN` | (token brapi) | Production, Preview, Development |

## 5. Disparar manualmente os crons (primeira vez)

### 5.1 Popular o catálogo (rápido, ~3s)

```bash
curl -X POST https://invent-ia.vercel.app/api/cron-screening \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

Resposta esperada:
```json
{ "ok": true, "tickers_total": 1432, "acoes_total": 808, "fiis_total": 624 }
```

### 5.2 Popular fundamentos (em 3 chamadas, ~50s cada)

Como o Vercel Hobby tem limite de 60s por função, dividimos em chunks:

```powershell
$secret = "SEU_CRON_SECRET"

# Chunk 1: tickers 0-499 (mais líquidos)
Invoke-RestMethod -Uri "https://invent-ia.vercel.app/api/cron-fundamentos?offset=0&limit=500" `
    -Method POST -Headers @{ Authorization = "Bearer $secret" }

# Chunk 2: tickers 500-999
Invoke-RestMethod -Uri "https://invent-ia.vercel.app/api/cron-fundamentos?offset=500&limit=500" `
    -Method POST -Headers @{ Authorization = "Bearer $secret" }

# Chunk 3: tickers 1000+
Invoke-RestMethod -Uri "https://invent-ia.vercel.app/api/cron-fundamentos?offset=1000&limit=500" `
    -Method POST -Headers @{ Authorization = "Bearer $secret" }
```

Cada chamada retorna estatísticas:
```json
{
  "ok": true,
  "offset": 0,
  "limit": 500,
  "candidatos": 500,
  "sucessos": 480,
  "falhas": 20,
  "duracao_ms": 45123,
  "proxima_chamada": "?offset=500&limit=500"
}
```

### 5.3 Verificar no Supabase

```sql
SELECT tipo, COUNT(*) FROM screening_fundamentos GROUP BY tipo;
```

Esperado:
- `Ação`: ~700-800
- `FII`: ~500-600

## 6. Cron diário automático

Apenas o `cron-screening` (catálogo) é chamado automaticamente todo dia às 6h UTC pelo Vercel Cron.

### Atualização semanal de fundamentos via GitHub Actions

O arquivo `.github/workflows/cron-fundamentos.yml` configura um workflow que dispara os 3 chunks de cron-fundamentos automaticamente.

**Setup (uma vez):**

1. Acesse https://github.com/hemoreira89/InventIA/settings/secrets/actions
2. Em "Repository secrets" → **New repository secret**
3. Adicione:
   - Name: `CRON_SECRET`
   - Secret: (mesmo valor configurado no Vercel)
4. Save

**Cronograma:** Toda segunda-feira às 9h UTC (6h Brasil). Roda 1h depois do cron-screening, garantindo catálogo atualizado.

**Disparo manual:** https://github.com/hemoreira89/InventIA/actions/workflows/cron-fundamentos.yml → "Run workflow"

Pra ver as execuções: aba Actions do repo no GitHub.

## Custos

- **brapi**: 1-2 reqs/dia (1 paginada por tipo). De 15.000 mensais. ✅ FREE
- **Supabase**: ~500kb total. ✅ FREE
- **bolsai Pro**: ~2800 reqs por execução de fundamentos. Cota 10k/dia. **R$ 29/mês**
- **Vercel Cron**: 1 cron diário (catálogo). ✅ FREE

Total: **R$ 29/mês** (bolsai Pro). Caso queira voltar pra free, troca o `buscarFundamentosCached` na Tab Oportunidades por `buscarFundamentos` (versão runtime).

