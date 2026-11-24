/** Seção de checklist do painel: itens de texto marcáveis dentro da tarefa. */
import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { itensDaTarefa, progressoChecklist, type ItemChecklist } from "@ticktick/core";
import { adicionarItem, alternarItem, removerItem, renomearItem } from "@/db/checklist";

const erro = (e: unknown) => {
  console.error(e);
  toast.error("Não foi possível salvar neste navegador");
};

export function Checklist({ tarefaId, itens }: { tarefaId: string; itens: ItemChecklist[] }) {
  const [texto, setTexto] = useState("");
  const lista = itensDaTarefa(itens, tarefaId);
  const { feitas, total } = progressoChecklist(itens, tarefaId);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    adicionarItem(tarefaId, texto).then(() => setTexto(""), erro);
  };

  return (
    <section aria-labelledby="titulo-checklist" className="mt-6">
      <h3 id="titulo-checklist" className="text-xs font-medium text-muted-foreground">
        Checklist{total > 0 && ` (${feitas}/${total})`}
      </h3>
      {lista.length > 0 && (
        <ul className="mt-2 space-y-1">
          {lista.map((i) => (
            <LinhaItem key={i.id} item={i} />
          ))}
        </ul>
      )}
      <form onSubmit={enviar} className="mt-2">
        <label htmlFor="novo-item" className="sr-only">
          Adicionar item
        </label>
        <Input
          id="novo-item"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Adicionar item"
          autoComplete="off"
        />
      </form>
    </section>
  );
}

function LinhaItem({ item }: { item: ItemChecklist }) {
  const [rascunho, setRascunho] = useState(item.titulo);
  useEffect(() => setRascunho(item.titulo), [item.titulo]);

  const salvar = () => {
    if (rascunho === item.titulo) return;
    if (!rascunho.trim()) {
      toast.error("O item não pode ficar vazio");
      setRascunho(item.titulo);
      return;
    }
    renomearItem(item.id, rascunho).catch((e) => {
      setRascunho(item.titulo);
      erro(e);
    });
  };

  return (
    <li className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={item.feito}
        onChange={() => alternarItem(item.id).catch(erro)}
        aria-label={`Marcar "${item.titulo}"`}
        className="h-4 w-4 shrink-0 accent-[var(--primary)]"
      />
      <input
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape" && rascunho !== item.titulo) {
            e.stopPropagation();
            setRascunho(item.titulo);
          }
        }}
        aria-label={`Texto do item "${item.titulo}"`}
        className={`min-w-0 flex-1 rounded px-1 py-0.5 text-sm outline-none focus:bg-muted ${item.feito ? "text-muted-foreground line-through" : ""}`}
      />
      <button
        onClick={() => removerItem(item.id).catch(erro)}
        aria-label={`Remover "${item.titulo}"`}
        title="Remover item"
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
