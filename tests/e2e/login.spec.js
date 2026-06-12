import { test, expect } from '@playwright/test';

test.describe('Tela de Login', () => {
  test('exibe formulário de login', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('InvestIA')).toBeVisible();
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrar/i })).toBeVisible();
  });

  test('cadastros abertos com teste grátis de 7 dias', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    // Atalho para criar conta com trial
    const btnTrial = page.getByRole('button', { name: /Teste grátis por 7 dias/i });
    await expect(btnTrial).toBeVisible();
    // Abre o modo signup com a oferta do trial
    await btnTrial.click();
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
    await expect(page.getByText(/Teste grátis por 7 dias — sem cartão de crédito/i)).toBeVisible();
  });

  test('valida campos obrigatórios', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Entrar$/i }).click();
    await expect(page.getByText(/Preencha email e senha/i)).toBeVisible();
  });

  test('valida tamanho mínimo da senha', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('seu@email.com').fill('teste@exemplo.com');
    await page.getByPlaceholder('••••••••').fill('123');
    await page.getByRole('button', { name: /Entrar$/i }).click();
    await expect(page.getByText(/mínimo 6 caracteres/i)).toBeVisible();
  });

  test('rejeita credenciais inválidas', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('seu@email.com').fill('naoexiste@inventia.test');
    await page.getByPlaceholder('••••••••').fill('senhaerrada123');
    await page.getByRole('button', { name: /Entrar$/i }).click();
    // Aguarda resposta da API
    await expect(page.getByText(/incorretos|incorrect/i)).toBeVisible({ timeout: 10000 });
  });
});
