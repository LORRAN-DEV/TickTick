# Hospedando o TickTick

Tudo roda com Docker Compose: **Postgres**, **API** (Python), **web** (Caddy servindo o app e repassando `/api`
para a API, com HTTPS automático) e **backup** diário do banco.

## 1. Pré-requisitos
- Uma máquina sempre ligada (VPS pequena ou mini-PC em casa) com Docker e o plugin Compose.
- Para HTTPS de verdade: um domínio apontando para essa máquina, com as portas 80 e 443 abertas
  (o Caddy pede o certificado à Let's Encrypt sozinho). O service worker (abrir offline, instalar) e o
  cookie de login `Secure` exigem HTTPS válido.

## 2. Subir
```bash
git clone <este repositório> ticktick && cd ticktick/infra
cp .env.example .env      # edite: DOMINIO, POSTGRES_SENHA (só letras e números)
docker compose up -d --build --wait
echo "sua-senha-longa" | docker compose run --rm -T api ticktick-api criar-usuario voce@exemplo.com --senha-stdin
./verificar.sh https://seu-dominio.com    # confere tudo; com EMAIL=… SENHA=… testa login e sync também
```
Depois abra `https://seu-dominio.com`, vá em **Conta** e entre. Em cada aparelho, abra o mesmo endereço e entre.

As migrações do banco rodam sozinhas quando a API sobe.

## 3. Atualizar
```bash
cd ticktick && git pull && cd infra
docker compose up -d --build --wait
```
O app mostra "Nova versão disponível — Atualizar" nos aparelhos abertos.

## 4. Backup e restauração
O serviço `backup` grava `PASTA_BACKUP/ticktick-AAAA-MM-DD.dump` ao subir e uma vez por dia, e apaga os de mais de
14 dias. **Copie essa pasta para fora da máquina** (outro disco, nuvem): backup no mesmo disco não protege de pane.

Restaurar um backup (apaga o banco atual):
```bash
docker compose stop api
docker compose exec -T postgres dropdb -U ticktick ticktick
docker compose exec -T postgres createdb -U ticktick ticktick
docker compose exec -T postgres pg_restore -U ticktick -d ticktick --no-owner < backups/ticktick-2026-11-24.dump
docker compose start api
```

## 5. Acesso de fora de casa sem abrir portas
Se a máquina está em casa e você não quer abrir portas no roteador, use **Tailscale** (o app fica acessível só nos
seus aparelhos) ou **Cloudflare Tunnel**. Nos dois casos, use o nome que eles dão como `DOMINIO`. Com o Tailscale,
ative HTTPS no painel dele e veja a documentação de "Caddy + Tailscale" para o certificado.

## 6. Testando na própria máquina
Com `DOMINIO=localhost`, o Caddy usa uma CA local: o navegador avisa do certificado e o service worker não ativa
(o resto funciona). Para conferir rápido: `PORTA_HTTPS=443 ./verificar.sh`.

## O que fica onde
| Serviço | Imagem | Dados |
|---|---|---|
| `postgres` | `postgres:16` | volume `dados-postgres` |
| `api` | `apps/api/Dockerfile` | — (estado só no Postgres) |
| `web` | `apps/web/Dockerfile` (build do app + Caddy) | volumes `dados-caddy` (certificados) e `config-caddy` |
| `backup` | `postgres:16` com `pg_dump` | pasta `PASTA_BACKUP` do servidor |

Atrás de proxy corporativo com certificado próprio, o build aceita o certificado como secret opcional:
`docker build --secret id=ca,src=ca.crt …` (ver os Dockerfiles).
