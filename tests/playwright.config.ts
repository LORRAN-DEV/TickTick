import { defineConfig } from "@playwright/test";

const PORTA = 4173;

export default defineConfig({
  testDir: "e2e",
  // Em série: o teste de atualização do PWA troca a versão servida pelo servidor único.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
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
    // Objetivos 1 a 4. Sem service worker, para o cache não interferir entre testes.
    { name: "app", testIgnore: /pwa\.spec\.ts/, use: { serviceWorkers: "block" } },
    // Objetivo 5.
    { name: "pwa", testMatch: /pwa\.spec\.ts/, use: { serviceWorkers: "allow" } },
  ],
  webServer: {
    // Build de produção + servidor estático (como em produção, ADR 0003 e 0004).
    command: `pnpm --dir .. build && node servidor-estatico.mjs`,
    url: `http://127.0.0.1:${PORTA}/`,
    env: { PORTA: String(PORTA) },
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
