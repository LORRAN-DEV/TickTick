"""Lembretes e Web Push: fuso do usuário, inscrições, disparos enviados, adiamentos e config (ADR 0008).

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("fuso", sa.String(64), server_default="America/Sao_Paulo", nullable=False),
    )
    op.create_table(
        "push_assinaturas",
        sa.Column("endpoint", sa.Text(), primary_key=True),
        sa.Column("usuario_id", sa.Uuid(), sa.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("p256dh", sa.String(255), nullable=False),
        sa.Column("auth", sa.String(255), nullable=False),
        sa.Column("aparelho", sa.String(200), nullable=False, server_default=""),
        sa.Column("criada_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_push_assinaturas_usuario_id", "push_assinaturas", ["usuario_id"])
    op.create_table(
        "lembretes_enviados",
        sa.Column(
            "usuario_id", sa.Uuid(), sa.ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("tarefa_id", sa.String(64), primary_key=True),
        sa.Column("instante", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("enviado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "adiamentos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("usuario_id", sa.Uuid(), sa.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tarefa_id", sa.String(64), nullable=False),
        sa.Column("quando", sa.DateTime(timezone=True), nullable=False),
        sa.Column("enviado_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_adiamentos_usuario_id", "adiamentos", ["usuario_id"])
    op.create_index("ix_adiamentos_quando", "adiamentos", ["quando"])
    op.create_table(
        "config_servidor",
        sa.Column("chave", sa.String(100), primary_key=True),
        sa.Column("valor", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("config_servidor")
    op.drop_table("adiamentos")
    op.drop_table("lembretes_enviados")
    op.drop_table("push_assinaturas")
    op.drop_column("usuarios", "fuso")
