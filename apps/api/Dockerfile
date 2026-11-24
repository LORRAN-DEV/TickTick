# Imagem da API (contexto: raiz do monorepo). Ver infra/docker-compose.yml.
FROM python:3.13-slim

# Atrás de proxy com certificado próprio: `docker build --secret id=ca,src=ca.crt` (opcional; sem ele, nada muda).
# uv pelo PyPI (o registro ghcr.io pode estar bloqueado em algumas redes).
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export PIP_CERT=/run/secrets/ca; fi; \
    pip install --no-cache-dir uv==0.11.32
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1

WORKDIR /app
# Dependências primeiro (camada reaproveitada enquanto o uv.lock não muda).
COPY apps/api/pyproject.toml apps/api/uv.lock apps/api/.python-version ./
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export SSL_CERT_FILE=/run/secrets/ca UV_NATIVE_TLS=1; fi; \
    uv sync --locked --no-dev --no-install-project
COPY apps/api/ ./
RUN uv sync --locked --no-dev --offline

ENV PATH="/app/.venv/bin:$PATH" \
    TICKTICK_PROXIES_CONFIAVEIS="*"
RUN useradd --system --uid 10001 ticktick
USER ticktick
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/saude', timeout=2)"
# Aplica as migrações e sobe a API.
CMD ["sh", "-c", "ticktick-api migrar && exec ticktick-api servir --host 0.0.0.0 --porta 8000"]
