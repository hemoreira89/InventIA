# Setup do Catálogo de Screening B3

Este documento descreve o que precisa ser configurado **manualmente** para que
a Tab Oportunidades use o catálogo Supabase em vez de pedir candidatos pra IA.

## 1. Rodar SQL no Supabase Studio

Acesse https://supabase.com/dashboard/project/bjghaqtyijvlnwlesrst → SQL Editor → New Query

Copie e cole o conteúdo de `sql/screening_catalogo.sql` e clique em Run.

Isso cria:
- Tabela `screening_catalogo` (catálogo de tickers da B3)
- Tabela `screening_catalogo_log` (log de execuções do cron)
- Índices para queries rápidas
- RLS com leitura pública

## 2. Pegar a Service Role Key do Supabase

1. Acesse https://supabase.com/dashboard/project/bjghaqtyijvlnwlesrst/settings/api
2. Em "Project API keys" → copie a chave `service_role` (NÃO a `anon`)
3. **CUIDADO**: essa chave bypassa RLS — só vai pro backend, nunca pro frontend

## 3. Gerar o CRON_SECRET

Em qualquer terminal, gere um segredo aleatório:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarda esse valor — vai usar no próximo passo.

## 4. Configurar as Env Vars no Vercel

Em https://vercel.com/hemoreira89/invent-ia/settings/environment-variables, adicione:

| Nome | Valor | Environments |
|------|-------|--------------|
| `SUPABASE_SERVICE_ROLE` | (do passo 2) | Production, Preview, Development |
| `CRON_SECRET` | (do passo 3) | Production, Preview, Development |

## 5. Trigger manual da primeira execução

Depois do próximo deploy, dispare o cron manualmente uma vez para popular a tabela:

```bash
curl -X POST https://invent-ia.vercel.app/api/cron-screening \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

Resposta esperada (em ~30 segundos):
```json
{
  "ok": true,
  "tickers_total": 750,
  "acoes_total": 350,
  "fiis_total": 400,
  "duracao_ms": 25431
}
```

Se tudo funcionou, vá no Supabase → Table Editor → `screening_catalogo` e veja
as 750+ linhas povoadas.

## 6. Daí em diante, automático

O Vercel Cron roda `0 6 * * *` UTC = todo dia às 3h da manhã horário Brasil.
Você não precisa fazer mais nada.

Pra ver as execuções: Supabase → Table Editor → `screening_catalogo_log`.

## Custos

- **brapi**: 1-2 reqs por dia (1 paginada por tipo). De 15.000 mensais. ✅ FREE
- **Supabase**: ~250kb de armazenamento. ✅ FREE
- **bolsai**: usado só quando usuário clica em "Buscar oportunidades" (~20 reqs/click). ✅ FREE
- **Vercel Cron**: incluído no plano Hobby. ✅ FREE

Total: **R$ 0/mês**.
