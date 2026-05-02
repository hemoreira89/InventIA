# Testes do InvestIA

Estrutura completa de testes automatizados.

## Stack

- **Vitest** — testes unitários
- **Playwright** — testes E2E (navegador real)
- **Node script** — smoke tests rápidos contra produção
- **GitHub Actions** — CI/CD automático a cada push

## Como rodar localmente

```bash
# Testes unitários (~3 segundos)
npm test

# Modo watch (re-roda automaticamente ao salvar)
npm run test:watch

# Interface gráfica do Vitest
npm run test:ui

# Coverage report (gera HTML em ./coverage)
npm run test:coverage

# Smoke tests contra produção
npm run test:smoke

# Testes E2E (precisa instalar browsers primeiro)
npx playwright install chromium
npm run test:e2e

# E2E com UI interativa
npm run test:e2e:ui

# Tudo junto (unit + smoke)
npm run test:all
```

## Estrutura

```
tests/
├── setup.js                    # Setup global (mocks)
├── unit/                       # Testes unitários (Vitest)
│   ├── format.test.js          # fmt, fmtBRL, fmtK
│   ├── calc.test.js            # juros, IR, pesos, etc
│   ├── extrairJSON.test.js     # parser de JSON da IA
│   └── validacao.test.js       # validação de tickers
├── e2e/                        # Testes E2E (Playwright)
│   ├── login.spec.js           # Tela de login
│   └── app-fluxo.spec.js       # Fluxo principal autenticado
└── smoke/
    └── smoke.js                # Health check rápido
```

## CI/CD (GitHub Actions)

A cada push para `main`:

1. **Unit tests** — roda Vitest (~5s)
2. **Build** — verifica que `npm run build` funciona
3. **Smoke tests** — aguarda deploy do Vercel + verifica saúde
4. **E2E tests** — roda Playwright contra produção

Também roda **diariamente às 9h BRT** para detectar problemas.

## Configurar secrets no GitHub

Para os testes E2E funcionarem, crie estes secrets em `Settings → Secrets and variables → Actions`:

- `E2E_USER` — email do usuário de teste
- `E2E_PASSWORD` — senha do usuário de teste

Recomendado: criar uma conta dedicada `e2e-test@inventia.app`.

## Adicionando novos testes

### Teste unitário

Crie arquivo em `tests/unit/<nome>.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { minhaFuncao } from '../../src/lib/calc';

describe('minhaFuncao', () => {
  it('faz o que deve', () => {
    expect(minhaFuncao(10)).toBe(20);
  });
});
```

### Teste E2E

Crie arquivo em `tests/e2e/<nome>.spec.js`:

```js
import { test, expect } from '@playwright/test';

test('descrição do teste', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('InvestIA')).toBeVisible();
});
```
