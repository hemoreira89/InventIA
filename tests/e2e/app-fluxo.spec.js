import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_USER || 'e2e-test@inventia.app';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'TesteE2E_2026!';

// Navega para uma tab via atalho de teclado (g + tecla).
// As tabs ficam dentro de dropdowns no nav — o atalho é mais confiável.
async function gotoTab(page, key) {
  await page.locator('body').click({ position: { x: 200, y: 600 } });
  await page.keyboard.press('g');
  await page.keyboard.press(key);
  await page.waitForTimeout(300);
}

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

    // Aguarda app carregar — botão de logout só existe após login
    await expect(page.locator('button[title="Sair"]')).toBeVisible({ timeout: 15000 });
  });

  test('exibe top bar com métricas', async ({ page }) => {
    await expect(page.getByText('PATRIMÔNIO', { exact: true })).toBeVisible();
    await expect(page.getByText('POSIÇÕES', { exact: true })).toBeVisible();
    await expect(page.getByText('DY MÉDIO', { exact: true })).toBeVisible();
    await expect(page.getByText('WATCHLIST', { exact: true })).toBeVisible();
  });

  test('grupos de navegação estão visíveis na nav bar', async ({ page }) => {
    // Carteira é botão direto; demais são dropdowns com label do grupo
    await expect(page.getByRole('button', { name: 'Carteira', exact: true })).toBeVisible();
    // Grupos dropdown — o botão mostra o label do grupo quando nenhuma tab está ativa nele
    for (const grupo of ['Análise', 'Planejar', 'Registros', 'Listas']) {
      await expect(page.getByText(grupo, { exact: true }).first()).toBeVisible();
    }
  });

  test('navega para Cenários e volta para Carteira', async ({ page }) => {
    await gotoTab(page, 'x'); // Cenários
    await expect(page.getByText(/SIMULADOR DE CENÁRIOS/i)).toBeVisible();

    await gotoTab(page, 'c'); // Carteira
    await expect(page.getByText('REGISTRAR COMPRA', { exact: true })).toBeVisible();
  });

  test('formulário de registrar compra está acessível', async ({ page }) => {
    await gotoTab(page, 'c'); // Carteira
    await expect(page.getByPlaceholder(/Ticker/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Quantidade/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar Compra/i })).toBeVisible();
  });

  test('aba Watchlist abre corretamente', async ({ page }) => {
    await gotoTab(page, 'w'); // Watchlist
    await expect(page.getByText(/WATCHLIST/i).first()).toBeVisible();
  });

  test('aba Proventos abre corretamente', async ({ page }) => {
    await gotoTab(page, 'd'); // Proventos
    await expect(page.getByText(/REGISTRAR PROVENTO/i)).toBeVisible();
  });

  test('aba Patrimônio abre corretamente', async ({ page }) => {
    await gotoTab(page, 'p'); // Patrimônio
    await expect(page.getByText(/EVOLUÇÃO DO PATRIMÔNIO/i)).toBeVisible();
  });

  test('aba Oportunidades abre corretamente', async ({ page }) => {
    await gotoTab(page, 'o'); // Oportunidades
    await expect(page.getByText(/OPORTUNIDADES DO MOMENTO/i)).toBeVisible();
  });

  test('aba Analisar Ticker abre corretamente', async ({ page }) => {
    await gotoTab(page, 't'); // Ticker
    await expect(page.getByText(/ANÁLISE INDIVIDUAL DE TICKER/i)).toBeVisible();
  });

  test('aba Análise IA — campo de aporte está acessível', async ({ page }) => {
    await gotoTab(page, 'a'); // Análise IA
    const aporteInput = page.getByPlaceholder(/R\$ 0,00/i);
    await expect(aporteInput).toBeVisible();
    await aporteInput.fill('1000');
    await expect(aporteInput).not.toHaveValue('');
  });

  test('botões de aporte rápido funcionam', async ({ page }) => {
    await gotoTab(page, 'a'); // Análise IA
    await page.getByRole('button', { name: 'R$1k', exact: true }).click();
    await expect(page.getByPlaceholder(/R\$ 0,00/i)).not.toHaveValue('');
  });

  test('aba Risco abre corretamente', async ({ page }) => {
    await gotoTab(page, 'r'); // Risco
    await expect(page.getByText(/RISCO/i).first()).toBeVisible();
  });

  test('aba IR abre corretamente', async ({ page }) => {
    await gotoTab(page, 'i'); // IR
    await expect(page.getByText(/IR/i).first()).toBeVisible();
  });

  test('logout retorna para tela de login', async ({ page }) => {
    await page.locator('button[title="Sair"]').click();
    await expect(page.getByRole('heading', { name: 'Entrar' }))
      .toBeVisible({ timeout: 5000 });
  });
});
