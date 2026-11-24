/**
 * Painel de detalhe de uma tarefa. Salva sozinho: textos ao sair do campo (ou Enter no título),
 * seletores, data e hora ao mudar. As regras de coerência ficam em `editarTarefa` (core).
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import { Ban, Bell, CheckCircle2, CornerLeftUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  descreverRegra,
  hojeLocal,
  HoraInvalidaError,
  NOMES_REPETICAO,
  normalizarTags,
  regraDaRepeticao,
  REPETICOES_PRONTAS,
  LEMBRETES_PRONTOS,
  alternarLembrete,
  descreverLembrete,
  repeticaoDaRegra,
  TituloVazioError,
  type ItemChecklist,
  type Lista,
  type MudancasTarefa,
  type Priority,
  type RepeticaoPronta,
  type Tarefa,
} from "@ticktick/core";
import { atualizarTarefa, concluirTarefa, moverParaLixeira } from "@/db/tarefas";
import { NOMES_PRIORIDADE } from "@/lib/rotulos";
import { Checklist } from "./Checklist";
import { Subtarefas } from "./Subtarefas";

const seletor =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm disabled:opacity-50";

export function DetalheTarefa({
  tarefa,
  tarefas,
  listas,
  itens,
  onAbrir,
  onFechar,
}: {
  tarefa: Tarefa | null;
  tarefas: Tarefa[];
  listas: Lista[];
  itens: ItemChecklist[];
  onAbrir: (id: string) => void;
  onFechar: () => void;
}) {
  return (
    <Sheet open={!!tarefa} onOpenChange={(aberto) => !aberto && onFechar()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        {tarefa && (
          <Campos
            key={tarefa.id}
            t={tarefa}
            tarefas={tarefas}
            listas={listas}
            itens={itens}
            onAbrir={onAbrir}
            onFechar={onFechar}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Campos({
  t,
  tarefas,
  listas,
  itens,
  onAbrir,
  onFechar,
}: {
  t: Tarefa;
  tarefas: Tarefa[];
  listas: Lista[];
  itens: ItemChecklist[];
  onAbrir: (id: string) => void;
  onFechar: () => void;
}) {
  const mae = t.paiId ? tarefas.find((x) => x.id === t.paiId) : undefined;
  const aberta = t.status === "aberta" && !t.excluidoEm;
  const repeticao = repeticaoDaRegra(t.rrule, t.data);

  /** Grava; em caso de erro de validação, avisa e devolve false para o campo desfazer. */
  const salvar = async (m: MudancasTarefa): Promise<boolean> => {
    try {
      await atualizarTarefa(t.id, m);
      return true;
    } catch (e) {
      if (e instanceof TituloVazioError) toast.error("O título não pode ficar vazio");
      else if (e instanceof HoraInvalidaError) toast.error("Hora inválida");
      else {
        console.error(e);
        toast.error("Não foi possível salvar neste navegador");
      }
      return false;
    }
  };

  return (
    <>
      <SheetHeader className="pr-8">
        {mae && (
          <button
            onClick={() => onAbrir(mae.id)}
            className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            <CornerLeftUp className="h-3.5 w-3.5" aria-hidden />
            Voltar para “{mae.titulo}”
          </button>
        )}
        <SheetTitle className="sr-only">Detalhe da tarefa</SheetTitle>
        <SheetDescription className="sr-only">
          As mudanças são salvas automaticamente.
        </SheetDescription>
        <CampoTexto
          rotulo="Título"
          valor={t.titulo}
          onSalvar={(v) => salvar({ titulo: v })}
          render={(props) => <Input {...props} className="h-11 text-base font-semibold" />}
        />
      </SheetHeader>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Campo rotulo="Data">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={t.data ?? ""}
              onChange={(e) => salvar({ data: e.target.value || null })}
            />
          )}
        </Campo>
        <Campo rotulo="Hora">
          {(id) => (
            <Input
              id={id}
              type="time"
              value={t.hora ?? ""}
              disabled={!t.data}
              title={t.data ? undefined : "Escolha uma data primeiro"}
              onChange={(e) => salvar({ hora: e.target.value || null })}
            />
          )}
        </Campo>
        <Campo rotulo="Prioridade">
          {(id) => (
            <select
              id={id}
              className={seletor}
              value={t.prioridade}
              onChange={(e) => salvar({ prioridade: Number(e.target.value) as Priority })}
            >
              {([3, 2, 1, 0] as const).map((p) => (
                <option key={p} value={p}>
                  {NOMES_PRIORIDADE[p]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Lista">
          {(id) => (
            <select
              id={id}
              className={seletor}
              value={t.listaId}
              onChange={(e) => salvar({ listaId: e.target.value })}
            >
              {listas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <div className="col-span-2">
          <Campo rotulo="Repetição">
            {(id) => (
              <select
                id={id}
                className={seletor}
                value={repeticao}
                onChange={(e) => {
                  const r = e.target.value as RepeticaoPronta;
                  salvar({ rrule: regraDaRepeticao(r, t.data ?? hojeLocal()) });
                }}
              >
                {REPETICOES_PRONTAS.map((r) => (
                  <option key={r} value={r}>
                    {NOMES_REPETICAO[r]}
                    {t.data && (r === "semanal" || r === "mensal")
                      ? ` (${descreverRegra(regraDaRepeticao(r, t.data)!)})`
                      : ""}
                  </option>
                ))}
                {repeticao === "personalizada" && (
                  <option value="personalizada" disabled>
                    {descreverRegra(t.rrule!)}
                  </option>
                )}
              </select>
            )}
          </Campo>
        </div>
        <div className="col-span-2">
          <Lembretes t={t} salvar={salvar} />
        </div>
        <div className="col-span-2">
          <CampoTexto
            rotulo="Tags"
            dica="Separe por vírgula ou espaço"
            valor={t.tags.join(", ")}
            onSalvar={(v) => salvar({ tags: normalizarTags(v) })}
            render={(props) => <Input {...props} placeholder="casa, mercado" />}
          />
        </div>
        <div className="col-span-2">
          <CampoTexto
            rotulo="Notas"
            valor={t.notas ?? ""}
            multilinha
            onSalvar={(v) => salvar({ notas: v })}
            render={(props) => (
              <Textarea {...props} rows={6} placeholder="Detalhes, links, o que for preciso" />
            )}
          />
        </div>
      </div>

      <Subtarefas mae={t} tarefas={tarefas} onAbrir={onAbrir} />
      <Checklist tarefaId={t.id} itens={itens} />

      <SheetFooter className="mt-6 flex-row flex-wrap gap-2 sm:justify-between">
        <div className="flex gap-2">
          {aberta && (
            <Button
              onClick={async () => {
                onFechar();
                await concluirTarefa(t.id).catch((e) => console.error(e));
                toast.success(
                  t.rrule ? "Concluída; próxima ocorrência agendada" : "Tarefa concluída",
                );
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> Concluir
            </Button>
          )}
          {aberta && (
            <Button
              variant="outline"
              onClick={async () => {
                onFechar();
                await concluirTarefa(t.id, "nao_vou_fazer").catch((e) => console.error(e));
              }}
            >
              <Ban className="h-4 w-4" /> Não vou fazer
            </Button>
          )}
          {!t.excluidoEm && (
            <Button
              variant="ghost"
              aria-label="Mandar para a lixeira"
              title="Mandar para a lixeira"
              onClick={async () => {
                onFechar();
                await moverParaLixeira(t.id).catch((e) => console.error(e));
                toast.success("Movida para a lixeira");
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button variant="outline" onClick={onFechar}>
          Fechar
        </Button>
      </SheetFooter>
    </>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {rotulo}
      </label>
      {children(id)}
    </div>
  );
}

type PropsEditavel = {
  id: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
};

/**
 * Campo de texto com rascunho: grava ao sair do campo (ou Enter, se não for multilinha).
 * Se a gravação for recusada, volta ao valor salvo. Acompanha mudanças vindas do banco.
 */
function CampoTexto({
  rotulo,
  dica,
  valor,
  multilinha = false,
  onSalvar,
  render,
}: {
  rotulo: string;
  dica?: string;
  valor: string;
  multilinha?: boolean;
  onSalvar: (v: string) => Promise<boolean>;
  render: (props: PropsEditavel) => ReactNode;
}) {
  const [rascunho, setRascunho] = useState(valor);
  useEffect(() => setRascunho(valor), [valor]);

  const confirmar = async () => {
    if (rascunho === valor) return;
    if (!(await onSalvar(rascunho))) setRascunho(valor);
  };

  return (
    <Campo rotulo={rotulo}>
      {(id) => (
        <>
          {render({
            id,
            value: rascunho,
            onChange: (e) => setRascunho(e.target.value),
            onBlur: confirmar,
            onKeyDown: (e) => {
              if (e.key === "Enter" && !multilinha) {
                e.preventDefault();
                void confirmar();
              }
              if (e.key === "Escape" && rascunho !== valor) {
                e.stopPropagation(); // primeiro Esc desfaz o rascunho; o segundo fecha o painel
                setRascunho(valor);
              }
            },
          })}
          {dica && <span className="text-xs text-muted-foreground">{dica}</span>}
        </>
      )}
    </Campo>
  );
}

/** Lembretes da tarefa (ADR 0008): botões que ligam e desligam cada opção. */
function Lembretes({ t, salvar }: { t: Tarefa; salvar: (m: MudancasTarefa) => Promise<boolean> }) {
  const ativos = new Set((t.lembretes ?? []).map((l) => l.antes));
  return (
    <fieldset className="flex flex-col gap-1" disabled={!t.data}>
      <legend className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Bell className="h-3.5 w-3.5" aria-hidden />
        Lembretes
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {LEMBRETES_PRONTOS.map((antes) => {
          const ligado = ativos.has(antes);
          return (
            <button
              key={antes}
              type="button"
              aria-pressed={ligado}
              onClick={() => void salvar({ lembretes: alternarLembrete(t.lembretes, antes) })}
              className={`rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
                ligado ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {descreverLembrete(antes)}
            </button>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {t.data
          ? t.hora
            ? "Chega no celular com as notificações ativadas (página Conta)."
            : "Sem hora, a referência é 09:00 do dia."
          : "Escolha uma data para usar lembretes."}
      </span>
    </fieldset>
  );
}
