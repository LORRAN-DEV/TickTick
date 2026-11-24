/** Objetivo 2 — tela de tarefas com quick-add (docs/project/escopo.md). */
import { expect, test } from "@playwright/test";
import { abrir, criarTarefa, irPara, linha, quickAdd, titulos, vigiarErros } from "./ajuda.ts";

test.describe("objetivo 2: tarefas e quick-add", () => {
  test.beforeEach(async ({ page }) => {
    await abrir(page, "/");
  });

  test("9. Tarefas é a página inicial; o menu vai para Finanças e volta", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Hoje" })).toBeVisible();
    const menu = page.getByRole("navigation", { name: "Principal" });
    await menu.getByRole("link", { name: "Finanças" }).click();
    await expect(page).toHaveURL(/\/financas$/);
    await expect(page.getByRole("heading", { name: "Controle Financeiro" })).toBeVisible();
    await menu.getByRole("link", { name: "Tarefas" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Hoje" })).toBeVisible();
  });

  test("1 e 2. prévia do quick-add e tarefa criada com tudo reconhecido", async ({ page }) => {
    const erros = vigiarErros(page);
    await quickAdd(page).fill("pagar boleto amanhã 15h !alta #casa");
    const previa = page.locator("form [aria-live]");
    for (const trecho of ["Título: pagar boleto", "Data: amanhã", "Hora: 15h", "Prioridade: !alta", "Tag: #casa"]) {
      await expect(previa).toContainText(trecho);
    }
    await quickAdd(page).press("Enter");
    await expect(quickAdd(page)).toHaveValue("");
    await irPara(page, "Amanhã");
    const l = linha(page, "pagar boleto");
    for (const t of ["Amanhã 15:00", "Prioridade alta", "#casa", "~Inbox"]) await expect(l).toContainText(t);
    expect(erros).toEqual([]);
  });

  test("3. ~lista cria a lista uma vez; sem ~lista vai para a Inbox", async ({ page }) => {
    await criarTarefa(page, "reunião hoje 9h ~trabalho");
    await criarTarefa(page, "relatório ~Trabalho");
    await criarTarefa(page, "comprar pão");
    const listas = page.getByRole("navigation", { name: "Listas" });
    await expect(listas.getByRole("button", { name: /^trabalho/ })).toHaveCount(1);
    await irPara(page, "trabalho");
    await expect(titulos(page)).toHaveText(["reunião", "relatório"]);
    await irPara(page, "Inbox");
    await expect(titulos(page)).toHaveText(["comprar pão"]);
  });

  test("4. listas inteligentes e ordem; atrasadas no topo dois dias depois", async ({ page }) => {
    for (const t of ["reunião hoje 9h", "comprar pão hoje", "pagar boleto amanhã 15h", "academia toda segunda 7h", "ler livro"]) {
      await criarTarefa(page, t);
    }
    await expect(titulos(page).first()).toHaveText("reunião");
    await expect(titulos(page)).toHaveCount(2);
    await irPara(page, "Próximos 7 dias");
    await expect(titulos(page)).toHaveText(["reunião", "comprar pão", "pagar boleto", "academia"]);
    await irPara(page, "Tudo");
    await expect(titulos(page).last()).toHaveText("ler livro");

    await page.clock.setFixedTime(new Date("2026-11-26T13:00:00Z"));
    await page.reload();
    await expect(titulos(page)).toHaveText(["reunião", "comprar pão", "pagar boleto"]);
    await expect(page.locator("main ul > li", { hasText: "(atrasada)" })).toHaveCount(3);
  });

  test("5. concluir e reabrir", async ({ page }) => {
    await criarTarefa(page, "ligar pro banco hoje");
    await page.getByRole("checkbox", { name: 'Concluir "ligar pro banco"' }).click();
    await expect(titulos(page)).toHaveCount(0);
    await irPara(page, "Concluídas");
    await expect(titulos(page)).toHaveText(["ligar pro banco"]);
    await page.getByRole("button", { name: 'Reabrir "ligar pro banco"' }).click();
    await irPara(page, "Hoje");
    await expect(titulos(page)).toHaveText(["ligar pro banco"]);
  });

  test("6. recorrente avança para a próxima data e guarda cópia concluída", async ({ page }) => {
    await criarTarefa(page, "academia toda segunda 7h"); // 30/11
    await irPara(page, "Próximos 7 dias");
    await page.getByRole("checkbox", { name: 'Concluir "academia"' }).click();
    await irPara(page, "Tudo");
    await expect(linha(page, "academia")).toContainText("07/12/2026 07:00");
    await expect(linha(page, "academia")).toContainText("toda seg");
    await irPara(page, "Concluídas");
    await expect(linha(page, "academia")).toContainText("segunda");
  });

  test("7. lixeira e restaurar", async ({ page }) => {
    await criarTarefa(page, "apagar isso hoje");
    await page.getByRole("button", { name: 'Mandar "apagar isso" para a lixeira' }).click();
    await expect(titulos(page)).toHaveCount(0);
    await irPara(page, "Lixeira");
    await expect(titulos(page)).toHaveText(["apagar isso"]);
    await page.getByRole("button", { name: 'Restaurar "apagar isso"' }).click();
    await irPara(page, "Hoje");
    await expect(titulos(page)).toHaveText(["apagar isso"]);
  });

  test("8. persiste ao recarregar e grava sem internet", async ({ page, context }) => {
    await criarTarefa(page, "com rede hoje");
    await context.setOffline(true);
    await criarTarefa(page, "sem rede hoje");
    await context.setOffline(false);
    await page.reload();
    await expect(titulos(page)).toHaveText(["com rede", "sem rede"]);
  });

  test("título vazio é recusado com aviso; celular sem rolagem horizontal", async ({ page }) => {
    await quickAdd(page).fill("amanhã 15h");
    await quickAdd(page).press("Enter");
    await expect(page.getByText("Escreva o que é a tarefa")).toBeVisible();
    await page.setViewportSize({ width: 375, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
