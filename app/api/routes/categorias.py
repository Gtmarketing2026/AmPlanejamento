"""
Leitura de categorias/subcategorias (padrão do sistema + custom do
profissional). RLS já filtra: profissional_id IS NULL (padrão) OR
profissional_id = tenant atual -- só GET por enquanto, sem CRUD ainda
(criar categoria/subcategoria fica pra outra leva, ver CLAUDE.md).
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls
from app.models.categoria import Categoria, Subcategoria
from app.schemas.categoria import CategoriaResposta, SubcategoriaResposta

router = APIRouter(tags=["categorias"])


@router.get("/categorias", response_model=list[CategoriaResposta])
def listar_categorias(db: Session = Depends(get_db_com_rls)):
    return db.scalars(select(Categoria).order_by(Categoria.nome)).all()


@router.get("/subcategorias", response_model=list[SubcategoriaResposta])
def listar_subcategorias(categoria_id: uuid.UUID | None = None, db: Session = Depends(get_db_com_rls)):
    query = select(Subcategoria).order_by(Subcategoria.nome)
    if categoria_id:
        query = query.where(Subcategoria.categoria_id == categoria_id)
    return db.scalars(query).all()
