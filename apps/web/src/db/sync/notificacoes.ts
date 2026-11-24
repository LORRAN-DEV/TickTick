/** Notificações neste aparelho (ADR 0008): permissão, inscrição Web Push e teste. */
import { apiPadrao, chamarJson, type Api } from "./api";

export type EstadoNotificacoes =
  | "sem-suporte" // navegador sem Push API
  | "sem-service-worker" // ex.: `pnpm dev`, ou certificado não confiável
  | "bloqueadas" // a pessoa negou a permissão
  | "desativadas"
  | "ativadas";

export class PermissaoNegadaError extends Error {
  constructor() {
    super("O navegador não deu permissão para notificações");
    this.name = "PermissaoNegadaError";
  }
}

const suportado = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

async function registro(): Promise<ServiceWorkerRegistration | null> {
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function estadoNotificacoes(): Promise<EstadoNotificacoes> {
  if (!suportado()) return "sem-suporte";
  if (Notification.permission === "denied") return "bloqueadas";
  const r = await registro();
  if (!r) return "sem-service-worker";
  const sub = await r.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "ativadas" : "desativadas";
}

function bytesDaChave(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Nome curto do aparelho, só para a pessoa reconhecer na lista (sem identificar nada além disso). */
export function nomeDoAparelho(ua: string = navigator.userAgent): string {
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iPhone/iPad";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Navegador";
}

/** Pede permissão, inscreve este aparelho no Web Push e avisa o servidor (com o fuso do aparelho). */
export async function ativarNotificacoes(api: Api = apiPadrao): Promise<void> {
  if (!suportado()) throw new Error("Este navegador não recebe notificações");
  if ((await Notification.requestPermission()) !== "granted") throw new PermissaoNegadaError();
  const r = await navigator.serviceWorker.ready;
  const { chave } = await chamarJson<{ chave: string }>(api, "/api/push/chave");
  const opcoes = { userVisibleOnly: true, applicationServerKey: bytesDaChave(chave) };
  let sub: PushSubscription;
  try {
    sub = (await r.pushManager.getSubscription()) ?? (await r.pushManager.subscribe(opcoes));
  } catch {
    // Inscrição antiga com outra chave do servidor: refaz.
    await (await r.pushManager.getSubscription())?.unsubscribe();
    sub = await r.pushManager.subscribe(opcoes);
  }
  await chamarJson(api, "/api/push/assinaturas", {
    method: "POST",
    body: JSON.stringify({
      ...sub.toJSON(),
      fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
      aparelho: nomeDoAparelho(),
    }),
  });
}

export async function desativarNotificacoes(api: Api = apiPadrao): Promise<void> {
  const sub = await (await registro())?.pushManager.getSubscription();
  if (!sub) return;
  await chamarJson(api, "/api/push/assinaturas", {
    method: "DELETE",
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

export async function enviarTeste(api: Api = apiPadrao): Promise<number> {
  const r = await chamarJson<{ enviados: number }>(api, "/api/push/teste", { method: "POST" });
  return r.enviados;
}
