"""
Configuração da marca própria (white-label) do planejador: nome exibido, cor,
subdomínio e vídeo de boas-vindas. Recurso do plano Completo (liberado também
no trial). O upload de logo é um passo à parte (precisa de bucket público).
"""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls, get_profissional_id_atual
from app.core.planos import pode_usar_marca
from app.db.base import SessionLocalAdmin
from app.models.assinatura import Assinatura
from app.models.profissional import Profissional
from app.schemas.cliente import MarcaAtualizar

router = APIRouter(prefix="/marca", tags=["marca"])


def _exigir_pode_marca(db: Session, profissional: Profissional) -> None:
    assinatura = db.scalar(select(Assinatura).where(Assinatura.profissional_id == profissional.id))
    tipo_plano = assinatura.tipo_plano if assinatura else None
    if not pode_usar_marca(profissional, tipo_plano):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Marca própria está disponível no plano Completo.",
        )


@router.patch("")
def atualizar_marca(
    dados: MarcaAtualizar,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profissional não encontrado")
    _exigir_pode_marca(db, profissional)

    if dados.nome_empresa is not None:
        profissional.nome_empresa = dados.nome_empresa.strip() or None

    if dados.cor_marca is not None:
        cor = dados.cor_marca.strip()
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", cor):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Cor inválida (use formato #RRGGBB).")
        profissional.cor_marca = cor

    if dados.subdominio is not None:
        sub = re.sub(r"[^a-z0-9]", "", dados.subdominio.lower())
        if not sub:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Subdomínio inválido.")
        if sub != profissional.subdominio:
            # A unicidade PRECISA ser checada pela conexão privilegiada: sob RLS
            # a policy só deixa ver a própria linha, então um subdomínio já usado
            # por OUTRO tenant passaria despercebido aqui e estouraria na
            # constraint UNIQUE (500). Mesmo motivo do check de nickname no
            # cadastro do cliente.
            with SessionLocalAdmin() as db_admin:
                existe = db_admin.scalar(
                    select(Profissional.id).where(
                        Profissional.subdominio == sub, Profissional.id != profissional_id
                    )
                )
            if existe:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Subdomínio já está em uso.")
            profissional.subdominio = sub

    if dados.video_boas_vindas is not None:
        profissional.video_boas_vindas = dados.video_boas_vindas.strip() or None

    return {
        "nome_empresa": profissional.nome_empresa,
        "cor_marca": profissional.cor_marca,
        "subdominio": profissional.subdominio,
        "video_boas_vindas": profissional.video_boas_vindas,
    }
