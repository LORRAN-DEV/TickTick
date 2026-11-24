/**
 * Objetivo 8 — app sincronizando com a API (docs/project/escopo.md).
 * Precisa da API e de Postgres (TICKTICK_E2E_DATABASE_URL); sem eles, só o critério 1 roda.
 * Cada "aparelho" é um contexto do navegador, com o próprio IndexedDB.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { EMAIL_E2E, SENHA_E2E } from "../playwright.config.ts";
import { AGORA, abrir, criarTarefa, irPara, linha, vigiarErros } from "./ajuda.ts";

const COM_API = !!process.env["TICKTICK_E2E_DATABASE_URL"];
const unico = () => Math.random().toString(36).slice(2, 7);

const indicador = (page: Page) => page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: /^Conta/ });

async function novoAparelho(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const page = await ctx.newPage();
  await abrir(page, "/");
  return page;
}

async function entrar(page: Page, senha = SENHA_E2E) {
  await indicador(page).click();
  await page.getByLabel("E-mail").fill(EMAIL_E2E);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Quantas mudanças estão na fila de saída, lendo direto do IndexedDB do aparelho. */
const naFila = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((ok, erro) => {
        const req = indexedDB.open("ticktick");
        req.onerror = () => erro(req.error);
        req.onsuccess = () => {
          const q = req.result.transaction("fila").objectStore("fila").count();
          q.onsuccess = () => ok(q.result);
        };
      }),
  );

/** Tudo que este aparelho mudou já subiu (fila vazia) e o último ciclo terminou bem. */
async function sincronizado(page: Page) {
  await expect.poll(() => naFila(page), { timeout: 15_000 }).toBe(0);
  await expect(indicador(page)).toHaveAttribute("aria-label", "Conta: Sincronizado", { timeout: 15_000 });
}

/** Força um ciclo completo pela página Conta (espera ele terminar de verdade) e volta para Tudo. */
async function sincronizarAgora(page: Page) {
  await indicador(page).click();
  const cartao = page.getByTestId("conta");
  const antes = Number(await cartao.getAttribute("data-ciclos"));
  await page.getByRole("button", { name: "Sincronizar agora" }).click();
  await expect.poll(async () => Number(await cartao.getAttribute("data-ciclos")), { timeout: 15_000 }).toBeGreaterThan(antes);
  await sincronizado(page);
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Tarefas" }).click();
  await irPara(page, "Tudo");
}

test.describe("objetivo 8: sincronização", () => {
  test("1. sem login o app funciona e o menu mostra só 'Conta'", async ({ page }) => {
    const erros = vigiarErros(page);
    await abrir(page, "/");
    await expect(indicador(page)).toHaveAttribute("aria-label", "Conta");
    await criarTarefa(page, "local sem conta");
    await indicador(page).click();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    // sem API no ar (ou sem conta) nenhum erro aparece para a pessoa
    expect(erros.filter((e) => !/502|Failed to load resource/.test(e))).toEqual([]);
  });

  test.describe("com a API", () => {
    test.skip(!COM_API, "defina TICKTICK_E2E_DATABASE_URL para rodar os testes de sync com a API");

    test("2. login errado avisa; certo mostra o e-mail e 'Sincronizado'; Sair encerra", async ({ browser }) => {
      const a = await novoAparelho(browser);
      await entrar(a, "senha-errada-123");
      await expect(a.getByRole("alert")).toHaveText("E-mail ou senha incorretos");
      await a.getByLabel("Senha").fill(SENHA_E2E);
      await a.getByRole("button", { name: "Entrar" }).click();
      await expect(a.getByText(EMAIL_E2E)).toBeVisible();
      await sincronizado(a);
      await a.getByRole("button", { name: "Sair" }).click();
      await expect(a.getByRole("button", { name: "Entrar" })).toBeVisible();
      await expect(indicador(a)).toHaveAttribute("aria-label", "Conta");
      await a.context().close();
    });

    test("3 e 4. o que muda no A sobe sozinho e aparece no B, inclusive lixeira", async ({ browser }) => {
      const t = `boleto ${unico()}`;
      const a = await novoAparelho(browser);
      const b = await novoAparelho(browser);
      await entrar(a);
      await sincronizado(a);
      await entrar(b);
      await sincronizado(b);

      await a.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Tarefas" }).click();
      await criarTarefa(a, `${t} amanhã 15h !alta #casa`);
      await sincronizado(a); // subiu sozinho, sem clicar em nada

      await sincronizarAgora(b);
      await expect(linha(b, t)).toContainText("Amanhã 15:00");
      await expect(linha(b, t)).toContainText("#casa");

      await b.getByRole("button", { name: `Mandar "${t}" para a lixeira` }).click();
      await sincronizado(b);
      await sincronizarAgora(a);
      await expect(linha(a, t)).toHaveCount(0);
      await irPara(a, "Lixeira");
      await expect(linha(a, t)).toHaveCount(1);
      await a.context().close();
      await b.context().close();
    });

    test("5 e 6. offline nos dois: campos diferentes viram os dois; a fila sobe quando a conexão volta", async ({
      browser,
    }) => {
      const t = `conflito ${unico()}`;
      const a = await novoAparelho(browser);
      const b = await novoAparelho(browser);
      await entrar(a);
      await entrar(b);
      await sincronizado(a);
      await sincronizado(b);
      await a.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Tarefas" }).click();
      await criarTarefa(a, `${t} amanhã`);
      await sincronizado(a);
      await sincronizarAgora(b);
      await irPara(a, "Tudo");

      await a.context().setOffline(true);
      await b.context().setOffline(true);
      // Relógios andam (com o relógio parado, as edições empatariam no milissegundo e a criação venceria).
      await a.clock.setFixedTime(new Date(AGORA.getTime() + 60_000));
      await b.clock.setFixedTime(new Date(AGORA.getTime() + 120_000));
      // A muda a prioridade; B muda o título
      await a.getByRole("button", { name: `Abrir detalhes de "${t}"` }).click();
      await a.getByRole("dialog").getByLabel("Prioridade", { exact: true }).selectOption("3");
      await a.keyboard.press("Escape");
      await b.getByRole("button", { name: `Abrir detalhes de "${t}"` }).click();
      const titulo = b.getByRole("dialog").getByLabel("Título", { exact: true });
      await titulo.fill(`${t} (do B)`);
      await titulo.press("Enter");
      await b.keyboard.press("Escape");

      await expect(indicador(a)).toHaveAttribute("aria-label", /Offline · \d+ pendentes/, { timeout: 15_000 });

      await a.context().setOffline(false);
      await sincronizado(a); // voltou a conexão: subiu sozinho
      await b.context().setOffline(false);
      await sincronizado(b);
      await sincronizarAgora(a);
      for (const p of [a, b]) {
        await expect(linha(p, `${t} (do B)`)).toContainText("Prioridade alta");
      }
      await a.context().close();
      await b.context().close();
    });

    test("7. primeiro login envia o que já existia; exemplos nunca alterados não sobem", async ({ browser }) => {
      const t = `antes do login ${unico()}`;
      const a = await novoAparelho(browser);
      await criarTarefa(a, t);
      await a.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Finanças" }).click();
      await a.getByRole("button", { name: "Movimentações" }).click();
      await expect(a.locator("tbody tr")).toHaveCount(20); // exemplos
      await entrar(a);
      await sincronizado(a);

      const b = await novoAparelho(browser);
      await entrar(b);
      await sincronizado(b);
      await sincronizarAgora(b);
      await expect(linha(b, t)).toHaveCount(1);
      await b.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Finanças" }).click();
      await b.getByRole("button", { name: "Movimentações" }).click();
      await expect(b.locator("tbody tr")).toHaveCount(0); // nem os do A, nem exemplos novos no B
      await a.context().close();
      await b.context().close();
    });

    test("8. sessão vencida: avisa, guarda a fila e sobe ao entrar de novo", async ({ browser }) => {
      const t = `depois da sessão ${unico()}`;
      const a = await novoAparelho(browser);
      await entrar(a);
      await sincronizado(a);
      // a sessão some no servidor (como se tivesse vencido)
      await a.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));
      await a.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Tarefas" }).click();
      await criarTarefa(a, t);
      await expect(indicador(a)).toHaveAttribute("aria-label", "Conta: Entre de novo", { timeout: 15_000 });
      await indicador(a).click();
      await expect(a.getByText("Entre de novo para sincronizar")).toBeVisible();
      await expect(a.getByLabel("E-mail")).toHaveValue(EMAIL_E2E);
      await a.getByLabel("Senha").fill(SENHA_E2E);
      await a.getByRole("button", { name: "Entrar" }).click();
      await sincronizado(a);

      const b = await novoAparelho(browser);
      await entrar(b);
      await sincronizado(b);
      await sincronizarAgora(b);
      await expect(linha(b, t)).toHaveCount(1);
      await a.context().close();
      await b.context().close();
    });
  });
});
