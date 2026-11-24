/** Seção de subtarefas do painel: lista as filhas diretas e cria novas pelo quick-add. */
import { useState, type FormEvent } from "react";
import { Ban, CheckCircle2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  filhas,
  hojeLocal,
  NIVEL_MAXIMO,
  podeTerSubtarefa,
  progressoSubtarefas,
  TituloVazioError,
  type Tarefa,
} from "@ticktick/core";
import { concluirTarefa, criarSubtarefa, NivelMaximoError, reabrirTarefa } from "@/db/tarefas";
import { rotuloData } from "@/lib/rotulos";

export function Subtarefas({
  mae,
  tarefas,
  onAbrir,
}: {
  mae: Tarefa;
  tarefas: Tarefa[];
  onAbrir: (id: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const lista = filhas(tarefas, mae.id);
  const { feitas, total } = progressoSubtarefas(tarefas, mae.id);
  const podeCriar = podeTerSubtarefa(tarefas, mae) && !mae.excluidoEm;
  const hoje = hojeLocal();

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    try {
      await criarSubtarefa(mae.id, texto);
      setTexto("");
    } catch (err) {
      if (err instanceof TituloVazioError) toast.error("Escreva o que é a subtarefa");
      else if (err instanceof NivelMaximoError) toast.error(err.message);
      else {
        console.error(err);
        toast.error("Não foi possível salvar neste navegador");
      }
    }
  };

  return (
    <section aria-labelledby="titulo-subtarefas" className="mt-6">
      <h3 id="titulo-subtarefas" className="text-xs font-medium text-muted-foreground">
        Subtarefas{total > 0 && ` (${feitas}/${total})`}
      </h3>
      {lista.length > 0 && (
        <ul className="mt-2 divide-y rounded-md border">
          {lista.map((f) => {
            const aberta = f.status === "aberta";
            return (
              <li key={f.id} className="flex items-center gap-2 px-2 py-1.5">
                <button
                  role="checkbox"
                  aria-checked={!aberta}
                  aria-label={`${aberta ? "Concluir" : "Reabrir"} subtarefa "${f.titulo}"`}
                  onClick={() =>
                    (aberta ? concluirTarefa(f.id) : reabrirTarefa(f.id)).catch(console.error)
                  }
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-muted-foreground"
                >
                  {f.status === "concluida" && <CheckCircle2 className="h-3 w-3" />}
                  {f.status === "nao_vou_fazer" && <Ban className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => onAbrir(f.id)}
                  className={`flex min-w-0 flex-1 items-center gap-2 text-left text-sm hover:underline ${aberta ? "" : "text-muted-foreground line-through"}`}
                  aria-label={`Abrir subtarefa "${f.titulo}"`}
                >
                  <span className="truncate">{f.titulo}</span>
                  {f.data && (
                    <span className="shrink-0 text-xs text-muted-foreground no-underline">
                      {rotuloData(f.data, hoje)}
                    </span>
                  )}
                  {progressoSubtarefas(tarefas, f.id).total > 0 && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {progressoSubtarefas(tarefas, f.id).feitas}/
                      {progressoSubtarefas(tarefas, f.id).total}
                    </span>
                  )}
                  <ChevronRight
                    className="ml-auto h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {podeCriar ? (
        <form onSubmit={enviar} className="mt-2">
          <label htmlFor="nova-subtarefa" className="sr-only">
            Adicionar subtarefa
          </label>
          <Input
            id="nova-subtarefa"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Adicionar subtarefa (aceita data, !prioridade, #tag)"
            autoComplete="off"
          />
        </form>
      ) : (
        !mae.excluidoEm && (
          <p className="mt-2 text-xs text-muted-foreground">
            Subtarefas vão até o {NIVEL_MAXIMO}º nível; esta já está no último.
          </p>
        )
      )}
    </section>
  );
}
