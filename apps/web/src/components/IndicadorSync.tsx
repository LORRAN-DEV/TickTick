/** Estado da sincronização no menu: leva para a página Conta. */
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Cloud, CloudOff, RefreshCw, UserRound } from "lucide-react";
import { useSync } from "@/db/sync/contexto";

export function IndicadorSync({ className }: { className: string }) {
  const { estado, pendentes, conta } = useSync();
  const ativo = { className: `${className} bg-muted text-foreground` };

  let icone = <UserRound className="h-4 w-4" aria-hidden />;
  let texto = "Conta";
  let detalhe: string | null = null;
  if (conta) {
    switch (estado) {
      case "sincronizando":
        icone = <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />;
        detalhe = "Sincronizando…";
        break;
      case "sincronizado":
        icone = <Cloud className="h-4 w-4 text-income" aria-hidden />;
        detalhe = pendentes ? `${pendentes} pendentes` : "Sincronizado";
        break;
      case "offline":
        icone = <CloudOff className="h-4 w-4" aria-hidden />;
        detalhe = pendentes ? `Offline · ${pendentes} pendentes` : "Offline";
        break;
      case "sessao-expirada":
      case "erro":
        icone = <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />;
        detalhe = estado === "erro" ? "Erro ao sincronizar" : "Entre de novo";
        break;
    }
    texto = "Conta";
  }

  return (
    <Link
      to="/conta"
      className={className}
      activeProps={ativo}
      aria-label={detalhe ? `Conta: ${detalhe}` : "Conta"}
      title={detalhe ?? undefined}
    >
      <span className="flex items-center gap-1.5">
        {icone}
        <span className="hidden sm:inline">{texto}</span>
        {detalhe && (
          <span className="hidden text-xs text-muted-foreground md:inline">· {detalhe}</span>
        )}
      </span>
    </Link>
  );
}
