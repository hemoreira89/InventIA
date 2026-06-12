import { test, expect } from '@playwright/test';

// A raiz "/" agora é a landing de vendas; o formulário fica atrás do "Entrar".
async function abrirLogin(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
}

test.describe('Landing page (visitante deslogado)', () => {
  test('exibe hero, planos e CTA do teste grátis', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/analisada por IA/i);
    await expect(page.getByText('R$ 24,90')).toBeVisible();
    await expect(page.getByText('R$ 199,00')).toBeVisible();
    // Vitalício é interno (dono + testes) — nunca pode estar à venda
    await expect(page.getByText(/vitalício/i)).toHaveCount(0);
  });

  test('CTA "Começar teste grátis" abre o cadastro', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Começar teste grátis/i }).click();
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
    await expect(page.getByText(/Teste grátis por 7 dias — sem cartão de crédito/i)).toBeVisible();
  });

  test('"Entrar" abre o formulário de login', async ({ page }) => {
    await abrirLogin(page);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
  });
});

test.describe('Tela de Login', () => {
  test('permite alternar para cadastro com trial', async ({ page }) => {
    await abrirLogin(page);
    const btnTrial = page.getByRole('button', { name: /Teste grátis por 7 dias/i });
    await expect(btnTrial).toBeVisible();
    await btnTrial.click();
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
  });

  test('valida campos obrigatórios', async ({ page }) => {
    await abrirLogin(page);
    await page.getByRole('button', { name: /Entrar$/i }).click();
    await expect(page.getByText(/Preencha email e senha/i)).toBeVisible();
  });

  test('valida tamanho mínimo da senha', async ({ page }) => {
    await abrirLogin(page);
    await page.getByPlaceholder('seu@email.com').fill('teste@exemplo.com');
    await page.getByPlaceholder('••••••••').fill('123');
    await page.getByRole('button', { name: /Entrar$/i }).click();
    await expect(page.getByText(/mínimo 6 caracteres/i)).toBeVisible();
  });

  test('rejeita credenciais inválidas', async ({ page }) => {
    await abrirLogin(page);
    await page.getByPlaceholder('seu@email.com').fill('naoexiste@inventia.test');
    await page.getByPlaceholder('••••••••').fill('senhaerrada123');
    await page.getByRole('button', { name: /Entrar$/i }).click();
    // Aguarda resposta da API
    await expect(page.getByText(/incorretos|incorrect/i)).toBeVisible({ timeout: 10000 });
  });
});
