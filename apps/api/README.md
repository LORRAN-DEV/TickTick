# TickTick API

Login e sincronização dos dados do app (FastAPI + PostgreSQL). Decisões em `docs/adr/0002` e `docs/adr/0005`.

## Rodando localmente

Requisitos: Python 3.12+, [uv](https://docs.astral.sh/uv/) e um PostgreSQL 16.

```bash
cd apps/api
uv sync                                   # cria o .venv com as dependências
export TICKTICK_DATABASE_URL=postgresql+psycopg://ticktick:ticktick@127.0.0.1:5432/ticktick
export TICKTICK_COOKIE_SEGURO=false       # só em desenvolvimento por http://
uv run ticktick-api migrar                # cria/atualiza as tabelas
uv run ticktick-api criar-usuario voce@exemplo.com   # pede a senha (mín. 10 caracteres)
uv run ticktick-api servir --porta 8000   # documentação em http://127.0.0.1:8000/api/docs
```

## Testes

```bash
cd apps/api
uv run pytest            # precisa de um Postgres; o banco de teste é APAGADO a cada execução
uv run ruff check . && uv run ruff format --check .
```

O comando `uv run ticktick-api preparar-teste EMAIL --senha-stdin` zera um banco de teste (nome terminando em
`teste` ou `e2e`) e cria o usuário; é o que o `pnpm e2e` usa para os testes de sync.

Os testes usam `TICKTICK_TEST_DATABASE_URL` (padrão: banco `ticktick_teste` no localhost, usuário/senha
`ticktick`). Por segurança, o nome do banco precisa terminar em `teste`. Da raiz do monorepo: `pnpm test:api`.

## Rotas

| Método | Rota | Para quê |
|---|---|---|
| POST | `/api/auth/login` | `{email, senha}` → cookie de sessão `HttpOnly` (90 dias) |
| POST | `/api/auth/logout` | encerra a sessão no servidor |
| GET | `/api/auth/eu` | quem está logado |
| POST | `/api/sync/push` | lote de mudanças `{tabela, id, campos, alterado_em}`; por campo vence a mais recente |
| GET | `/api/sync/pull?since=N&limite=500` | registros alterados depois da versão N, em páginas |
| GET | `/api/saude` | o servidor está de pé |

## Configuração (variáveis `TICKTICK_*`)

| Variável | Padrão | |
|---|---|---|
| `TICKTICK_DATABASE_URL` | `postgresql+psycopg://ticktick:ticktick@127.0.0.1:5432/ticktick` | |
| `TICKTICK_COOKIE_SEGURO` | `true` | `false` só para desenvolvimento sem HTTPS |
| `TICKTICK_SESSAO_DIAS` | `90` | validade do login |
| `TICKTICK_LOGIN_MAX_FALHAS` / `TICKTICK_LOGIN_JANELA_SEGUNDOS` | `5` / `60` | limite de tentativas por IP |

Em produção, rode atrás do Caddy (mesma origem do app web, `/api` repassado para a API) com
`ticktick-api servir --host 0.0.0.0`; o IP do cliente para o limite de login vem do `X-Forwarded-For`.
