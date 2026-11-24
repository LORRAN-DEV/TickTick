# QA — Objetivo 7: API em Python (login e sincronização)

_24/11/2026. Critérios em `docs/project/escopo.md`. Testes em `apps/api/tests/` (pytest contra PostgreSQL 16)._

| # | Critério | Teste | Resultado |
|---|---|---|---|
| 1 | `criar-usuario` guarda só o hash Argon2; recusa repetido e senha curta | `test_1_*` | Passou |
| 2 | Login com cookie `HttpOnly`/`SameSite=Lax` (e `Secure` em produção); erro não revela o que errou; 5 erros → 429 | `test_2_*` | Passou |
| 3 | Sem sessão → 401; logout invalida no servidor; sessão vencida → 401 | `test_3_*` | Passou |
| 4 | Push grava as 5 tabelas do app; lote inválido → 422 e nada é gravado (9 casos) | `test_4_*` | Passou |
| 5 | Campos diferentes não conflitam; mesmo campo vence o mais recente; "do futuro" conta como agora | `test_5_*` | Passou |
| 6 | Mesmo lote duas vezes não muda nada nem gera versão | `test_6_*` | Passou |
| 7 | Pull desde a versão N, em páginas, com `mais` e a versão seguinte | `test_7_*` | Passou |
| 8 | Exclusão lógica (`excluidoEm`) vem no pull | `test_8_*` | Passou |
| 9 | Um usuário não vê nem altera registros de outro | `test_9_*` | Passou |
| 10 | `uv run pytest` contra Postgres; job próprio no CI | 32 testes; `.github/workflows/ci.yml` (job `api`) | Passou localmente; CI na próxima execução |

Extra: formulário de outro site (corpo não JSON) não consegue fazer push (`test_formulario_de_outro_site_nao_faz_push`).

## Teste de fumaça (servidor de verdade)
`ticktick-api migrar` → `criar-usuario dev@exemplo.com --senha-stdin` → `servir`, e com `curl`: `/api/saude` 200,
pull sem login 401, login 200 com cookie, push aplicou `titulo` e `prioridade` (versão 1), pull devolveu o
registro, `/api/docs` 200.

## Observações
- O limite de tentativas de login fica em memória: vale por processo e zera ao reiniciar. Para um usuário só e
  um processo, basta; com várias réplicas precisaria ir para o banco.
- A validação de tipo dos campos (ex.: prioridade 0–3) continua no app; o servidor garante forma, tamanho e dono
  (ADR 0005).
- `docker compose` + Caddy não foram feitos: não há Docker funcionando neste ambiente para verificar.
