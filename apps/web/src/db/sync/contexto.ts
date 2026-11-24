import { createContext, useContext } from "react";

export type EstadoSync =
  | "carregando" // ainda descobrindo se há conta
  | "sem-conta" // app só local
  | "sincronizando"
  | "sincronizado"
  | "offline" // há conta, mas sem conexão com o servidor
  | "sessao-expirada" // há conta, mas o login venceu
  | "erro";

export interface Sync {
  estado: EstadoSync;
  conta: string | null;
  /** Mudanças locais esperando para subir. */
  pendentes: number;
  ultimoSync: Date | null;
  /** Ciclos de sync concluídos com sucesso desde que o app abriu (útil para testes e diagnóstico). */
  ciclos: number;
  erro: string | null;
  entrar(email: string, senha: string): Promise<void>;
  sair(): Promise<void>;
  sincronizarAgora(): Promise<void>;
}

export const ContextoSync = createContext<Sync | null>(null);

export function useSync(): Sync {
  const s = useContext(ContextoSync);
  if (!s) throw new Error("useSync precisa estar dentro de <ProvedorSync>");
  return s;
}
