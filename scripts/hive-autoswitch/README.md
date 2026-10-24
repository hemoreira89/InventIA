# Hive OS autoswitch — rig `rtx5080`

Troca automaticamente a flight sheet do rig no Hive OS para a moeda mais
rentável, descontando energia, e manda um resumo no Telegram. Roda de hora em
hora no GitHub Actions (`.github/workflows/hive-autoswitch.yml`). Não tem
relação com o app Cauril — mora aqui só para usar o cron gratuito.

## Como decide

1. Lê o worker no Hive OS: flight sheet ativa, hashrate e watts **reais**.
   Esses valores calibram o benchmark da moeda atual (média móvel), então o
   `hashrate`/`watts` do `coins.json` servem só até a primeira observação.
2. Para cada moeda do `coins.json` que tenha uma flight sheet com nome
   compatível, consulta o WhatToMine com o hashrate desta placa → receita/dia
   em USD. Converte para BRL (câmbio do dia) e desconta energia
   (`watts + overheadW` × 24h × `KWH_BRL`) e taxa da pool.
3. Troca só se a melhor moeda render **`thresholdPct`% a mais** por
   **`minStreak` verificações seguidas** (padrão: 10% por 6 horas). Depois de
   trocar, espera `COOLDOWN_MIN` (90 min) sem observar nem decidir, porque o
   Hive ainda reporta o algoritmo antigo por um tempo.
4. Nunca mexe se o rig está offline ou se a flight sheet ativa não está no
   `coins.json` (sinal de ajuste manual).

Relatório no Telegram: a cada troca, quando o rig está offline, e uma vez
por dia às `REPORT_HOUR_UTC` (padrão 23h UTC = 20h BRT).

## Setup (uma vez)

1. **Flight sheets no Hive OS** — uma por moeda, com o nome contendo o
   `coin` ou um `alias` do `coins.json` (ex.: `PRL Kryptex`, `Quantus Kryptex`).
2. **Token** — Hive OS → Conta → API → *Create token*. Salve em
   *Settings → Secrets and variables → Actions*:

   | Tipo | Nome | Valor |
   |---|---|---|
   | Secret | `HIVE_TOKEN` | o token |
   | Secret | `TELEGRAM_BOT_TOKEN` | opcional, mesmo bot dos alertas do Painel |
   | Secret | `TELEGRAM_CHAT_ID` | opcional, seu chat id |
   | Variable | `KWH_BRL` | tarifa, ex. `1.05` |
   | Variable | `HIVE_WORKER_NAME` | opcional, padrão `rtx5080` |

3. **Primeiro teste** — *Actions → Hive OS autoswitch → Run workflow* com
   `dry_run` marcado. O log mostra as flight sheets encontradas (✓ nas
   casadas), o hashrate observado e o ranking. Confira se o US$/dia bate com
   o que o painel da Kryptex mostra; se não bater, a `unit` do `coins.json`
   está errada para aquela moeda.
4. **Calibrar a segunda moeda** — aplique a flight sheet dela manualmente
   por 1–2 horas. O script grava o hashrate observado e passa a comparar.
   Enquanto uma moeda não tem benchmark, ela é ignorada (o log avisa).

## Rodar local

```bash
HIVE_TOKEN=... DRY_RUN=1 KWH_BRL=1.0 node scripts/hive-autoswitch/autoswitch.mjs
```

Estado fica em `.hive-state/state.json` (no Actions, via cache). Para
testar sem rede, `HIVE_API_BASE`, `WTM_BASE` e `FX_URL` aceitam um servidor
fake. Testes da lógica pura: `npx vitest run tests/unit/hiveAutoswitch.test.js`.

## Adicionar uma moeda

Inclua um objeto em `candidates` com `coin`, `aliases`, `wtmId` (id na URL do
WhatToMine), `unit` (a unidade que o WhatToMine usa para ela), `algos`
(nome do algoritmo como o Hive reporta) e crie a flight sheet. `hashrate` e
`watts` podem ficar `null`: minere 1h para calibrar.
