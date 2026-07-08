"""
Configurações do planejador que afetam a experiência dos clientes dele.
Hoje: critérios da saúde financeira (limiares de reserva e poupança que
classificam o cliente em Vermelho/Amarelo/Verde/Azul).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls, get_profissional_id_atual
from app.models.profissional import Profissional
from app.schemas.patrimonio import CriteriosSaude, CriteriosSaudeAtualizar

router = APIRouter(prefix="/configuracoes", tags=["configuracoes"])


def _criterios_resposta(p: Profissional) -> CriteriosSaude:
    return CriteriosSaude(
        reserva_min_meses=float(p.saude_reserva_min_meses),
        verde_reserva_meses=float(p.saude_verde_reserva_meses),
        verde_poupanca_pct=float(p.saude_verde_poupanca_pct),
        azul_reserva_meses=float(p.saude_azul_reserva_meses),
        azul_poupanca_pct=float(p.saude_azul_poupanca_pct),
    )


@router.get("/saude", response_model=CriteriosSaude)
def obter_criterios_saude(
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profissional não encontrado")
    return _criterios_resposta(profissional)


@router.patch("/saude", response_model=CriteriosSaude)
def atualizar_criterios_saude(
    dados: CriteriosSaudeAtualizar,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profissional não encontrado")

    if dados.reserva_min_meses is not None:
        profissional.saude_reserva_min_meses = dados.reserva_min_meses
    if dados.verde_reserva_meses is not None:
        profissional.saude_verde_reserva_meses = dados.verde_reserva_meses
    if dados.verde_poupanca_pct is not None:
        profissional.saude_verde_poupanca_pct = dados.verde_poupanca_pct
    if dados.azul_reserva_meses is not None:
        profissional.saude_azul_reserva_meses = dados.azul_reserva_meses
    if dados.azul_poupanca_pct is not None:
        profissional.saude_azul_poupanca_pct = dados.azul_poupanca_pct

    # Coerência básica: os limiares "azul" (excelente) devem ser >= "verde"
    # (saudável), e os de reserva/poupança não podem ser negativos.
    valores = [
        profissional.saude_reserva_min_meses,
        profissional.saude_verde_reserva_meses,
        profissional.saude_verde_poupanca_pct,
        profissional.saude_azul_reserva_meses,
        profissional.saude_azul_poupanca_pct,
    ]
    if any(float(v) < 0 for v in valores):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Os valores não podem ser negativos.")
    if float(profissional.saude_azul_reserva_meses) < float(profissional.saude_verde_reserva_meses):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A reserva do Azul (excelente) deve ser maior ou igual à do Verde (saudável).",
        )
    if float(profissional.saude_azul_poupanca_pct) < float(profissional.saude_verde_poupanca_pct):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A poupança do Azul (excelente) deve ser maior ou igual à do Verde (saudável).",
        )

    # get_db_com_rls faz o commit ao encerrar a request (mesmo padrão do /marca).
    return _criterios_resposta(profissional)
