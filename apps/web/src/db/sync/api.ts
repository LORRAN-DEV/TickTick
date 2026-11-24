/** Chamadas à API (mesma origem: `/api`, repassado ao servidor Python pelo Caddy ou pelo Vite). */

export class NaoLogadoError extends Error {
  constructor() {
    super("Entre de novo para sincronizar");
    this.name = "NaoLogadoError";
  }
}
export class SemConexaoError extends Error {
  constructor() {
    super("Sem conexão com o servidor");
    this.name = "SemConexaoError";
  }
}
export class CredenciaisInvalidasError extends Error {
  constructor() {
    super("E-mail ou senha incorretos");
    this.name = "CredenciaisInvalidasError";
  }
}
export class MuitasTentativasError extends Error {
  constructor() {
    super("Muitas tentativas. Espere um minuto e tente de novo.");
    this.name = "MuitasTentativasError";
  }
}

/** Como o app fala com o servidor. Os testes trocam por um servidor falso. */
export interface Api {
  chamar(caminho: string, init?: RequestInit): Promise<Response>;
}

export const apiPadrao: Api = {
  chamar: (caminho, init) => fetch(caminho, { credentials: "same-origin", ...init }),
};

/** Chama a API e devolve o JSON; traduz 401 e falha de rede para erros do app. */
export async function chamarJson<T>(api: Api, caminho: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await api.chamar(caminho, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new SemConexaoError();
  }
  if (r.status === 401) throw new NaoLogadoError();
  if (!r.ok) throw new Error(`Servidor respondeu ${r.status} em ${caminho}`);
  return r.status === 204 ? (undefined as T) : ((await r.json()) as T);
}

/** E-mail da sessão atual, ou null se não há sessão. Sem rede: lança SemConexaoError. */
export async function quemSouEu(api: Api = apiPadrao): Promise<string | null> {
  try {
    return (await chamarJson<{ email: string }>(api, "/api/auth/eu")).email;
  } catch (e) {
    if (e instanceof NaoLogadoError) return null;
    throw e;
  }
}

export async function entrar(email: string, senha: string, api: Api = apiPadrao): Promise<string> {
  let r: Response;
  try {
    r = await api.chamar("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
  } catch {
    throw new SemConexaoError();
  }
  if (r.status === 401) throw new CredenciaisInvalidasError();
  if (r.status === 429) throw new MuitasTentativasError();
  if (!r.ok) throw new Error(`Servidor respondeu ${r.status} no login`);
  return ((await r.json()) as { email: string }).email;
}

export async function sairDaConta(api: Api = apiPadrao): Promise<void> {
  await chamarJson(api, "/api/auth/logout", { method: "POST" });
}
