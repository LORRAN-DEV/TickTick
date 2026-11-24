/** Objetivo 1 — finanças guardadas no navegador (docs/project/escopo.md). */
import { expect, test, type Page } from "@playwright/test";
import { abrir, vigiarErros } from "./ajuda.ts";

const irMovimentacoes = async (page: Page) => {
  await page.getByRole("button", { name: "Movimentações" }).click();
  await expect(page.getByRole("button", { name: /Nova movimentação/ })).toBeVisible();
};
const linhas = (page: Page) => page.locator("tbody tr");

async function novaMovimentacao(page: Page, descricao: string, valor: string) {
  await page.getByRole("button", { name: /Nova movimentação/ }).click();
  await page.getByPlaceholder("Descrição").fill(descricao);
  await page.getByPlaceholder("Valor (R$)").fill(valor);
  await page.getByRole("button", { name: /Salvar/ }).click();
  await expect(page.getByRole("cell", { name: descricao })).toBeVisible();
}

test.describe("objetivo 1: finanças no navegador", () => {
  test.beforeEach(async ({ page }) => {
    await abrir(page, "/financas");
    await irMovimentacoes(page);
  });

  test("5. primeira abertura mostra os exemplos; 'Começar do zero' não os traz de volta", async ({ page }) => {
    await expect(linhas(page)).toHaveCount(20);
    await page.getByRole("button", { name: "Como usar" }).click();
    await page.getByRole("button", { name: /Começar do zero/ }).click();
    await expect(page.getByText("Dados apagados")).toBeVisible(); // gravou
    await page.reload();
    await irMovimentacoes(page);
    await expect(linhas(page)).toHaveCount(0);
  });

  test("1. movimentação continua depois de recarregar (valor em formato brasileiro)", async ({ page }) => {
    const erros = vigiarErros(page);
    await novaMovimentacao(page, "Padaria", "1.234,56");
    await page.reload();
    await irMovimentacoes(page);
    await expect(linhas(page)).toHaveCount(21);
    await expect(page.locator("tr", { hasText: "Padaria" })).toContainText("R$ 1.234,56");
    expect(erros).toEqual([]);
  });

  test("2 e 3. status pago se mantém; apagada não volta", async ({ page }) => {
    await novaMovimentacao(page, "Feira", "40");
    const feira = page.locator("tr", { hasText: "Feira" });
    await feira.getByRole("button", { name: "Sim" }).click();
    await expect(feira.getByRole("button", { name: "Não" })).toBeVisible(); // gravou
    await page.reload();
    await irMovimentacoes(page);
    await expect(feira.getByRole("button", { name: "Não" })).toBeVisible();
    await feira.getByRole("button").last().click();
    await expect(feira).toHaveCount(0);
    await page.reload();
    await irMovimentacoes(page);
    await expect(linhas(page)).toHaveCount(20);
  });

  test("4. aporte na meta se mantém", async ({ page }) => {
    await page.getByRole("button", { name: "Metas" }).click();
    await page.getByRole("button", { name: /\+ R\$\s500/ }).first().click();
    await expect(page.getByText(/R\$\s6\.700,00 de R\$\s15\.000,00/)).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Metas" }).click();
    await expect(page.getByText(/R\$\s6\.700,00 de R\$\s15\.000,00/)).toBeVisible();
  });

  test("6. grava sem internet", async ({ page, context }) => {
    await context.setOffline(true);
    await novaMovimentacao(page, "Sem rede", "10");
    await context.setOffline(false);
    await page.reload();
    await irMovimentacoes(page);
    await expect(page.getByRole("cell", { name: "Sem rede" })).toBeVisible();
  });
});
