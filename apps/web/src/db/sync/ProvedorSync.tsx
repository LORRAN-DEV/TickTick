/**
 * Decide quando sincronizar (ADR 0006): ao abrir, ao voltar a conexão, ao voltar para a aba,
 * 1,5 s depois da última mudança local e a cada 60 s. Sem conta, não faz nada.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../banco";
import {
  entrar as entrarNaApi,
  NaoLogadoError,
  quemSouEu,
  sairDaConta,
  SemConexaoError,
} from "./api";
import { ContextoSync, type EstadoSync, type Sync } from "./contexto";
import { contaGuardada, esquecerConta, prepararConta, sincronizar } from "./sync";

const ESPERA_DEPOIS_DE_MUDAR = 1500;
const INTERVALO = 60_000;

export function ProvedorSync({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSync>("carregando");
  const [conta, setConta] = useState<string | null>(null);
  const [ultimoSync, setUltimoSync] = useState<Date | null>(null);
  const [ciclos, setCiclos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const pendentes = useLiveQuery(() => db.fila.count(), [], 0);

  const contaRef = useRef<string | null>(null);
  const rodando = useRef<Promise<void> | null>(null);
  const deNovo = useRef(false);

  /** Um ciclo de sync; se pedirem outro enquanto roda, roda mais uma vez no fim. */
  const rodar = useCallback(async (): Promise<void> => {
    if (!contaRef.current) return;
    if (rodando.current) {
      deNovo.current = true;
      return rodando.current;
    }
    const ciclo = (async () => {
      do {
        deNovo.current = false;
        setEstado("sincronizando");
        try {
          await sincronizar();
          setEstado("sincronizado");
          setUltimoSync(new Date());
          setCiclos((n) => n + 1);
          setErro(null);
        } catch (e) {
          if (e instanceof NaoLogadoError) setEstado("sessao-expirada");
          else if (e instanceof SemConexaoError) setEstado("offline");
          else {
            console.error(e);
            setEstado("erro");
            setErro(e instanceof Error ? e.message : String(e));
          }
          deNovo.current = false;
        }
      } while (deNovo.current);
    })();
    rodando.current = ciclo;
    try {
      await ciclo;
    } finally {
      rodando.current = null;
    }
  }, []);

  const usarConta = useCallback((email: string | null) => {
    contaRef.current = email;
    setConta(email);
  }, []);

  // Ao abrir: descobre se há sessão; sem rede, confia na conta guardada.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const guardada = await contaGuardada();
      // Aparelho que nunca entrou numa conta: nada de rede (o app é só local até a pessoa entrar).
      if (!guardada) {
        if (vivo) setEstado("sem-conta");
        return;
      }
      try {
        const email = await quemSouEu();
        if (!vivo) return;
        if (email) {
          await prepararConta(email);
          usarConta(email);
          await rodar();
        } else {
          usarConta(guardada);
          setEstado("sessao-expirada");
        }
      } catch {
        if (!vivo) return;
        usarConta(guardada);
        setEstado("offline");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [rodar, usarConta]);

  // Gatilhos: a cada minuto, conexão de volta, aba visível.
  useEffect(() => {
    const tentar = () => {
      if (contaRef.current) void rodar();
    };
    const visivel = () => document.visibilityState === "visible" && tentar();
    const id = window.setInterval(tentar, INTERVALO);
    window.addEventListener("online", tentar);
    document.addEventListener("visibilitychange", visivel);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", tentar);
      document.removeEventListener("visibilitychange", visivel);
    };
  }, [rodar]);

  // Mudança local: sincroniza pouco depois da última (agrupa uma sequência de edições).
  useEffect(() => {
    if (!pendentes || !contaRef.current || estado === "sessao-expirada") return;
    const id = window.setTimeout(() => void rodar(), ESPERA_DEPOIS_DE_MUDAR);
    return () => window.clearTimeout(id);
  }, [pendentes, estado, rodar]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const confirmado = await entrarNaApi(email, senha);
      await prepararConta(confirmado);
      usarConta(confirmado);
      await rodar();
    },
    [rodar, usarConta],
  );

  const sair = useCallback(async () => {
    try {
      await sairDaConta();
    } catch (e) {
      // Sem rede ou sessão já vencida: a sessão some no servidor quando expirar; aqui esquecemos já.
      if (!(e instanceof SemConexaoError || e instanceof NaoLogadoError)) throw e;
    }
    await esquecerConta();
    usarConta(null);
    setEstado("sem-conta");
    setUltimoSync(null);
  }, [usarConta]);

  const valor = useMemo<Sync>(
    () => ({
      estado,
      conta,
      pendentes,
      ultimoSync,
      ciclos,
      erro,
      entrar,
      sair,
      sincronizarAgora: rodar,
    }),
    [estado, conta, pendentes, ultimoSync, ciclos, erro, entrar, sair, rodar],
  );
  return <ContextoSync.Provider value={valor}>{children}</ContextoSync.Provider>;
}
