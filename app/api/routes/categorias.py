"""
Categorias/subcategorias -- padrão do sistema (visível a todos) + compartilhadas
por profissional (visíveis a todos os clientes dele) + próprias de cada cliente
(ver app/api/routes/clientes.py, únicas pro cliente dono). Aqui é só a visão e
gestão do PLANEJADOR: cria/edita/exclui as compartilhadas do seu escritório,
nunca mexe nas próprias de um cliente (essas só o próprio cliente gerencia).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls, get_profissional_id_atual
from app.models.categoria import Categoria, Subcategoria
from app.models.transacao import Transacao
from app.schemas.categoria import (
    CONTEXTOS,
    TIPOS,
    CategoriaAtualizar,
    CategoriaCriar,
    CategoriaResposta,
    SubcategoriaAtualizar,
    SubcategoriaCriar,
    SubcategoriaResposta,
)

router = APIRouter(tags=["categorias"])


def _categoria_resposta(c: Categoria, profissional_id: uuid.UUID) -> CategoriaResposta:
    editavel = c.cliente_id is None and c.profissional_id == profissional_id
    return CategoriaResposta.model_validate(c).model_copy(update={"editavel": editavel})


def _subcategoria_resposta(s: Subcategoria, profissional_id: uuid.UUID) -> SubcategoriaResposta:
    editavel = s.cliente_id is None and s.profissional_id == profissional_id
    return SubcategoriaResposta.model_validate(s).model_copy(update={"editavel": editavel})


@router.get("/categorias", response_model=list[CategoriaResposta])
def listar_categorias(
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
    db: Session = Depends(get_db_com_rls),
):
    # Esconde as categorias próprias de cada cliente (cliente_id preenchido)
    # dessa tela de gestão do planejador -- só mostra padrão do sistema +
    # compartilhadas do escritório, que são o que ele de fato gerencia aqui.
    categorias = db.scalars(
        select(Categoria).where(Categoria.cliente_id.is_(None)).order_by(Categoria.nome)
    ).all()
    return [_categoria_resposta(c, profissional_id) for c in categorias]


@router.post("/categorias", response_model=CategoriaResposta, status_code=status.HTTP_201_CREATED)
def criar_categoria(
    dados: CategoriaCriar,
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
    db: Session = Depends(get_db_com_rls),
):
    if dados.tipo not in TIPOS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")
    if dados.contexto not in CONTEXTOS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Contexto inválido: {dados.contexto}")
    categoria = Categoria(
        profissional_id=profissional_id,
        nome=dados.nome,
        tipo=dados.tipo,
        icone=dados.icone,
        contexto=dados.contexto,
    )
    db.add(categoria)
    db.flush()
    db.refresh(categoria)
    return _categoria_resposta(categoria, profissional_id)


def _exigir_categoria_editavel(db: Session, categoria_id: uuid.UUID, profissional_id: uuid.UUID) -> Categoria:
    categoria = db.get(Categoria, categoria_id)
    if categoria is None or categoria.cliente_id is not None or categoria.profissional_id != profissional_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada")
    return categoria


@router.patch("/categorias/{categoria_id}", response_model=CategoriaResposta)
def atualizar_categoria(
    categoria_id: uuid.UUID,
    dados: CategoriaAtualizar,
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
    db: Session = Depends(get_db_com_rls),
):
    categoria = _exigir_categoria_editavel(db, categoria_id, profissional_id)
    if dados.contexto is not None and dados.contexto not in CONTEXTOS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Contexto inválido: {dados.contexto}")
    if dados.nome is not None:
        categoria.nome = dados.nome
    if dados.icone is not None:
        categoria.icone = dados.icone
    if dados.contexto is not None:
        categoria.contexto = dados.contexto
    db.flush()
    db.refresh(categoria)
    return _categoria_resposta(categoria, profissional_id)


@router.delete("/categorias/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_categoria(
    categoria_id: uuid.UUID,
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
    db: Session = Depends(get_db_com_rls),
):
    categoria = _exigir_categoria_editavel(db, categoria_id, profissional_id)
    # Sem FK entre transacoes e categorias/subcategorias (de propósito, ver
    # app/models/transacao.py) -- limpa a referência antes de excluir pra não
    # deixar lançamento nenhum apontando pra uma categoria que já não existe.
    sub_ids = list(db.scalars(select(Subcategoria.id).where(Subcategoria.categoria_id == categoria_id)))
    db.query(Transacao).filter(
        Transacao.profissional_id == profissional_id, Transacao.categoria_id == categoria_id
    ).update({"categoria_id": None, "subcategoria_id": None}, synchronize_session=False)
    if sub_ids:
        db.query(Transacao).filter(
            Transacao.profissional_id == profissional_id, Transacao.subcategoria_id.in_(sub_ids)
        ).update({"subcategoria_id": None}, synchronize_session=False)
    db.delete(categoria)  # cascade apaga as subcategorias dela


@router.get("/subcategorias", response_model=list[SubcategoriaResposta])
def listar_subcategorias(
    categoria_id: uuid.UUID | None = None,
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
    db: Session = Depends(get_db_com_rls),
):
    query = select(Subcategoria).where(Subcategoria.cliente_id.is_(None)).order_by(Subcategoria.nome)
    if categoria_id:
        query = query.where(Subcategoria.categoria_id == categoria_id)
    return [_subcategoria_resposta(s, profissional_id) for s in db.scalars(query).all()]


@router.post("/subcategorias", response_model=SubcategoriaResposta, status_code=status.HTTP_201_CREATED)
def criar_subcategoria(
    dados: SubcategoriaCriar,
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
    db: Session = Depends(get_db_com_rls),
):
    categoria = db.get(Categoria, dados.categoria_id)
    if categoria is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada")
    subcategoria = Subcategoria(categoria_id=dados.categoria_id, profissional_id=profissional_id, nome=dados.nome)
    db.add(subcategoria)
    db.flush()
    db.refresh(subcategoria)
    return _subcategoria_resposta(subcategoria, profissional_id)


def _exigir_subcategoria_editavel(db: Session, subcategoria_id: uuid.UUID, profissional_id: uuid.UUID) -> Subcategoria:
    subcategoria = db.get(Subcategoria, subcategoria_id)
    if (
        subcategoria is None
        or subcategoria.cliente_id is not None
        or subcategoria.profissional_id != profissional_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subcategoria não encontrada")
    return subcategoria


@router.patch("/subcategorias/{subcategoria_id}", response_model=SubcategoriaResposta)
def atualizar_subcategoria(
    subcategoria_id: uuid.UUID,
    dados: SubcategoriaAtualizar,
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
    db: Session = Depends(get_db_com_rls),
):
    subcategoria = _exigir_subcategoria_editavel(db, subcategoria_id, profissional_id)
    subcategoria.nome = dados.nome
    db.flush()
    db.refresh(subcategoria)
    return _subcategoria_resposta(subcategoria, profissional_id)


@router.delete("/subcategorias/{subcategoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_subcategoria(
    subcategoria_id: uuid.UUID,
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
    db: Session = Depends(get_db_com_rls),
):
    subcategoria = _exigir_subcategoria_editavel(db, subcategoria_id, profissional_id)
    db.query(Transacao).filter(
        Transacao.profissional_id == profissional_id, Transacao.subcategoria_id == subcategoria_id
    ).update({"subcategoria_id": None}, synchronize_session=False)
    db.delete(subcategoria)
