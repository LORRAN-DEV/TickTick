"""Ambiente do Alembic.

URL do banco, nesta ordem: a passada pelo código (`ticktick-api migrar`, testes), a variável
TICKTICK_DATABASE_URL, ou a do alembic.ini.
"""

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

from ticktick_api.modelos import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

url = (
    config.attributes.get("url")
    or os.environ.get("TICKTICK_DATABASE_URL")
    or config.get_main_option("sqlalchemy.url")
)

with create_engine(url).connect() as conexao:
    context.configure(connection=conexao, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
