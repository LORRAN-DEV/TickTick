"""Configuração por variáveis de ambiente (prefixo TICKTICK_) ou arquivo .env."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TICKTICK_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://ticktick:ticktick@127.0.0.1:5432/ticktick"
    # Em produção o app é servido por HTTPS (Caddy): o cookie só viaja criptografado.
    # Em desenvolvimento local por http://, use TICKTICK_COOKIE_SEGURO=false.
    cookie_seguro: bool = True
    sessao_dias: int = 90
    login_max_falhas: int = 5
    login_janela_segundos: int = 60


@lru_cache
def config_padrao() -> Config:
    return Config()
