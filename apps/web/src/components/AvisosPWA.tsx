/**
 * PWA no navegador: registra o service worker (só no build de produção), avisa quando o app
 * já abre sem internet e quando há versão nova, e oferece o botão "Instalar".
 */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Workbox } from "workbox-window";

/** Registra o service worker e mostra os avisos. Não desenha nada. */
export function AvisosPWA() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    const wb = new Workbox("/sw.js");

    wb.addEventListener("installed", (e) => {
      if (!e.isUpdate) toast.success("Pronto para usar sem internet");
    });
    // Versão nova esperando: só troca quando o usuário pedir, para não perder o que está digitando.
    wb.addEventListener("waiting", () => {
      wb.addEventListener("controlling", () => window.location.reload());
      toast("Nova versão disponível", {
        duration: Infinity,
        action: { label: "Atualizar", onClick: () => wb.messageSkipWaiting() },
      });
    });

    // Sem service worker (navegador bloqueia, modo privado...) o app funciona igual, só não abre offline.
    wb.register().catch((e) =>
      console.warn("Service worker indisponível; o app não abrirá sem internet", e),
    );
  }, []);
  return null;
}

/** O evento que o Chrome/Edge disparam quando o app pode ser instalado (ainda fora do padrão do TS). */
type EventoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/** Botão "Instalar": só aparece quando o navegador oferece a instalação. */
export function BotaoInstalar() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);

  useEffect(() => {
    const oferecer = (e: Event) => {
      e.preventDefault(); // guarda o convite para mostrar no nosso botão
      setEvento(e as EventoInstalar);
    };
    const instalado = () => setEvento(null);
    window.addEventListener("beforeinstallprompt", oferecer);
    window.addEventListener("appinstalled", instalado);
    return () => {
      window.removeEventListener("beforeinstallprompt", oferecer);
      window.removeEventListener("appinstalled", instalado);
    };
  }, []);

  if (!evento) return null;
  return (
    <button
      onClick={async () => {
        await evento.prompt();
        await evento.userChoice;
        setEvento(null); // o convite só vale uma vez
      }}
      className="ml-auto flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
    >
      <Download className="h-4 w-4" aria-hidden />
      Instalar
    </button>
  );
}
