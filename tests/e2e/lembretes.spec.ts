/** Objetivo 10 — lembretes (docs/project/escopo.md). O push em si é testado no projeto "pwa" (pwa.spec.ts). */
import { expect, test, type Page } from "@playwright/test";
import { abrir, abrirDetalhe, campo, criarTarefa, fecharDetalhe, irPara, linha, painel, titulos } from "./ajuda.ts";

/** Id de uma tarefa pelo título, lido direto do IndexedDB. */
const idDaTarefa = (page: Page, titulo: string) =>
  page.evaluate(
    (t) =>
      new Promise<string>((ok, erro) => {
        const req = indexedDB.open("ticktick");
        req.onerror = () => erro(req.error);
        req.onsuccess = () => {
          const q = req.result.transaction("tarefas").objectStore("tarefas").getAll();
          q.onsuccess = () => ok((q.result as Array<{ id: string; titulo: string }>).find((x) => x.titulo === t)!.id);
        };
      }),
    titulo,
  );

const botaoLembrete = (page: Page, nome: string) => painel(page).getByRole("button", { name: nome, exact: true });

test.describe("objetivo 10: lembretes", () => {
  test.beforeEach(async ({ page }) => {
    await abrir(page, "/");
  });

  test("2. com hora já vem 'na hora'; sem hora, sem lembrete", async ({ page }) => {
    await criarTarefa(page, "reunião amanhã 15h");
    await criarTarefa(page, "ler livro amanhã");
    await irPara(page, "Amanhã");
    await expect(linha(page, "reunião")).toContainText("Lembretes: na hora");
    await expect(linha(page, "ler livro")).not.toContainText("Lembretes");
  });

  test("1 e 3. escolher vários lembretes no painel; sino na lista; persiste", async ({ page }) => {
    await criarTarefa(page, "dentista amanhã 15h");
    await irPara(page, "Amanhã");
    await abrirDetalhe(page, "dentista");
    await expect(botaoLembrete(page, "na hora")).toHaveAttribute("aria-pressed", "true");
    await botaoLembrete(page, "1 dia antes").click();
    await botaoLembrete(page, "15 min antes").click();
    await expect(botaoLembrete(page, "15 min antes")).toHaveAttribute("aria-pressed", "true");
    await botaoLembrete(page, "na hora").click(); // desliga
    await expect(botaoLembrete(page, "na hora")).toHaveAttribute("aria-pressed", "false");
    await fecharDetalhe(page);
    await expect(linha(page, "dentista")).toContainText("Lembretes: 15 min antes, 1 dia antes");
    await page.reload();
    await irPara(page, "Amanhã");
    await expect(linha(page, "dentista")).toContainText("Lembretes: 15 min antes, 1 dia antes");
    // sem hora, a referência é 09:00 (critério 3): a tela explica
    await abrirDetalhe(page, "dentista");
    await campo(page, "Hora").fill("");
    await expect(painel(page).getByText("Sem hora, a referência é 09:00 do dia.")).toBeVisible();
  });

  test("lembrete precisa de data", async ({ page }) => {
    await criarTarefa(page, "sem data");
    await irPara(page, "Tudo");
    await abrirDetalhe(page, "sem data");
    await expect(botaoLembrete(page, "na hora")).toBeDisabled();
    await expect(painel(page).getByText("Escolha uma data para usar lembretes.")).toBeVisible();
  });

  test("7. 'Concluir' da notificação abre /?concluir=<id> e conclui (recorrente avança)", async ({ page }) => {
    await criarTarefa(page, "remédio todo dia 8h"); // amanhã 08:00 (hoje 8h já passou)
    await criarTarefa(page, "pagar conta hoje");
    const remedio = await idDaTarefa(page, "remédio");
    const conta = await idDaTarefa(page, "pagar conta");
    await page.goto(`/?concluir=${conta}`);
    await expect(page.getByText("Tarefa concluída")).toBeVisible();
    await expect(page).toHaveURL(/\/$/); // o parâmetro some do endereço
    await expect(titulos(page)).not.toContainText(["pagar conta"]);
    await page.goto(`/?concluir=${remedio}`);
    await expect(page.getByText("Tarefa concluída")).toBeVisible();
    await irPara(page, "Tudo");
    await expect(linha(page, "remédio")).toContainText("08:00");
    await expect(linha(page, "remédio")).not.toContainText("Amanhã"); // passou para depois de amanhã
  });

  test("tocar na notificação abre /?tarefa=<id> com o detalhe", async ({ page }) => {
    await criarTarefa(page, "reunião amanhã 15h");
    const id = await idDaTarefa(page, "reunião");
    await page.goto(`/?tarefa=${id}`);
    await expect(campo(page, "Título")).toHaveValue("reunião");
  });
});
