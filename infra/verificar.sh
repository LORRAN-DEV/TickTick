#!/bin/sh
# Confere um TickTick rodando com o docker compose (CI e depois de instalar num servidor).
# Uso: ./verificar.sh [URL]   (padrão: https://localhost:${PORTA_HTTPS:-443})
# Precisa de um usuário? Defina EMAIL e SENHA para testar login e sync (o usuário precisa existir).
set -eu
U="${1:-https://localhost:${PORTA_HTTPS:-443}}"
K="-sk" # aceita o certificado da CA local do Caddy (localhost)
falhas=0
ok() { echo "ok    $1"; }
erro() { echo "FALHOU $1"; falhas=$((falhas + 1)); }
cabecalho() { curl $K -I "$U$1" | tr -d '\r' | grep -i "^$2:" | cut -d' ' -f2-; }

[ "$(curl $K -o /dev/null -w '%{http_code}' "$U/")" = 200 ] && ok "app abre em /" || erro "app em /"
curl $K "$U/financas" | grep -aq 'manifest.webmanifest' && ok "rota do app (/financas) abre a casca" || erro "/financas"
curl $K "$U/api/saude" | grep -q '"ok"' && ok "/api/saude responde pela API" || erro "/api/saude"
[ "$(cabecalho /sw.js cache-control)" = "no-cache" ] && ok "sw.js sem cache" || erro "cache do sw.js"
[ "$(cabecalho /manifest.webmanifest cache-control)" = "no-cache" ] && ok "manifesto sem cache" || erro "cache do manifesto"
ASSET=$(curl $K "$U/" | grep -ao '/assets/[^"]*\.js' | head -1)
cabecalho "$ASSET" cache-control | grep -q immutable && ok "assets com cache longo" || erro "cache dos assets"
[ "$(cabecalho / x-content-type-options)" = "nosniff" ] && ok "cabeçalhos de segurança" || erro "cabeçalhos de segurança"

if [ -n "${EMAIL:-}" ] && [ -n "${SENHA:-}" ]; then
  JAR=$(mktemp)
  COOKIE=$(curl $K -c "$JAR" -D - -o /dev/null -H 'content-type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"senha\":\"$SENHA\"}" "$U/api/auth/login" | tr -d '\r' | grep -i '^set-cookie:' || true)
  echo "$COOKIE" | grep -qi 'httponly' && echo "$COOKIE" | grep -qi 'secure' && ok "login com cookie HttpOnly e Secure" ||
    erro "login/cookie"
  curl $K -b "$JAR" -H 'content-type: application/json' \
    -d '{"mudancas":[{"tabela":"tarefas","id":"verificacao","campos":{"titulo":"verificação"},"alterado_em":"2000-01-01T00:00:00Z"}]}' \
    "$U/api/sync/push" | grep -q '"versao"' && ok "sync pela API" || erro "sync"
  rm -f "$JAR"
fi

[ "$falhas" = 0 ] && echo "Tudo certo." || { echo "$falhas verificação(ões) falharam."; exit 1; }
