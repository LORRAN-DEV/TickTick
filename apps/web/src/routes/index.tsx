import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  PiggyBank,
  Wallet,
  Plus,
  Trash2,
  Target,
  LayoutDashboard,
  List,
  CalendarRange,
  BookOpen,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  TIPOS,
  CATEGORIAS,
  CONTAS,
  brl,
  hojeLocal,
  parseValor,
  porCategoria,
  resumoAno,
  resumoMes,
  statusMeta,
  type Meta,
  type Mov,
  type Tipo,
} from "@ticktick/core";
import {
  adicionarMeta,
  adicionarMov,
  alternarPago,
  aportarMeta,
  excluirMeta,
  excluirMov,
  limparTudo,
  type NovaMeta as DadosMeta,
  type NovaMov as DadosMov,
} from "@/db/financas";
import { useFinancas } from "@/db/useFinancas";

/** Grava no banco local; avisa se falhar (ex.: navegador sem IndexedDB ou modo privado restrito). */
function salvar(p: Promise<unknown>, sucesso?: string) {
  p.then(
    () => sucesso && toast.success(sucesso),
    (e: unknown) => {
      console.error(e);
      toast.error("Não foi possível salvar neste navegador");
    },
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Controle Financeiro — Painel com gráficos" },
      {
        name: "description",
        content:
          "Registre entradas, despesas e investimentos e acompanhe gráficos, resumo mensal e metas.",
      },
      { property: "og:title", content: "Controle Financeiro" },
      {
        property: "og:description",
        content: "Seu dinheiro em gráficos: painel, movimentações, resumo mensal e metas.",
      },
    ],
  }),
  component: App,
});

const ymNow = hojeLocal().slice(0, 7);
type Aba = "painel" | "movs" | "mensal" | "metas" | "ajuda";
const ABAS: { id: Aba; label: string; icon: typeof List }[] = [
  { id: "painel", label: "Painel", icon: LayoutDashboard },
  { id: "movs", label: "Movimentações", icon: List },
  { id: "mensal", label: "Resumo mensal", icon: CalendarRange },
  { id: "metas", label: "Metas", icon: Target },
  { id: "ajuda", label: "Como usar", icon: BookOpen },
];
const PIE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--accent)",
  "var(--muted-foreground)",
];
const sel = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm";

function App() {
  const [aba, setAba] = useState<Aba>("painel");
  const { movs, metas } = useFinancas();
  const [ym, setYm] = useState(ymNow);
  const [novo, setNovo] = useState<Tipo | null>(null);
  const [novaMeta, setNovaMeta] = useState(false);
  const [filtro, setFiltro] = useState<Tipo | "Todos">("Todos");

  const r = useMemo(() => resumoMes(movs, ym), [movs, ym]);
  const cats = useMemo(
    () =>
      porCategoria(movs, ym)
        .filter((c) => c.valor > 0)
        .sort((a, b) => b.valor - a.valor),
    [movs, ym],
  );
  const ano = useMemo(() => resumoAno(movs, Number(ym.slice(0, 4))), [movs, ym]);

  return (
    <div className="min-h-screen pb-16">
      <header className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm opacity-80">Seu dinheiro, em tempo real</p>
              <h1 className="font-display text-3xl font-bold md:text-4xl">Controle Financeiro</h1>
            </div>
            <label className="text-sm">
              <span className="mr-2 opacity-80">Mês de análise</span>
              <input
                type="month"
                value={ym}
                onChange={(e) => setYm(e.target.value || ymNow)}
                className="rounded-md bg-primary-foreground/15 px-3 py-2 text-primary-foreground"
              />
            </label>
          </div>
          <nav className="mt-6 flex flex-wrap gap-2">
            {ABAS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${aba === a.id ? "bg-accent text-accent-foreground" : "bg-primary-foreground/10 hover:bg-primary-foreground/20"}`}
              >
                <a.icon className="h-4 w-4" /> {a.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto -mt-12 max-w-6xl space-y-6 px-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Entradas" v={r.entradas} icon={ArrowUpCircle} cls="text-income" />
          <Kpi label="Despesas" v={r.despesas} icon={ArrowDownCircle} cls="text-expense" />
          <Kpi label="Investimentos" v={r.investimentos} icon={PiggyBank} cls="text-invest" />
          <Kpi
            label="Saldo do mês"
            v={r.saldo}
            icon={Wallet}
            cls={r.saldo >= 0 ? "text-primary" : "text-destructive"}
          />
        </div>

        {aba === "painel" && (
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="p-5 shadow-soft lg:col-span-3">
              <h2 className="font-display font-semibold">Evolução do ano</h2>
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={ano}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(v: number) => brl(v)} />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="var(--income)" radius={4} />
                    <Bar dataKey="despesas" name="Despesas" fill="var(--expense)" radius={4} />
                    <Bar
                      dataKey="investimentos"
                      name="Investimentos"
                      fill="var(--invest)"
                      radius={4}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5 shadow-soft lg:col-span-2">
              <h2 className="font-display font-semibold">Despesas por categoria</h2>
              {cats.length ? (
                <>
                  <div className="h-52">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={cats}
                          dataKey="valor"
                          nameKey="categoria"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {cats.map((_, i) => (
                            <Cell key={i} fill={PIE[i % PIE.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => brl(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {cats.map((c, i) => (
                      <li key={c.categoria} className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: PIE[i % PIE.length] }}
                          />
                          {c.categoria}
                        </span>
                        <span className="text-muted-foreground">
                          {brl(c.valor)} · {(c.pct * 100).toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Nenhuma despesa neste mês.
                </p>
              )}
            </Card>
            <Card className="p-5 shadow-soft lg:col-span-5">
              <h2 className="font-display font-semibold">Saldo mês a mês</h2>
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={ano}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(v: number) => brl(v)} />
                    <Line
                      type="monotone"
                      dataKey="saldo"
                      name="Saldo"
                      stroke="var(--primary)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {aba === "movs" && (
          <Card className="p-5 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {(["Todos", "Entrada", "Despesa", "Investimento"] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={filtro === t ? "default" : "outline"}
                    onClick={() => setFiltro(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <Button onClick={() => setNovo("Despesa")}>
                <Plus className="h-4 w-4" /> Nova movimentação
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    {["Data", "Tipo", "Descrição", "Categoria", "Conta", "Valor", "Pago?", ""].map(
                      (h) => (
                        <th key={h} className="px-2 py-2 font-medium">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {movs
                    .filter((m) => filtro === "Todos" || m.tipo === filtro)
                    .sort((a, b) => b.data.localeCompare(a.data))
                    .map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="px-2 py-2">{m.data.split("-").reverse().join("/")}</td>
                        <td
                          className={`px-2 font-medium ${m.tipo === "Entrada" ? "text-income" : m.tipo === "Despesa" ? "text-expense" : "text-invest"}`}
                        >
                          {m.tipo}
                        </td>
                        <td className="px-2">{m.descricao}</td>
                        <td className="px-2">{m.categoria}</td>
                        <td className="px-2">{m.contaId}</td>
                        <td className="px-2 font-semibold">{brl(m.valor)}</td>
                        <td className="px-2">
                          <button
                            onClick={() => salvar(alternarPago(m.id))}
                            className={`rounded-full px-2 py-0.5 text-xs ${m.status === "pago" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}
                          >
                            {m.status === "pago" ? "Sim" : "Não"}
                          </button>
                        </td>
                        <td className="px-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => salvar(excluirMov(m.id))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {aba === "mensal" && (
          <Card className="overflow-x-auto p-5 shadow-soft">
            <h2 className="mb-3 font-display font-semibold">Resumo de {ym.slice(0, 4)}</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  {["Mês", "Entradas", "Despesas", "Investimentos", "Saldo"].map((h) => (
                    <th key={h} className="px-2 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ano.map((a) => (
                  <tr key={a.mes} className="border-t">
                    <td className="px-2 py-2 capitalize">{a.mes}</td>
                    <td className="px-2 text-income">{brl(a.entradas)}</td>
                    <td className="px-2 text-expense">{brl(a.despesas)}</td>
                    <td className="px-2 text-invest">{brl(a.investimentos)}</td>
                    <td className={`px-2 font-semibold ${a.saldo < 0 ? "text-destructive" : ""}`}>
                      {brl(a.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {aba === "metas" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setNovaMeta(true)}>
                <Plus className="h-4 w-4" /> Nova meta
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {metas.map((m) => {
                const s = statusMeta(m);
                return (
                  <Card key={m.id} className="space-y-3 p-5 shadow-soft">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-display font-semibold">{m.nome}</h3>
                        <p className="text-xs text-muted-foreground">
                          {m.prazo
                            ? `Prazo: ${m.prazo.split("-").reverse().join("/")}`
                            : "Sem prazo"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "Concluída" ? "bg-secondary text-secondary-foreground" : s.status === "Atrasada" ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground"}`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <Progress value={Math.min(s.pct * 100, 100)} />
                    <div className="flex justify-between text-sm">
                      <span>
                        {brl(m.atual)} de {brl(m.alvo)}
                      </span>
                      <span className="text-muted-foreground">
                        Falta {brl(s.falta)} · {(s.pct * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {[100, 500].map((v) => (
                        <Button
                          key={v}
                          size="sm"
                          variant="outline"
                          onClick={() => salvar(aportarMeta(m.id, v))}
                        >
                          + {brl(v)}
                        </Button>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => salvar(excluirMeta(m.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {aba === "ajuda" && (
          <Card className="p-5 shadow-soft">
            <h2 className="font-display text-xl font-semibold">
              Como usar — escolha o que quer fazer
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Toque em um botão e o app já leva você para a função certa.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Acao
                n="1"
                t="Registrar entrada"
                s="Salário, freela, vendas"
                icon={ArrowUpCircle}
                cls="text-income"
                on={() => setNovo("Entrada")}
              />
              <Acao
                n="2"
                t="Registrar despesa"
                s="Gastos do dia a dia"
                icon={ArrowDownCircle}
                cls="text-expense"
                on={() => setNovo("Despesa")}
              />
              <Acao
                n="3"
                t="Registrar investimento"
                s="Aportes e aplicações"
                icon={PiggyBank}
                cls="text-invest"
                on={() => setNovo("Investimento")}
              />
              <Acao
                n="4"
                t="Ver painel"
                s="Resumo do mês e gráficos"
                icon={LayoutDashboard}
                cls="text-primary"
                on={() => setAba("painel")}
              />
              <Acao
                n="5"
                t="Ver resumo mensal"
                s="Os 12 meses do ano"
                icon={CalendarRange}
                cls="text-primary"
                on={() => setAba("mensal")}
              />
              <Acao
                n="6"
                t="Criar uma meta"
                s="Acompanhe o % concluído"
                icon={Target}
                cls="text-primary"
                on={() => {
                  setAba("metas");
                  setNovaMeta(true);
                }}
              />
            </div>
            <p className="mt-5 rounded-lg bg-muted p-3 text-sm">
              <b>Importante:</b> digite os valores como números positivos — o tipo escolhido define
              se é entrada, despesa ou investimento.
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => {
                salvar(limparTudo(), "Dados apagados");
              }}
            >
              Começar do zero (apagar exemplos)
            </Button>
          </Card>
        )}
      </main>

      <NovaMov
        tipo={novo}
        onClose={() => setNovo(null)}
        onSave={(m) => {
          setNovo(null);
          setYm(m.data.slice(0, 7));
          salvar(adicionarMov(m), `${m.tipo} adicionada`);
        }}
      />
      <NovaMeta
        open={novaMeta}
        onClose={() => setNovaMeta(false)}
        onSave={(m) => {
          setNovaMeta(false);
          salvar(adicionarMeta(m), "Meta criada");
        }}
      />
    </div>
  );
}

function Kpi({
  label,
  v,
  icon: Icon,
  cls,
}: {
  label: string;
  v: number;
  icon: typeof Wallet;
  cls: string;
}) {
  return (
    <Card className="p-4 shadow-soft">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <Icon className={`h-5 w-5 ${cls}`} />
      </div>
      <p className={`mt-1 font-display text-xl font-bold md:text-2xl ${cls}`}>{brl(v)}</p>
    </Card>
  );
}

function Acao({
  n,
  t,
  s,
  icon: Icon,
  cls,
  on,
}: {
  n: string;
  t: string;
  s: string;
  icon: typeof Wallet;
  cls: string;
  on: () => void;
}) {
  return (
    <button
      onClick={on}
      className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className={`h-6 w-6 ${cls}`} />
      </span>
      <span>
        <span className="block font-semibold">
          {n}. {t}
        </span>
        <span className="text-sm text-muted-foreground">{s}</span>
      </span>
    </button>
  );
}

function NovaMov({
  tipo,
  onClose,
  onSave,
}: {
  tipo: Tipo | null;
  onClose: () => void;
  onSave: (m: DadosMov) => void;
}) {
  return (
    <Dialog open={!!tipo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova movimentação</DialogTitle>
        </DialogHeader>
        {tipo && (
          <form
            key={tipo}
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const valor = parseValor(String(f.get("valor")));
              if (!valor || valor <= 0) {
                toast.error("Informe um valor positivo");
                return;
              }
              onSave({
                data: String(f.get("data")),
                tipo: f.get("tipo") as Tipo,
                descricao: String(f.get("descricao")),
                categoria: String(f.get("categoria")),
                contaId: String(f.get("conta")),
                valor,
                status: f.get("pago") === "on" ? "pago" : "pendente",
              });
            }}
          >
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.filter((t) => t !== "Transferência").map((t) => (
                <label key={t} className="cursor-pointer">
                  <input
                    type="radio"
                    name="tipo"
                    value={t}
                    defaultChecked={t === tipo}
                    className="peer sr-only"
                  />
                  <span className="block rounded-md border p-2 text-center text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
                    {t}
                  </span>
                </label>
              ))}
            </div>
            <Input name="descricao" placeholder="Descrição" required />
            <div className="grid grid-cols-2 gap-2">
              <Input name="valor" inputMode="decimal" placeholder="Valor (R$)" required />
              <Input name="data" type="date" defaultValue={hojeLocal()} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                name="categoria"
                className={sel}
                defaultValue={tipo === "Investimento" ? "Investimentos" : "Outros"}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select name="conta" className={sel}>
                {CONTAS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pago" defaultChecked /> Já foi pago/recebido
            </label>
            <Button type="submit" className="w-full">
              <Check className="h-4 w-4" /> Salvar
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NovaMeta({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (m: DadosMeta) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova meta</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const alvo = Number(f.get("alvo"));
            if (!alvo) {
              toast.error("Informe o valor alvo");
              return;
            }
            onSave({
              nome: String(f.get("nome")),
              alvo,
              atual: Number(f.get("atual")) || 0,
              prazo: String(f.get("prazo")) || undefined,
            });
          }}
        >
          <Input name="nome" placeholder="Ex.: Comprar um notebook" required />
          <div className="grid grid-cols-2 gap-2">
            <Input
              name="alvo"
              type="number"
              min="1"
              step="0.01"
              placeholder="Valor alvo"
              required
            />
            <Input name="atual" type="number" min="0" step="0.01" placeholder="Já guardado" />
          </div>
          <Input name="prazo" type="date" />
          <Button type="submit" className="w-full">
            Criar meta
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
