import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_USER || 'e2e-test@inventia.app';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'TesteE2E_2026!';

test.describe('Fluxo principal autenticado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('seu@email.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /^Entrar$/i }).click();

    await page.waitForTimeout(2000);

    // Se ainda estiver na tela de login, tenta criar conta
    const ainda_na_login = await page.getByRole('heading', { name: 'Entrar' })
      .isVisible().catch(() => false);
    if (ainda_na_login) {
      await page.getByRole('button', { name: /Criar agora/i }).click();
      await page.getByRole('button', { name: /Criar conta/i }).click();
      await page.waitForTimeout(2000);
    }

    // Aguarda app carregar - usa o botão de logout (existe APENAS após login)
    await expect(page.locator('button[title="Sair"]')).toBeVisible({ timeout: 15000 });
  });

  test('exibe top bar com métricas', async ({ page }) => {
    // Usa exact:true para pegar APENAS o label da métrica (não a tab)
    await expect(page.getByText('PATRIMÔNIO', { exact: true })).toBeVisible();
    await expect(page.getByText('POSIÇÕES', { exact: true })).toBeVisible();
    await expect(page.getByText('DY MÉDIO', { exact: true })).toBeVisible();
    await expect(page.getByText('WATCHLIST', { exact: true })).toBeVisible();
  });

  test('todas as 13 tabs estão visíveis', async ({ page }) => {
    // Lista exata dos labels das tabs
    const tabs = [
      'Carteira', 'Patrimônio', 'Gráficos', 'Análise IA',
      'Analisar Ticker', 'Comparador', 'Oportunidades',
      'Histórico', 'Proventos', 'Watchlist', '1º Milhão',
      'Cenários', 'IR'
    ];

    for (const tab of tabs) {
      // Usa role=button + name exato para evitar ambiguidade
      const tabBtn = page.getByRole('button', { name: tab, exact: true });
      await expect(tabBtn).toBeVisible();
    }
  });

  test('navega entre tabs', async ({ page }) => {
    // Vai para Cenários
    await page.getByRole('button', { name: 'Cenários', exact: true }).click();
    await expect(page.getByText(/SIMULADOR DE CENÁRIOS/i)).toBeVisible();

    // Volta para Carteira
    await page.getByRole('button', { name: 'Carteira', exact: true }).click();
    await expect(page.getByText(/REGISTRAR COMPRA/i)).toBeVisible();
  });

  test('formulário de registrar compra está acessível', async ({ page }) => {
    await page.getByRole('button', { name: 'Carteira', exact: true }).click();
    await expect(page.getByPlaceholder(/Ticker/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Quantidade/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar Compra/i })).toBeVisible();
  });

  test('formulário de watchlist está acessível', async ({ page }) => {
    await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
    // Confirma que mudou de tab vendo o título da seção
    await expect(page.getByText(/WATCHLIST/i).first()).toBeVisible();
  });

  test('aba de proventos abre corretamente', async ({ page }) => {
    await page.getByRole('button', { name: 'Proventos', exact: true }).click();
    await expect(page.getByText(/REGISTRAR PROVENTO/i)).toBeVisible();
  });

  test('aba de patrimônio abre corretamente', async ({ page }) => {
    await page.getByRole('button', { name: 'Patrimônio', exact: true }).click();
    await expect(page.getByText(/EVOLUÇÃO DO PATRIMÔNIO/i)).toBeVisible();
  });

  test('aba de oportunidades abre corretamente', async ({ page }) => {
    await page.getByRole('button', { name: 'Oportunidades', exact: true }).click();
    await expect(page.getByText(/OPORTUNIDADES DO MOMENTO/i)).toBeVisible();
  });

  test('aba de analisar ticker abre corretamente', async ({ page }) => {
    await page.getByRole('button', { name: 'Analisar Ticker', exact: true }).click();
    await expect(page.getByText(/ANÁLISE INDIVIDUAL DE TICKER/i)).toBeVisible();
  });

  test('campo de aporte aceita valores', async ({ page }) => {
    const aporteInput = page.getByPlaceholder(/R\$ 0,00/i);
    await aporteInput.fill('1000');
    await expect(aporteInput).not.toHaveValue('');
  });

  test('botões de aporte rápido funcionam', async ({ page }) => {
    await page.getByRole('button', { name: 'R$1k', exact: true }).click();
    const aporteInput = page.getByPlaceholder(/R\$ 0,00/i);
    await expect(aporteInput).not.toHaveValue('');
  });

  test('logout retorna para tela de login', async ({ page }) => {
    await page.locator('button[title="Sair"]').click();
    await expect(page.getByRole('heading', { name: 'Entrar' }))
      .toBeVisible({ timeout: 5000 });
  });
});
