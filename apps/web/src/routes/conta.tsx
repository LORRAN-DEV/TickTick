import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Cloud, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSync, type EstadoSync } from "@/db/sync/contexto";

export const Route = createFileRoute("/conta")({
  head: () => ({ meta: [{ title: "Conta — TickTick" }] }),
  component: PaginaConta,
});

const DESCRICAO: Record<EstadoSync, string> = {
  carregando: "Verificando…",
  "sem-conta": "Sem conta",
  sincronizando: "Sincronizando…",
  sincronizado: "Sincronizado",
  offline:
    "Sem conexão com o servidor. As mudanças ficam guardadas e sobem quando a conexão voltar.",
  "sessao-expirada": "Entre de novo para sincronizar. Nada do que você fez foi perdido.",
  erro: "Erro ao sincronizar",
};

function PaginaConta() {
  const sync = useSync();
  const logado = !!sync.conta && sync.estado !== "sessao-expirada";

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="font-display text-2xl font-bold">Conta</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Com uma conta, suas tarefas e finanças ficam iguais em todos os seus aparelhos. Sem conta,
        tudo fica só neste navegador.
      </p>
      {logado ? <Logado /> : <FormularioEntrar emailSugerido={sync.conta ?? ""} />}
    </main>
  );
}

function Logado() {
  const { conta, estado, pendentes, ultimoSync, ciclos, erro, sincronizarAgora, sair } = useSync();
  return (
    <Card className="mt-6 space-y-4 p-5" data-ciclos={ciclos} data-testid="conta">
      <div className="flex items-center gap-3">
        <Cloud className="h-6 w-6 text-primary" aria-hidden />
        <div>
          <p className="font-medium">{conta}</p>
          <p className="text-sm text-muted-foreground" role="status">
            {DESCRICAO[estado]}
            {estado === "erro" && erro ? `: ${erro}` : ""}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Mudanças pendentes</dt>
        <dd data-testid="pendentes">{pendentes}</dd>
        <dt className="text-muted-foreground">Última sincronização</dt>
        <dd>{ultimoSync ? ultimoSync.toLocaleTimeString("pt-BR") : "—"}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void sincronizarAgora()} disabled={estado === "sincronizando"}>
          <RefreshCw className={`h-4 w-4 ${estado === "sincronizando" ? "animate-spin" : ""}`} />
          Sincronizar agora
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            sair().then(
              () => toast.success("Você saiu. Os dados continuam neste aparelho."),
              (e) => {
                console.error(e);
                toast.error("Não foi possível sair agora");
              },
            )
          }
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </Card>
  );
}

function FormularioEntrar({ emailSugerido }: { emailSugerido: string }) {
  const { entrar, estado } = useSync();
  const [email, setEmail] = useState(emailSugerido);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      setSenha("");
      toast.success("Conectado. Sincronizando seus dados.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card className="mt-6 p-5">
      {estado === "sessao-expirada" && (
        <p className="mb-4 rounded-md bg-muted p-3 text-sm" role="status">
          {DESCRICAO["sessao-expirada"]}
        </p>
      )}
      <form onSubmit={enviar} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="senha" className="text-sm font-medium">
            Senha
          </label>
          <Input
            id="senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        {erro && (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">
        Ao entrar pela primeira vez neste aparelho, o que você já criou aqui é enviado para a conta.
        Os dados de exemplo que você nunca alterou não são enviados e saem deste aparelho.
      </p>
    </Card>
  );
}
