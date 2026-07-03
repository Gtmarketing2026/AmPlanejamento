from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls
from app.models.fatura import Fatura

router = APIRouter(prefix="/faturas", tags=["faturas"])


@router.get("")
def listar_faturas(db: Session = Depends(get_db_com_rls)):
    faturas = db.scalars(select(Fatura).order_by(Fatura.ciclo_referencia.desc())).all()
    return [
        {
            "id": f.id,
            "ciclo_referencia": f.ciclo_referencia,
            "clientes_inclusos_no_ciclo": f.clientes_inclusos_no_ciclo,
            "clientes_extras_no_ciclo": f.clientes_extras_no_ciclo,
            "valor_base": f.valor_base,
            "valor_extras": f.valor_extras,
            "valor_total": f.valor_total,
            "status": f.status,
        }
        for f in faturas
    ]
