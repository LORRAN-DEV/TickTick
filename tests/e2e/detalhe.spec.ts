/** Objetivo 3 — detalhe da tarefa (docs/project/escopo.md). */
import { expect, test } from "@playwright/test";
import { abrir, abrirDetalhe, campo, criarTarefa, fecharDetalhe, irPara, linha, painel, titulos } from "./ajuda.ts";

test.describe("objetivo 3: detalhe da tarefa", () => {
  test.beforeEach(async ({ page }) => {
    await abrir(page, "/");
    await criarTarefa(page, "pagar boleto hoje 15h #casa");
    await criarTarefa(page, "reunião ~trabalho");
    await irPara(page, "Hoje");
  });

  test("1. painel abre preenchido; Esc fecha", async ({ page }) => {
    await abrirDetalhe(page, "pagar boleto");
    await expect(campo(page, "Data")).toHaveValue("2026-11-24");
    await expect(campo(page, "Hora")).toHaveValue("15:00");
    await expect(campo(page, "Tags")).toHaveValue("casa");
    await expect(campo(page, "Lista").locator("option:checked")).toHaveText("Inbox");
    await fecharDetalhe(page);
  });

  test("2 e 4. mudanças aparecem na hora, tags normalizadas e tudo persiste", async ({ page }) => {
    await abrirDetalhe(page, "pagar boleto");
    await campo(page, "Título").fill("pagar conta de luz");
    await campo(page, "Título").press("Enter");
    await campo(page, "Prioridade").selectOption("3");
    await campo(page, "Hora").fill("18:30");
    await campo(page, "Notas").fill("vence às 18h\nusar o app do banco");
    await campo(page, "Tags").click();
    await campo(page, "Tags").fill("casa, #Mercado urgente casa");
    await campo(page, "Notas").click();
    await expect(campo(page, "Tags")).toHaveValue("casa, mercado, urgente");
    await campo(page, "Lista").selectOption({ label: "trabalho" });
    const l = linha(page, "pagar conta de luz");
    for (const t of ["Hoje 18:30", "Prioridade alta", "#mercado", "~trabalho", "vence às 18h"]) await expect(l).toContainText(t);
    await fecharDetalhe(page);
    await page.reload();
    await abrirDetalhe(page, "pagar conta de luz");
    await expect(campo(page, "Hora")).toHaveValue("18:30");
    await expect(campo(page, "Prioridade")).toHaveValue("3");
    await expect(campo(page, "Notas")).toHaveValue("vence às 18h\nusar o app do banco");
  });

  test("3. título vazio volta ao anterior com aviso", async ({ page }) => {
    await abrirDetalhe(page, "pagar boleto");
    await campo(page, "Título").fill("   ");
    await campo(page, "Notas").click();
    await expect(campo(page, "Título")).toHaveValue("pagar boleto");
    await expect(page.getByText("O título não pode ficar vazio")).toBeVisible();
  });

  test("5, 6 e 7. data, hora e repetição ficam coerentes", async ({ page }) => {
    await abrirDetalhe(page, "pagar boleto");
    await campo(page, "Repetição").selectOption("diaria");
    await campo(page, "Data").fill("");
    await expect(campo(page, "Hora")).toBeDisabled();
    await expect(campo(page, "Hora")).toHaveValue("");
    await expect(campo(page, "Repetição")).toHaveValue("nenhuma");
    await campo(page, "Repetição").selectOption("semanal");
    await expect(campo(page, "Data")).toHaveValue("2026-11-24");
    await expect(campo(page, "Repetição").locator("option:checked")).toHaveText("Toda semana (toda ter)");
    await campo(page, "Data").fill("2026-11-27");
    await expect(campo(page, "Repetição").locator("option:checked")).toHaveText("Toda semana (toda sex)");
  });

  test("6. regra do quick-add aparece com o nome dela e continua valendo", async ({ page }) => {
    await criarTarefa(page, "academia toda segunda, quarta e sexta 7h");
    await irPara(page, "Próximos 7 dias");
    await abrirDetalhe(page, "academia");
    await expect(campo(page, "Repetição").locator("option:checked")).toHaveText("toda seg, qua, sex");
    await campo(page, "Título").fill("academia (musculação)");
    await campo(page, "Título").press("Enter");
    await expect(campo(page, "Repetição").locator("option:checked")).toHaveText("toda seg, qua, sex");
  });

  test("8. concluir e lixeira pelo painel fecham o painel", async ({ page }) => {
    await criarTarefa(page, "academia toda segunda, quarta e sexta 7h"); // qua 25/11
    await irPara(page, "Próximos 7 dias");
    await abrirDetalhe(page, "academia");
    await painel(page).getByRole("button", { name: "Concluir", exact: true }).click();
    await expect(painel(page)).toBeHidden();
    await expect(linha(page, "academia")).toContainText("sexta 07:00");
    await irPara(page, "Tudo");
    await abrirDetalhe(page, "reunião");
    await painel(page).getByRole("button", { name: "Mandar para a lixeira" }).click();
    await expect(painel(page)).toBeHidden();
    await expect(titulos(page)).not.toContainText(["reunião"]);
  });

  test("painel cabe no celular", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await abrirDetalhe(page, "pagar boleto");
    const caixa = await painel(page).boundingBox();
    expect(caixa!.x).toBeGreaterThanOrEqual(0);
    expect(caixa!.width).toBeLessThanOrEqual(375);
  });
});
