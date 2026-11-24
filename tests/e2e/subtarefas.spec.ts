/** Objetivo 4 — subtarefas e checklist (docs/project/escopo.md). */
import { expect, test, type Page } from "@playwright/test";
import { abrir, abrirDetalhe, campo, criarTarefa, fecharDetalhe, irPara, linha, painel, titulos } from "./ajuda.ts";

async function novaSub(page: Page, texto: string) {
  const c = painel(page).getByLabel("Adicionar subtarefa");
  await c.fill(texto);
  await c.press("Enter");
  await expect(c).toHaveValue("");
}
async function novoItem(page: Page, texto: string) {
  const c = painel(page).getByLabel("Adicionar item");
  await c.fill(texto);
  await c.press("Enter");
  await expect(c).toHaveValue("");
}
const abrirSub = (page: Page, titulo: string) =>
  painel(page).getByRole("button", { name: `Abrir subtarefa "${titulo}"` }).click();
const textosItens = (page: Page) =>
  painel(page).getByRole("textbox", { name: /^Texto do item/ }).evaluateAll((es) => es.map((e) => (e as HTMLInputElement).value));

test.describe("objetivo 4: subtarefas e checklist", () => {
  test.beforeEach(async ({ page }) => {
    await abrir(page, "/");
    await criarTarefa(page, "pintar a sala ~casa");
    await irPara(page, "Tudo");
    await abrirDetalhe(page, "pintar a sala");
  });

  test("1 e 2. subtarefa pelo quick-add, na lista da mãe; abrir e voltar", async ({ page }) => {
    await novaSub(page, "comprar tinta amanhã !alta ~trabalho");
    await novaSub(page, "lixar parede");
    await expect(painel(page).getByText("Subtarefas (0/2)")).toBeVisible();
    await abrirSub(page, "comprar tinta");
    await expect(campo(page, "Título")).toHaveValue("comprar tinta");
    await expect(campo(page, "Lista").locator("option:checked")).toHaveText("casa");
    await expect(campo(page, "Prioridade")).toHaveValue("3");
    await painel(page).getByRole("button", { name: "Voltar para “pintar a sala”" }).click();
    await expect(campo(page, "Título")).toHaveValue("pintar a sala");
  });

  test("3. até o 5º nível", async ({ page }) => {
    let atual = "pintar a sala";
    for (let n = 2; n <= 5; n++) {
      await novaSub(page, `nível ${n}`);
      await abrirSub(page, `nível ${n}`);
      atual = `nível ${n}`;
    }
    await expect(campo(page, "Título")).toHaveValue(atual);
    await expect(painel(page).getByLabel("Adicionar subtarefa")).toHaveCount(0);
    await expect(painel(page).getByText(/vão até o 5º nível/)).toBeVisible();
  });

  test("4. progresso na lista; subtarefas fora de Tudo e da lista; com data, em Amanhã indicando a mãe", async ({ page }) => {
    await novaSub(page, "comprar tinta amanhã");
    await novaSub(page, "lixar parede");
    await painel(page).getByRole("checkbox", { name: 'Concluir subtarefa "lixar parede"' }).click();
    await fecharDetalhe(page);
    await expect(linha(page, "pintar a sala")).toContainText("Subtarefas: 1/2");
    await expect(titulos(page)).toHaveText(["pintar a sala"]);
    await irPara(page, "casa");
    await expect(titulos(page)).toHaveText(["pintar a sala"]);
    await irPara(page, "Amanhã");
    await expect(linha(page, "comprar tinta")).toContainText("↳ pintar a sala");
  });

  test("5. concluir a mãe conclui as filhas; reabrir a mãe não reabre as filhas", async ({ page }) => {
    await novaSub(page, "comprar tinta");
    await novaSub(page, "lixar parede");
    await painel(page).getByRole("button", { name: "Concluir", exact: true }).click();
    await irPara(page, "Concluídas");
    await expect(titulos(page)).toContainText(["pintar a sala", "comprar tinta", "lixar parede"]);
    await page.getByRole("button", { name: 'Reabrir "pintar a sala"' }).click();
    await irPara(page, "Tudo");
    await abrirDetalhe(page, "pintar a sala");
    await expect(painel(page).getByText("Subtarefas (2/2)")).toBeVisible();
  });

  test("6 e 7. lixeira e mudar de lista levam as filhas", async ({ page }) => {
    await novaSub(page, "comprar tinta amanhã");
    await campo(page, "Lista").selectOption({ label: "Inbox" });
    await abrirSub(page, "comprar tinta");
    await expect(campo(page, "Lista").locator("option:checked")).toHaveText("Inbox");
    await painel(page).getByRole("button", { name: "Voltar para “pintar a sala”" }).click();
    await painel(page).getByRole("button", { name: "Mandar para a lixeira" }).click();
    await irPara(page, "Amanhã");
    await expect(titulos(page)).toHaveCount(0);
    await irPara(page, "Lixeira");
    await expect(titulos(page)).toHaveText(["pintar a sala"]);
    await page.getByRole("button", { name: 'Restaurar "pintar a sala"' }).click();
    await irPara(page, "Amanhã");
    await expect(titulos(page)).toHaveText(["comprar tinta"]);
  });

  test("8. mãe recorrente avança e reabre subtarefas e checklist", async ({ page }) => {
    await fecharDetalhe(page);
    await criarTarefa(page, "faxina todo dia");
    await abrirDetalhe(page, "faxina");
    await novaSub(page, "louça");
    await novoItem(page, "varrer");
    await painel(page).getByRole("checkbox", { name: 'Concluir subtarefa "louça"' }).click();
    await painel(page).getByRole("checkbox", { name: 'Marcar "varrer"' }).click();
    await expect(painel(page).getByText("Checklist (1/1)")).toBeVisible();
    await painel(page).getByRole("button", { name: "Concluir", exact: true }).click();
    await abrirDetalhe(page, "faxina");
    await expect(campo(page, "Data")).toHaveValue("2026-11-25");
    await expect(painel(page).getByText("Subtarefas (0/1)")).toBeVisible();
    await expect(painel(page).getByText("Checklist (0/1)")).toBeVisible();
  });

  test("9 a 12. checklist: adicionar em ordem, marcar, renomear e remover", async ({ page }) => {
    for (const i of ["fita crepe", "rolo", "lona"]) await novoItem(page, i);
    await expect(painel(page).getByLabel("Adicionar item")).toBeFocused();
    expect(await textosItens(page)).toEqual(["fita crepe", "rolo", "lona"]);
    await painel(page).getByRole("checkbox", { name: 'Marcar "rolo"' }).click();
    await expect(painel(page).getByText("Checklist (1/3)")).toBeVisible();
    const lona = painel(page).getByRole("textbox", { name: 'Texto do item "lona"' });
    await lona.fill("lona plástica");
    await lona.press("Enter");
    const fita = painel(page).getByRole("textbox", { name: 'Texto do item "fita crepe"' });
    await fita.fill("");
    await fita.press("Enter");
    await expect(page.getByText("O item não pode ficar vazio")).toBeVisible();
    await expect(fita).toHaveValue("fita crepe");
    await painel(page).getByRole("button", { name: 'Remover "fita crepe"' }).click();
    await expect.poll(() => textosItens(page)).toEqual(["rolo", "lona plástica"]);
    await fecharDetalhe(page);
    await expect(linha(page, "pintar a sala")).toContainText("Checklist: 1/2");
  });

  test("13. persiste ao recarregar e funciona sem internet", async ({ page, context }) => {
    await context.setOffline(true);
    await novaSub(page, "separar roupas");
    await novoItem(page, "carregador");
    await context.setOffline(false);
    await fecharDetalhe(page);
    await page.reload();
    await irPara(page, "Tudo");
    await expect(linha(page, "pintar a sala")).toContainText("Subtarefas: 0/1");
    await expect(linha(page, "pintar a sala")).toContainText("Checklist: 0/1");
  });
});
