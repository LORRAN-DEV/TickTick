# Imagem do app web: build estático + Caddy (contexto: raiz do monorepo). Ver infra/docker-compose.yml.
FROM node:22-alpine AS build
RUN corepack enable
# Atrás de proxy com certificado próprio: `docker build --secret id=ca,src=ca.crt` (opcional; sem ele, nada muda).
WORKDIR /repo
# Manifestos primeiro (camada de dependências reaproveitada enquanto o lockfile não muda).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    pnpm install --frozen-lockfile --filter "@ticktick/web..."
COPY packages/core packages/core
COPY apps/web apps/web
RUN pnpm --filter @ticktick/web build

FROM caddy:2
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist/client /srv
