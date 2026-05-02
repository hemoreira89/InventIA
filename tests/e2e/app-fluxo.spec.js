import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_USER || 'e2e-test@inventia.app';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'TesteE2E_2026!';

test.describe('Fluxo principal autenticado', () => {
  test.beforeEach(async ({ page }) => {
    // Faz login antes de cada teste
    await page.goto('/');

    // Tenta login. Se falhar (usuário não existe), cria
    await page.getByPlaceholder('seu@email.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /^Entrar$/i }).click();

    await page.waitForTimeout(2000);

    // Se ainda estiver na tela de login, tenta criar conta
    const ainda_na_login = await page.getByRole('heading', { name: 'Entrar' }).isVisible().catch(() => false);
    if (ainda_na_login) {
      await page.getByRole('button', { name: /Criar agora/i }).click();
      await page.getByRole('button', { name: /Criar conta/i }).click();
      await page.waitForTimeout(2000);
    }

    // Espera carregar a barra superior do app (PATRIMÔNIO indica que entramos)
    await expect(page.getByText('PATRIMÔNIO')).toBeVisible({ timeout: 15000 });
  });

  test('exibe top bar com métricas', async ({ page }) => {
    await expect(page.getByText('PATRIMÔNIO')).toBeVisible();
    await expect(page.getByText('POSIÇÕES')).toBeVisible();
    await expect(page.getByText('DY MÉDIO')).toBeVisible();
    await expect(page.getByText('WATCHLIST')).toBeVisible();
  });

  test('todas as 13 tabs estão visíveis', async ({ page }) => {
    const tabs = ['Carteira', 'Patrimônio', 'Gráficos', 'Análise IA',
                   'Analisar Ticker', 'Comparador', 'Oportunidades',
                   'Histórico', 'Proventos', 'Watchlist', '1º Milhão',
                   'Cenários', 'IR'];

    for (const tab of tabs) {
      await expect(page.getByRole('button', { name: new RegExp(tab, 'i') })).toBeVisible();
    }
  });

  test('navega entre tabs', async ({ page }) => {
    // Vai para Cenários
    await page.getByRole('button', { name: /Cenários/i }).click();
    await expect(page.getByText(/SIMULADOR DE CENÁRIOS/i)).toBeVisible();

    // Volta para Carteira
    await page.getByRole('button', { name: /^Carteira$/i }).click();
    await expect(page.getByText(/REGISTRAR COMPRA/i)).toBeVisible();
  });

  test('formulário de registrar compra está acessível', async ({ page }) => {
    await page.getByRole('button', { name: /^Carteira$/i }).click();
    await expect(page.getByPlaceholder(/Ticker/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Quantidade/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar Compra/i })).toBeVisible();
  });

  test('formulário de watchlist está acessível', async ({ page }) => {
    await page.getByRole('button', { name: /Watchlist/i }).click();
    await expect(page.getByText(/WATCHLIST/i)).toBeVisible();
  });

  test('campo de aporte aceita valores', async ({ page }) => {
    const aporteInput = page.getByPlaceholder(/R\$ 0,00/i);
    await aporteInput.fill('1000');
    // O campo formata automaticamente para R$ 1.000,00
    await expect(aporteInput).not.toHaveValue('');
  });

  test('botões de aporte rápido funcionam', async ({ page }) => {
    await page.getByRole('button', { name: 'R$1k' }).click();
    const aporteInput = page.getByPlaceholder(/R\$ 0,00/i);
    await expect(aporteInput).not.toHaveValue('');
  });

  test('logout retorna para tela de login', async ({ page }) => {
    // Botão de logout fica no canto superior direito (LogOut icon)
    const logoutBtn = page.locator('button[title="Sair"]');
    await logoutBtn.click();
    // Aguarda voltar para tela de login
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible({ timeout: 5000 });
  });
});
