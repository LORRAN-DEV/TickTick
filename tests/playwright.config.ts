import { defineConfig } from "@playwright/test";

const PORTA = 4173;
const PORTA_API = 8001;

/**
 * Testes de sync (objetivo 8) precisam da API Python e de um Postgres. Defina
 * TICKTICK_E2E_DATABASE_URL (banco terminando em "e2e", que é APAGADO a cada execução) para ligá-los;
 * sem ela, são pulados e o resto da suíte roda só com o app.
 */
const BANCO_E2E = process.env["TICKTICK_E2E_DATABASE_URL"];
export const EMAIL_E2E = "e2e@exemplo.com";
export const SENHA_E2E = "senha-do-e2e-123";

const servidorApp = {
  // Build de produção + servidor estático (como em produção, ADR 0003 e 0004).
  command: `pnpm --dir .. build && node servidor-estatico.mjs`,
  url: `http://127.0.0.1:${PORTA}/`,
  env: { PORTA: String(PORTA), ...(BANCO_E2E ? { API_ALVO: `http://127.0.0.1:${PORTA_API}` } : {}) },
  reuseExistingServer: false,
  timeout: 180_000,
  stdout: "ignore" as const,
  stderr: "pipe" as const,
};

const servidorApi = {
  command:
    `cd ../apps/api && echo "${SENHA_E2E}" | uv run ticktick-api preparar-teste ${EMAIL_E2E} --senha-stdin` +
    ` && uv run ticktick-api servir --porta ${PORTA_API}`,
  url: `http://127.0.0.1:${PORTA_API}/api/saude`,
  env: { TICKTICK_DATABASE_URL: BANCO_E2E ?? "", TICKTICK_COOKIE_SEGURO: "false" },
  reuseExistingServer: false,
  timeout: 120_000,
  stdout: "ignore" as const,
  stderr: "pipe" as const,
};

export default defineConfig({
  testDir: "e2e",
  // Em série: o teste de atualização do PWA troca a versão servida, e o sync usa uma conta só.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: process.env["CI"] ? [["list"], ["github"]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    timezoneId: "America/Sao_Paulo",
    locale: "pt-BR",
    viewport: { width: 1200, height: 900 },
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    // Objetivos 1 a 4 e 8. Sem service worker, para o cache não interferir entre testes.
    { name: "app", testIgnore: /pwa\.spec\.ts/, use: { serviceWorkers: "block" } },
    // Objetivo 5.
    // Chromium completo (headless novo): o "headless shell" padrão não mostra notificações (objetivo 10).
    { name: "pwa", testMatch: /pwa\.spec\.ts/, use: { serviceWorkers: "allow", channel: "chromium" } },
  ],
  webServer: BANCO_E2E ? [servidorApi, servidorApp] : [servidorApp],
});
