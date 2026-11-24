import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Ban,
  Inbox,
  List as ListIcon,
  ListTodo,
  Repeat,
  RotateCcw,
  Sun,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  atrasada,
  descreverRegra,
  filtrarInteligente,
  filtrarLista,
  hojeLocal,
  INBOX_ID,
  LISTAS_INTELIGENTES,
  NOMES_INTELIGENTES,
  parseQuickAdd,
  type Lista,
  type ListaInteligente,
  type Tarefa,
} from "@ticktick/core";
import {
  concluirTarefa,
  criarDoTexto,
  moverParaLixeira,
  reabrirTarefa,
  restaurarTarefa,
  TituloVazioError,
} from "@/db/tarefas";
import { useTarefas } from "@/db/useTarefas";
import { DetalheTarefa } from "@/components/tarefas/DetalheTarefa";
import { COR_PRIORIDADE, NOMES_PRIORIDADE, NOMES_TRECHO, rotuloData } from "@/lib/rotulos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tarefas — TickTick" },
      { name: "description", content: "Suas tarefas, com captura rápida em português." },
    ],
  }),
  component: PaginaTarefas,
});

/** O que está aberto na tela: uma lista inteligente ou uma lista comum (pelo id). */
type Visao = { tipo: "inteligente"; id: ListaInteligente } | { tipo: "lista"; id: string };

const ICONES: Record<ListaInteligente, typeof Sun> = {
  hoje: Sun,
  amanha: CalendarDays,
  proximos7: CalendarRange,
  tudo: ListTodo,
  concluidas: CheckCircle2,
  lixeira: Trash2,
};

/** Grava no banco local; avisa se falhar. */
function salvar(p: Promise<unknown>, sucesso?: string) {
  p.then(
    () => sucesso && toast.success(sucesso),
    (e: unknown) => {
      console.error(e);
      toast.error("Não foi possível salvar neste navegador");
    },
  );
}

function PaginaTarefas() {
  const { tarefas, listas } = useTarefas();
  const [visao, setVisao] = useState<Visao>({ tipo: "inteligente", id: "hoje" });
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const detalhe = detalheId ? (tarefas.find((t) => t.id === detalheId) ?? null) : null;
  const hoje = hojeLocal();

  const visiveis = useMemo(
    () =>
      visao.tipo === "inteligente"
        ? filtrarInteligente(tarefas, visao.id, hoje)
        : filtrarLista(tarefas, visao.id),
    [tarefas, visao, hoje],
  );
  const contagem = (id: ListaInteligente) => filtrarInteligente(tarefas, id, hoje).length;
  const nomeLista = useMemo(() => new Map(listas.map((l) => [l.id, l.nome])), [listas]);
  const titulo =
    visao.tipo === "inteligente"
      ? NOMES_INTELIGENTES[visao.id]
      : (nomeLista.get(visao.id) ?? "Lista");
  const podeCriar = !(
    visao.tipo === "inteligente" &&
    (visao.id === "concluidas" || visao.id === "lixeira")
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
      <BarraLateral
        visao={visao}
        setVisao={setVisao}
        listas={listas}
        contagem={contagem}
        contagemLista={(id) => filtrarLista(tarefas, id).length}
      />
      <main className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-bold">{titulo}</h1>
        {podeCriar && (
          <QuickAdd
            listaPadrao={visao.tipo === "lista" ? visao.id : undefined}
            dicaData={visao.tipo === "inteligente" && visao.id === "amanha" ? "amanhã" : undefined}
          />
        )}
        <ListaDeTarefas
          tarefas={visiveis}
          hoje={hoje}
          nomeLista={visao.tipo === "inteligente" ? nomeLista : null}
          onAbrir={setDetalheId}
          vazio={
            visao.tipo === "inteligente" && visao.id === "lixeira"
              ? "A lixeira está vazia."
              : visao.tipo === "inteligente" && visao.id === "concluidas"
                ? "Nada concluído ainda."
                : "Nenhuma tarefa aqui. Digite acima para criar."
          }
        />
      </main>
      <DetalheTarefa tarefa={detalhe} listas={listas} onFechar={() => setDetalheId(null)} />
    </div>
  );
}

function BarraLateral({
  visao,
  setVisao,
  listas,
  contagem,
  contagemLista,
}: {
  visao: Visao;
  setVisao: (v: Visao) => void;
  listas: Lista[];
  contagem: (id: ListaInteligente) => number;
  contagemLista: (id: string) => number;
}) {
  const item = (ativo: boolean) =>
    `flex w-full shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
      ativo ? "bg-primary text-primary-foreground" : "hover:bg-muted"
    }`;
  return (
    <nav aria-label="Listas" className="md:w-56 md:shrink-0">
      <ul className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
        {LISTAS_INTELIGENTES.map((id) => {
          const Icone = ICONES[id];
          const ativo = visao.tipo === "inteligente" && visao.id === id;
          const n = id === "concluidas" || id === "lixeira" ? 0 : contagem(id);
          return (
            <li key={id} className="shrink-0 md:shrink">
              <button
                className={item(ativo)}
                aria-current={ativo ? "page" : undefined}
                onClick={() => setVisao({ tipo: "inteligente", id })}
              >
                <Icone className="h-4 w-4" aria-hidden />
                <span className="flex-1 whitespace-nowrap">{NOMES_INTELIGENTES[id]}</span>
                {n > 0 && <span className="text-xs opacity-70">{n}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <h2 className="mt-4 hidden px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:block">
        Listas
      </h2>
      <ul className="flex gap-1 overflow-x-auto md:mt-1 md:flex-col md:overflow-visible">
        {listas.map((l) => {
          const ativo = visao.tipo === "lista" && visao.id === l.id;
          const Icone = l.id === INBOX_ID ? Inbox : ListIcon;
          const n = contagemLista(l.id);
          return (
            <li key={l.id} className="shrink-0 md:shrink">
              <button
                className={item(ativo)}
                aria-current={ativo ? "page" : undefined}
                onClick={() => setVisao({ tipo: "lista", id: l.id })}
              >
                <Icone className="h-4 w-4" aria-hidden />
                <span className="flex-1 truncate whitespace-nowrap">{l.nome}</span>
                {n > 0 && <span className="text-xs opacity-70">{n}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function QuickAdd({
  listaPadrao,
  dicaData,
}: {
  listaPadrao?: string | undefined;
  dicaData?: string | undefined;
}) {
  const [texto, setTexto] = useState("");
  const previa = useMemo(() => (texto.trim() ? parseQuickAdd(texto) : null), [texto]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    try {
      await criarDoTexto(texto, listaPadrao ? { listaPadrao } : {});
      setTexto("");
    } catch (err) {
      if (err instanceof TituloVazioError) toast.error("Escreva o que é a tarefa, além da data");
      else {
        console.error(err);
        toast.error("Não foi possível salvar neste navegador");
      }
    }
  };

  return (
    <form onSubmit={enviar} className="mt-4">
      <label htmlFor="quick-add" className="sr-only">
        Nova tarefa
      </label>
      <Input
        id="quick-add"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={`Nova tarefa: "pagar boleto ${dicaData ?? "amanhã"} 15h !alta #casa ~pessoal"`}
        autoComplete="off"
        className="h-11 bg-card"
      />
      {previa && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          <span className="text-muted-foreground">
            Título: <b className="text-foreground">{previa.title || "—"}</b>
          </span>
          {previa.matches.map((m) => (
            <span
              key={`${m.start}-${m.kind}`}
              className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {NOMES_TRECHO[m.kind]}: {m.text}
            </span>
          ))}
          {previa.date && (
            <span className="text-xs text-muted-foreground">
              → {rotuloData(previa.date, hojeLocal())}
              {previa.time ? ` às ${previa.time}` : ""}
              {previa.rrule ? `, ${descreverRegra(previa.rrule)}` : ""}
            </span>
          )}
        </div>
      )}
    </form>
  );
}

function ListaDeTarefas({
  tarefas,
  hoje,
  nomeLista,
  vazio,
  onAbrir,
}: {
  tarefas: Tarefa[];
  hoje: string;
  nomeLista: Map<string, string> | null;
  vazio: string;
  onAbrir: (id: string) => void;
}) {
  if (!tarefas.length)
    return <p className="mt-10 text-center text-sm text-muted-foreground">{vazio}</p>;
  return (
    <ul className="mt-4 divide-y rounded-lg border bg-card">
      {tarefas.map((t) => (
        <LinhaTarefa
          key={t.id}
          t={t}
          hoje={hoje}
          nomeLista={nomeLista?.get(t.listaId) ?? null}
          onAbrir={() => onAbrir(t.id)}
        />
      ))}
    </ul>
  );
}

function LinhaTarefa({
  t,
  hoje,
  nomeLista,
  onAbrir,
}: {
  t: Tarefa;
  hoje: string;
  nomeLista: string | null;
  onAbrir: () => void;
}) {
  const naLixeira = !!t.excluidoEm;
  const aberta = t.status === "aberta" && !naLixeira;
  const cor = COR_PRIORIDADE[t.prioridade];
  const vencida = atrasada(t, hoje);
  return (
    <li
      className="flex items-start gap-3 px-3 py-2.5"
      style={cor ? { boxShadow: `inset 3px 0 0 ${cor}` } : undefined}
    >
      {aberta ? (
        <button
          role="checkbox"
          aria-checked={false}
          aria-label={`Concluir "${t.titulo}"`}
          onClick={() =>
            salvar(
              concluirTarefa(t.id),
              t.rrule ? "Concluída; próxima ocorrência agendada" : undefined,
            )
          }
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 transition hover:bg-muted"
          style={cor ? { borderColor: cor } : undefined}
        />
      ) : (
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground"
          aria-hidden
        >
          {t.status === "nao_vou_fazer" ? (
            <Ban className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <button
          onClick={onAbrir}
          aria-label={`Abrir detalhes de "${t.titulo}"`}
          className={`block w-full break-words text-left hover:underline ${aberta ? "" : "text-muted-foreground line-through"}`}
        >
          <span data-titulo>{t.titulo}</span>
        </button>
        {t.notas && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.notas}</p>}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {t.data && (
            <span
              className={`flex items-center gap-1 ${vencida ? "font-medium text-destructive" : ""}`}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {rotuloData(t.data, hoje)}
              {t.hora ? ` ${t.hora}` : ""}
              {vencida ? " (atrasada)" : ""}
            </span>
          )}
          {t.rrule && (
            <span className="flex items-center gap-1">
              <Repeat className="h-3.5 w-3.5" aria-hidden />
              {descreverRegra(t.rrule)}
            </span>
          )}
          {t.prioridade > 0 && (
            <span style={{ color: cor ?? undefined }}>
              Prioridade {NOMES_PRIORIDADE[t.prioridade].toLowerCase()}
            </span>
          )}
          {t.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
          {nomeLista && <span>~{nomeLista}</span>}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {aberta && (
          <>
            <Button
              size="icon"
              variant="ghost"
              title="Não vou fazer"
              aria-label={`Não vou fazer "${t.titulo}"`}
              onClick={() => salvar(concluirTarefa(t.id, "nao_vou_fazer"))}
            >
              <Ban className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Mandar para a lixeira"
              aria-label={`Mandar "${t.titulo}" para a lixeira`}
              onClick={() => salvar(moverParaLixeira(t.id), "Movida para a lixeira")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
        {!aberta && !naLixeira && (
          <Button
            size="icon"
            variant="ghost"
            title="Reabrir"
            aria-label={`Reabrir "${t.titulo}"`}
            onClick={() => salvar(reabrirTarefa(t.id))}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        {naLixeira && (
          <Button
            size="icon"
            variant="ghost"
            title="Restaurar"
            aria-label={`Restaurar "${t.titulo}"`}
            onClick={() => salvar(restaurarTarefa(t.id), "Tarefa restaurada")}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </li>
  );
}
