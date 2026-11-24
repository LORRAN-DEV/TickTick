/* Notificações (ADR 0008). Importado pelo service worker gerado pelo Workbox (scripts/gerar-sw.mjs). */
/* global self, clients */

self.addEventListener("push", (evento) => {
  let d = {};
  try {
    d = evento.data ? evento.data.json() : {};
  } catch {
    d = { titulo: "TickTick", corpo: evento.data ? evento.data.text() : "" };
  }
  const lembrete = d.tipo === "lembrete" && d.tarefaId;
  // O navegador exige mostrar a notificação logo que o push chega.
  evento.waitUntil(
    self.registration.showNotification(d.titulo || "TickTick", {
      body: d.corpo || "",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { tarefaId: d.tarefaId || null },
      actions: lembrete
        ? [
            { action: "concluir", title: "Concluir" },
            { action: "adiar", title: "Adiar 10 min" },
          ]
        : [],
    }),
  );
});

async function abrir(url) {
  const janelas = await clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const janela of janelas) {
    try {
      await janela.navigate(url);
      return janela.focus();
    } catch {
      /* janela que não dá para navegar: abre outra */
    }
  }
  return clients.openWindow(url);
}

async function adiar(tarefaId) {
  try {
    const r = await fetch("/api/lembretes/adiar", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tarefaId, minutos: 10 }),
    });
    if (!r.ok) throw new Error(String(r.status));
  } catch {
    await self.registration.showNotification("Não deu para adiar", {
      body: "Sem conexão com o servidor. Abra o app para conferir a tarefa.",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { tarefaId },
    });
  }
}

self.addEventListener("notificationclick", (evento) => {
  const id = evento.notification.data && evento.notification.data.tarefaId;
  evento.notification.close();
  if (evento.action === "adiar" && id) {
    evento.waitUntil(adiar(id));
    return;
  }
  const url = !id
    ? "/"
    : evento.action === "concluir"
      ? `/?concluir=${encodeURIComponent(id)}`
      : `/?tarefa=${encodeURIComponent(id)}`;
  evento.waitUntil(abrir(url));
});
