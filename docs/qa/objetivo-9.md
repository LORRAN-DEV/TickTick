# QA — Objetivo 9: Docker Compose e backup

_24/11/2026. Critérios em `docs/project/escopo.md`. Verificado com Docker 29 / Compose 5.7 neste ambiente
(imagens base via `mirror.gcr.io`, porque o Docker Hub limitava downloads anônimos daqui) e no CI (job `docker`)._

| # | Critério | Como | Resultado |
|---|---|---|---|
| 1 | `docker compose up -d` sobe os 4 serviços saudáveis | `up --wait` | Passou |
| 2 | `/`, `/financas` (rota do app) e `/api/saude` pelo Caddy, com HTTPS; http redireciona | `verificar.sh` + `curl` | Passou |
| 3 | `criar-usuario` pelo compose; login com cookie `HttpOnly` e `Secure` | `verificar.sh` | Passou |
| 4 | `sw.js`, manifesto e HTML sem cache; `assets/` com cache longo; cabeçalhos de segurança | `verificar.sh` | Passou |
| 5 | Backup diário `ticktick-AAAA-MM-DD.dump`; restauração do guia funciona | restaurado num banco à parte, dado conferido | Passou |
| 6 | Dados sobrevivem a `down` + `up` | tarefa enviada antes continuou lá | Passou |
| 7 | CI sobe o compose e verifica | job `docker` em `.github/workflows/ci.yml` | Resultado no GitHub |

Extra: no navegador (Playwright) pelo Caddy: login na página Conta, tarefa criada e enviada ao servidor sozinha.

## Observações
- Com `DOMINIO=localhost` o service worker não ativa (certificado da CA local do Caddy não é confiável para o
  navegador). Com domínio público e Let's Encrypt, ativa. Está no guia.
- A API agora aceita `X-Forwarded-For` só de proxies configurados (`TICKTICK_PROXIES_CONFIAVEIS`, `*` na imagem,
  onde a API só é alcançável pela rede interna do compose), para o limite de login contar o IP de cada pessoa.
- Imagem da API: 495 MB (python:3.13-slim + dependências). Dá para reduzir depois com build em dois estágios.
