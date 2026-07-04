import hashlib
import uuid
from datetime import date


def calcular_hash_dedup(conta_conectada_id: uuid.UUID, data: date, valor: float, descricao: str) -> str:
    """Mesma fórmula documentada em schema_seguranca.sql (tabela transacoes):
    sha256(conta_conectada_id || data || valor || descricao_original).
    Usado tanto na importação manual (OFX/CSV/PDF) quanto, no futuro, na
    sincronização via Open Finance -- a mesma transação reenviada por
    qualquer uma das duas fontes cai no mesmo hash e não duplica."""
    base = f"{conta_conectada_id}|{data.isoformat()}|{valor:.2f}|{descricao.strip().lower()}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()
