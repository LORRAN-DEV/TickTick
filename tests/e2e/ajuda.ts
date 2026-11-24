/** Ajudantes comuns aos testes e2e. */
import { expect, type Page } from "@playwright/test";

/** Terça, 24/11/2026, 10:00 em São Paulo. Todos os testes partem daqui (critério 3 do objetivo 6). */
export const AGORA = new Date("2026-11-24T13:00:00Z");

/** Fixa o relógio e abre a página. */
export async function abrir(page: Page, caminho = "/", agora: Date = AGORA): Promise<void> {
  await page.clock.setFixedTime(agora);
  await page.goto(caminho);
}

/** Coleta erros do console e da página, para conferir no fim do teste. */
export function vigiarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  return erros;
}

// ---------------------------------------------------------------------------------------------
// Tarefas

export const quickAdd = (page: Page) => page.getByLabel("Nova tarefa");

export async function criarTarefa(page: Page, texto: string): Promise<void> {
  await quickAdd(page).fill(texto);
  await quickAdd(page).press("Enter");
  await expect(quickAdd(page)).toHaveValue("");
}

/** Vai para uma lista da barra lateral (inteligente ou comum) pelo nome. */
export async function irPara(page: Page, nome: string): Promise<void> {
  await page
    .getByRole("navigation", { name: "Listas" })
    .getByRole("button", { name: new RegExp(`^${nome}`) })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: nome })).toBeVisible();
}

/** Títulos das tarefas visíveis na lista aberta, na ordem. */
export const titulos = (page: Page) => page.locator("main ul li [data-titulo]");

/**
 * Linha de uma tarefa pelo título exato. Busca por texto, não por papel: com o painel de detalhe
 * aberto, o resto da página fica `aria-hidden` e some da árvore de acessibilidade.
 */
export const linha = (page: Page, titulo: string) =>
  page.locator("main ul > li").filter({
    has: page.locator("[data-titulo]", { hasText: new RegExp(`^${titulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }),
  });

export const painel = (page: Page) => page.getByRole("dialog");

export async function abrirDetalhe(page: Page, titulo: string): Promise<void> {
  await page.getByRole("button", { name: `Abrir detalhes de "${titulo}"` }).click();
  await expect(painel(page).getByLabel("Título", { exact: true })).toHaveValue(titulo);
}

export async function fecharDetalhe(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(painel(page)).toBeHidden();
}

export const campo = (page: Page, rotulo: string) => painel(page).getByLabel(rotulo, { exact: true });
