from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# Conexão restrita: role sem BYPASSRLS, respeita as policies de RLS.
# Usar para toda rota que serve dado de um tenant (profissional autenticado).
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Conexão privilegiada: role dona das tabelas, ignora RLS. Usar SÓ em login,
# cadastro, webhook do Asaas e no job de faturamento (ver deps.py, webhooks.py,
# jobs/faturamento.py) — nunca para servir dado de cliente de um profissional.
engine_admin = create_engine(settings.DATABASE_URL_ADMIN, pool_pre_ping=True)
SessionLocalAdmin = sessionmaker(autocommit=False, autoflush=False, bind=engine_admin)


class Base(DeclarativeBase):
    pass
