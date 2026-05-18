import { expect, test } from "@playwright/test";

// Fluxo de onboarding ponta a ponta. Requer banco configurado (DATABASE_URL).
// Sem banco, rode apenas o smoke da landing/auth.

test("landing renderiza e leva ao cadastro", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /cresce com seu negócio/i })).toBeVisible();
  await page.getByRole("link", { name: /começar agora/i }).click();
  await expect(page).toHaveURL(/\/signup/);
  await expect(page.getByRole("button", { name: /criar conta/i })).toBeVisible();
});

test("rota protegida redireciona para login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/signin/);
});

// Fluxo completo dos 6 passos — habilite quando houver banco de teste.
test.fixme("onboarding completo cria organização e capabilities", async ({ page }) => {
  // 1. signup + verificação de email (mock)
  // 2. passo 1: CNPJ válido
  // 3. passo 2: confirmar e criar organização
  // 4. passo 3: bebidas → capabilities de idade/lei seca
  // 5. passos 4-6: unidades, catálogo, finalizar
  // 6. assert: dashboard mostra capabilities ativas
  await page.goto("/onboarding");
});
