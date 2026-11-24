/** Objetivo 5 — PWA (docs/project/escopo.md). Roda no projeto "pwa", com service worker ligado. */
import { cpSync, mkdirSync, appendFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { abrir, criarTarefa } from "./ajuda.ts";

const aqui = fileURLToPath(new URL(".", import.meta.url));
const build = resolve(aqui, "../../apps/web/dist/client");
const tmp = resolve(aqui, "../.tmp");
const arquivoRaiz = resolve(tmp, "raiz.txt");

test.describe("objetivo 5: PWA", () => {
  test.afterEach(() => rmSync(arquivoRaiz, { force: true }));
  test.afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  test("1 e 3. manifesto, ícones, instalável e aviso de pronto offline", async ({ page, context }) => {
    await abrir(page, "/");
    const man = await page.evaluate(async () => {
      const href = document.querySelector<HTMLLinkElement>("link[rel=manifest]")!.href;
      return (await fetch(href)).json();
    });
    expect(man).toMatchObject({ name: "TickTick", display: "standalone", start_url: "/" });
    expect(man.theme_color).toBeTruthy();
    const larguras: number[] = [];
    for (const i of man.icons as Array<{ src: string }>) {
      larguras.push(
        await page.evaluate(async (src) => {
          const im = new Image();
          im.src = src;
          await im.decode();
          return im.naturalWidth;
        }, i.src),
      );
    }
    expect(larguras).toEqual([192, 512, 512]);
    expect(man.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);

    await expect(page.getByText("Pronto para usar sem internet")).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    // "in-incognito": o Chromium de teste roda em modo anônimo, onde nunca se instala app; nada a ver com o app.
    expect(installabilityErrors.filter((e) => e.errorId !== "in-incognito")).toEqual([]);
  });

  test("2. sem internet, as rotas abrem o app com os dados", async ({ page, context }) => {
    await abrir(page, "/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await criarTarefa(page, "antes de ficar offline hoje");
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("button", { name: 'Abrir detalhes de "antes de ficar offline"' })).toBeVisible();
    await page.goto("/financas");
    await expect(page.getByRole("heading", { name: "Controle Financeiro" })).toBeVisible();
    await page.goto("/rota/que/nao/existe");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await context.setOffline(false);
  });

  test("4 e 6. nova versão: aviso, só troca ao clicar em Atualizar, dados intactos", async ({ page }) => {
    // Duas cópias do build; a segunda com o sw.js alterado, como se fosse uma versão nova publicada.
    mkdirSync(tmp, { recursive: true });
    const v1 = resolve(tmp, "v1");
    const v2 = resolve(tmp, "v2");
    rmSync(v1, { recursive: true, force: true });
    rmSync(v2, { recursive: true, force: true });
    cpSync(build, v1, { recursive: true });
    cpSync(build, v2, { recursive: true });
    appendFileSync(resolve(v2, "sw.js"), "\n// versão 2 (teste)\n");
    writeFileSync(arquivoRaiz, v1);

    await abrir(page, "/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await criarTarefa(page, "feita na versão 1 hoje");

    writeFileSync(arquivoRaiz, v2);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await expect(page.getByText("Nova versão disponível")).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByText("Nova versão disponível")).toBeVisible(); // não recarregou sozinho

    const recarregou = page.waitForEvent("framenavigated");
    await page.getByRole("button", { name: "Atualizar" }).click();
    await recarregou;
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const r = await navigator.serviceWorker.getRegistration();
          return !!navigator.serviceWorker.controller && !r?.waiting;
        }),
      )
      .toBe(true);
    await expect(page.getByRole("button", { name: 'Abrir detalhes de "feita na versão 1"' })).toBeVisible();
  });

  test("5. botão Instalar só com o convite do navegador", async ({ page }) => {
    await abrir(page, "/");
    const botao = page.getByRole("button", { name: "Instalar" });
    await expect(botao).toHaveCount(0);
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & Record<string, unknown>;
      e.prompt = async () => {
        (window as unknown as { pediu: boolean }).pediu = true;
      };
      e.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(e);
    });
    await expect(botao).toBeVisible();
    await botao.click();
    await expect(botao).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { pediu?: boolean }).pediu)).toBe(true);
  });

  test("objetivo 10, 5 e 7. push de lembrete mostra a notificação com Concluir e Adiar", async ({ page, context }) => {
    await abrir(page, "/");
    await context.grantPermissions(["notifications"], { origin: new URL(page.url()).origin });
    await page.evaluate(() => navigator.serviceWorker.ready);
    const cdp = await context.newCDPSession(page);
    const origem = new URL(page.url()).origin;
    const registros = new Map<string, boolean>(); // id → ativo (não apagado, da origem do app)
    cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => {
      for (const r of e.registrations) registros.set(r.registrationId, !r.isDeleted && r.scopeURL === `${origem}/`);
    });
    const versoes = new Map<string, string>(); // registrationId → status da versão ativa
    cdp.on("ServiceWorker.workerVersionUpdated", (e) => {
      for (const v of e.versions) if (v.status === "activated") versoes.set(v.registrationId, v.status);
    });
    await cdp.send("ServiceWorker.enable");
    const registroAtivo = () => [...registros].find(([id, ok]) => ok && versoes.has(id))?.[0];
    await expect.poll(registroAtivo).toBeTruthy();
    const entregar = () =>
      cdp.send("ServiceWorker.deliverPushMessage", {
        origin: origem,
        registrationId: registroAtivo()!,
        data: JSON.stringify({
          tipo: "lembrete",
          titulo: "reunião",
          corpo: "Hoje às 15:00",
          tarefaId: "t123",
          tag: "lembrete-t123",
        }),
      });
    const notificacoes = () =>
      page.evaluate(async () =>
        (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({
          titulo: n.title,
          corpo: n.body,
          tag: n.tag,
          acoes: (n as Notification & { actions?: Array<{ action: string; title: string }> }).actions?.map(
            (a) => a.title,
          ),
          dados: n.data,
        })),
      );
    // Entrega o push; se ainda não apareceu (o worker acabou de ativar), entrega de novo. A tag evita duplicar.
    await expect
      .poll(async () => {
        if (!(await notificacoes()).length) await entregar();
        return (await notificacoes()).length;
      }, { timeout: 15_000, intervals: [500, 1000, 2000] })
      .toBe(1);
    await expect.poll(notificacoes).toEqual([
      {
        titulo: "reunião",
        corpo: "Hoje às 15:00",
        tag: "lembrete-t123",
        acoes: ["Concluir", "Adiar 10 min"],
        dados: { tarefaId: "t123" },
      },
    ]);
  });
});
