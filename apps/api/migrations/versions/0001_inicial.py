"""Tabelas iniciais: usuários, sessões e registros sincronizados (ADR 0005).

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("senha_hash", sa.String(255), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "sessoes",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("usuario_id", sa.Uuid(), sa.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("criada_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessoes_usuario_id", "sessoes", ["usuario_id"])
    op.create_index("ix_sessoes_expira_em", "sessoes", ["expira_em"])

    op.execute("CREATE SEQUENCE versao_registros")
    op.create_table(
        "registros",
        sa.Column(
            "usuario_id", sa.Uuid(), sa.ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("tabela", sa.String(40), primary_key=True),
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("dados", postgresql.JSONB(), nullable=False),
        sa.Column("relogios", postgresql.JSONB(), nullable=False),
        sa.Column("server_version", sa.BigInteger(), nullable=False),
    )
    op.create_index("ix_registros_usuario_versao", "registros", ["usuario_id", "server_version"])


def downgrade() -> None:
    op.drop_table("registros")
    op.execute("DROP SEQUENCE versao_registros")
    op.drop_table("sessoes")
    op.drop_table("usuarios")
