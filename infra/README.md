# Hospedando o TickTick

Tudo roda com Docker Compose: **Postgres**, **API** (Python), **web** (Caddy servindo o app e repassando `/api`
para a API) e **backup** diário do banco.

## Caminho escolhido: PC em casa + Tailscale (ADR 0007)

O Tailscale dá ao PC um endereço grátis `https://<nome-do-pc>.<tailnet>.ts.net` com certificado válido, sem abrir
portas no roteador (funciona mesmo com CGNAT). O app só é acessível pelos seus aparelhos com o Tailscale ligado.

### Uma vez, no PC
1. **Docker:** no Windows, instale o Docker Desktop (usa o WSL2) e marque "Start Docker Desktop when you sign in";
   no Linux, instale o Docker Engine com o plugin Compose.
2. **Tailscale:** crie a conta em tailscale.com (pode entrar com a conta Google) e instale no PC.
   No painel do Tailscale, em **DNS**, ative **MagicDNS** e **HTTPS Certificates**.
3. **Energia:** configure o PC para **não suspender** (pode desligar a tela). Com o PC dormindo, o app nos
   aparelhos continua funcionando offline, mas não sincroniza e, no futuro, os lembretes não saem.
4. **O app:**
   ```bash
   git clone https://github.com/LORRAN-DEV/TickTick.git ticktick
   cd ticktick/infra
   cp .env.example .env
   ```
   No `.env`, use o modo Tailscale:
   ```ini
   DOMINIO=:80
   PORTA_HTTP=127.0.0.1:8080
   PORTA_HTTPS=127.0.0.1:8443
   POSTGRES_SENHA=umaSenhaLongaSoComLetrasENumeros
   PASTA_BACKUP=./backups
   ```
   ```bash
   docker compose up -d --build --wait
   echo "sua-senha-longa" | docker compose run --rm -T api ticktick-api criar-usuario voce@exemplo.com --senha-stdin
   tailscale serve --bg 8080
   ```
   O último comando mostra o endereço (`https://<nome-do-pc>.<tailnet>.ts.net`). Ele fica ativo mesmo depois de
   reiniciar o PC.
5. **Conferir:** `./verificar.sh https://<nome-do-pc>.<tailnet>.ts.net` (no Windows, rode no Git Bash ou no WSL).

### No celular (Android)
1. Instale o app **Tailscale**, entre com a mesma conta e deixe ligado.
2. No Chrome, abra o endereço `.ts.net`, vá em **Conta** e entre com o e-mail e a senha que você criou.
3. Toque em **Instalar** no menu do app (ou no menu do Chrome, "Instalar app"). Ele vira um ícone na tela inicial.

### Backup fora do PC
Backup no mesmo disco não protege se o disco morrer. O jeito mais simples: aponte `PASTA_BACKUP` para uma pasta
sincronizada pelo **Google Drive para computador** (ou OneDrive), por exemplo
`PASTA_BACKUP=G:/Meu Drive/ticktick-backups` no Windows, e rode `docker compose up -d` de novo.

### Atualizar depois
```bash
cd ticktick && git pull && cd infra && docker compose up -d --build --wait
```

---

## Outros jeitos de hospedar (VPS com domínio próprio)
### 1. Pré-requisitos
- Uma máquina sempre ligada (VPS pequena ou mini-PC em casa) com Docker e o plugin Compose.
- Para HTTPS de verdade: um domínio apontando para essa máquina, com as portas 80 e 443 abertas
  (o Caddy pede o certificado à Let's Encrypt sozinho). O service worker (abrir offline, instalar) e o
  cookie de login `Secure` exigem HTTPS válido.

### 2. Subir
```bash
git clone <este repositório> ticktick && cd ticktick/infra
cp .env.example .env      # edite: DOMINIO, POSTGRES_SENHA (só letras e números)
docker compose up -d --build --wait
echo "sua-senha-longa" | docker compose run --rm -T api ticktick-api criar-usuario voce@exemplo.com --senha-stdin
./verificar.sh https://seu-dominio.com    # confere tudo; com EMAIL=… SENHA=… testa login e sync também
```
Depois abra `https://seu-dominio.com`, vá em **Conta** e entre. Em cada aparelho, abra o mesmo endereço e entre.

As migrações do banco rodam sozinhas quando a API sobe.

### 3. Atualizar
```bash
cd ticktick && git pull && cd infra
docker compose up -d --build --wait
```
O app mostra "Nova versão disponível — Atualizar" nos aparelhos abertos.

### 4. Backup e restauração
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

### 5. Testando na própria máquina
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
