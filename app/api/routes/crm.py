"""
CRM do profissional — linha do tempo de interações e follow-ups por cliente,
mais a integração opcional com o Google Agenda (espelha follow-ups como
eventos). Tudo isolado por profissional via RLS (get_db_com_rls).

O acesso a um cliente é validado sempre por `db.get(Cliente, id)`: sob RLS,
um cliente de outro profissional volta como None -> 404, então não há como
criar interação/follow-up para cliente que não é seu.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_cliente_id_atual, get_db_admin, get_db_com_rls, get_profissional_id_atual
from app.core.config import settings
from app.core.security import criar_state_oauth_google, decodificar_state_oauth_google
from app.db.base import SessionLocal
from app.integrations import google_calendar as gcal
from app.models.cliente import Cliente
from app.models.crm import CredencialGoogle, FollowUp, InteracaoCrm, TarefaCliente
from app.api.routes.notificacoes import notificar_cliente
from app.schemas.crm import (
    TIPOS_INTERACAO,
    FollowUpAtualizar,
    FollowUpCriar,
    FollowUpResposta,
    GoogleAuthUrlResposta,
    GoogleStatusResposta,
    InteracaoCriar,
    InteracaoResposta,
    TarefaAtualizar,
    TarefaConcluir,
    TarefaCriar,
    TarefaResposta,
)

router = APIRouter(prefix="/crm", tags=["crm"])
router_cliente = APIRouter(prefix="/clientes/eu", tags=["crm-cliente"])


def _exigir_cliente(db: Session, cliente_id: uuid.UUID) -> Cliente:
    cliente = db.get(Cliente, cliente_id)
    if cliente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")
    return cliente


# ============================================================================
# Timeline de interações
# ============================================================================


@router.get("/clientes/{cliente_id}/interacoes", response_model=list[InteracaoResposta])
def listar_interacoes(
    cliente_id: uuid.UUID,
    db: Session = Depends(get_db_com_rls),
):
    _exigir_cliente(db, cliente_id)
    return db.scalars(
        select(InteracaoCrm)
        .where(InteracaoCrm.cliente_id == cliente_id)
        .order_by(InteracaoCrm.data_interacao.desc())
    ).all()


@router.post(
    "/clientes/{cliente_id}/interacoes",
    response_model=InteracaoResposta,
    status_code=status.HTTP_201_CREATED,
)
def criar_interacao(
    cliente_id: uuid.UUID,
    dados: InteracaoCriar,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    _exigir_cliente(db, cliente_id)
    if dados.tipo not in TIPOS_INTERACAO:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")

    interacao = InteracaoCrm(
        cliente_id=cliente_id,
        profissional_id=profissional_id,
        tipo=dados.tipo,
        titulo=dados.titulo,
        descricao=dados.descricao,
        ator_tipo="profissional",
        data_interacao=dados.data_interacao or datetime.now(timezone.utc),
    )
    db.add(interacao)
    db.flush()
    db.refresh(interacao)
    return interacao


@router.delete("/interacoes/{interacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_interacao(
    interacao_id: uuid.UUID,
    db: Session = Depends(get_db_com_rls),
):
    interacao = db.get(InteracaoCrm, interacao_id)
    if interacao is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interação não encontrada")
    db.delete(interacao)


# ============================================================================
# Tarefas do cliente (checklist passado pelo profissional)
# ============================================================================


@router.get("/clientes/{cliente_id}/tarefas", response_model=list[TarefaResposta])
def listar_tarefas_cliente(
    cliente_id: uuid.UUID,
    db: Session = Depends(get_db_com_rls),
):
    _exigir_cliente(db, cliente_id)
    return db.scalars(
        select(TarefaCliente)
        .where(TarefaCliente.cliente_id == cliente_id)
        .order_by(TarefaCliente.concluido.asc(), TarefaCliente.prazo.asc().nulls_last(), TarefaCliente.criado_em.desc())
    ).all()


@router.post(
    "/clientes/{cliente_id}/tarefas",
    response_model=TarefaResposta,
    status_code=status.HTTP_201_CREATED,
)
def criar_tarefa_cliente(
    cliente_id: uuid.UUID,
    dados: TarefaCriar,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    _exigir_cliente(db, cliente_id)
    tarefa = TarefaCliente(
        cliente_id=cliente_id,
        profissional_id=profissional_id,
        titulo=dados.titulo,
        descricao=dados.descricao,
        prazo=dados.prazo,
    )
    db.add(tarefa)
    notificar_cliente(
        db, cliente_id, profissional_id, "outro",
        "Nova tarefa do seu planejador",
        f'"{dados.titulo}" foi adicionada à sua lista de tarefas.',
    )
    db.flush()
    db.refresh(tarefa)
    return tarefa


@router.patch("/tarefas/{tarefa_id}", response_model=TarefaResposta)
def atualizar_tarefa_cliente(
    tarefa_id: uuid.UUID,
    dados: TarefaAtualizar,
    db: Session = Depends(get_db_com_rls),
):
    tarefa = db.get(TarefaCliente, tarefa_id)
    if tarefa is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarefa não encontrada")

    if dados.titulo is not None:
        tarefa.titulo = dados.titulo
    if dados.descricao is not None:
        tarefa.descricao = dados.descricao
    if dados.prazo is not None:
        tarefa.prazo = dados.prazo
    if dados.concluido is not None:
        tarefa.concluido = dados.concluido
        tarefa.concluido_em = datetime.now(timezone.utc) if dados.concluido else None

    return tarefa


@router.delete("/tarefas/{tarefa_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_tarefa_cliente(
    tarefa_id: uuid.UUID,
    db: Session = Depends(get_db_com_rls),
):
    tarefa = db.get(TarefaCliente, tarefa_id)
    if tarefa is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarefa não encontrada")
    db.delete(tarefa)


# ============================================================================
# Follow-ups (próximos contatos agendados)
# ============================================================================


def _follow_up_para_resposta(f: FollowUp, cliente_nome: str | None = None) -> dict:
    return {
        "id": f.id,
        "cliente_id": f.cliente_id,
        "cliente_nome": cliente_nome,
        "data_prevista": f.data_prevista,
        "observacao": f.observacao,
        "concluido": f.concluido,
        "concluido_em": f.concluido_em,
        "sincronizado_google": f.sincronizado_google,
        "criado_em": f.criado_em,
    }


@router.get("/follow-ups", response_model=list[FollowUpResposta])
def listar_follow_ups(
    apenas_pendentes: bool = True,
    db: Session = Depends(get_db_com_rls),
):
    """Agenda geral do profissional — follow-ups de todos os clientes,
    ordenados por data prevista. Usado pra visão consolidada no CRM."""
    q = (
        select(FollowUp, Cliente.nome)
        .join(Cliente, Cliente.id == FollowUp.cliente_id)
        .order_by(FollowUp.data_prevista.asc())
    )
    if apenas_pendentes:
        q = q.where(FollowUp.concluido.is_(False))
    linhas = db.execute(q).all()
    return [_follow_up_para_resposta(f, nome) for f, nome in linhas]


@router.get("/clientes/{cliente_id}/follow-ups", response_model=list[FollowUpResposta])
def listar_follow_ups_cliente(
    cliente_id: uuid.UUID,
    db: Session = Depends(get_db_com_rls),
):
    cliente = _exigir_cliente(db, cliente_id)
    follow_ups = db.scalars(
        select(FollowUp)
        .where(FollowUp.cliente_id == cliente_id)
        .order_by(FollowUp.data_prevista.asc())
    ).all()
    return [_follow_up_para_resposta(f, cliente.nome) for f in follow_ups]


@router.post(
    "/clientes/{cliente_id}/follow-ups",
    response_model=FollowUpResposta,
    status_code=status.HTTP_201_CREATED,
)
def criar_follow_up(
    cliente_id: uuid.UUID,
    dados: FollowUpCriar,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    cliente = _exigir_cliente(db, cliente_id)
    follow_up = FollowUp(
        cliente_id=cliente_id,
        profissional_id=profissional_id,
        data_prevista=dados.data_prevista,
        observacao=dados.observacao,
    )
    db.add(follow_up)
    db.flush()
    # Pega os defaults do banco (criado_em, concluido) ANTES de sincronizar --
    # se der refresh() depois de setar google_event_id, o refresh sobrescreve
    # o campo recém-gravado com o valor NULL do banco e a sincronização "some".
    db.refresh(follow_up)

    # Espelha no Google Agenda se pedido e a conta estiver conectada. Falha de
    # sincronização não derruba a criação do follow-up (fica só local).
    if dados.sincronizar_google:
        cred = db.get(CredencialGoogle, profissional_id)
        if cred is not None and gcal.oauth_configurado():
            try:
                token = _access_token_valido(db, cred)
                titulo = f"Follow-up: {cliente.nome}"
                event_id = gcal.criar_evento_dia_inteiro(
                    token, cred.calendar_id, titulo, dados.observacao, dados.data_prevista
                )
                follow_up.google_event_id = event_id
                follow_up.sincronizado_google = True
                db.flush()  # persiste o event_id (commit final é do get_db_com_rls)
            except Exception:
                # mantém sincronizado_google=False; o profissional pode tentar de novo
                pass

    return _follow_up_para_resposta(follow_up, cliente.nome)


@router.patch("/follow-ups/{follow_up_id}", response_model=FollowUpResposta)
def atualizar_follow_up(
    follow_up_id: uuid.UUID,
    dados: FollowUpAtualizar,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    follow_up = db.get(FollowUp, follow_up_id)
    if follow_up is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Follow-up não encontrado")

    if dados.concluido is not None:
        follow_up.concluido = dados.concluido
        follow_up.concluido_em = datetime.now(timezone.utc) if dados.concluido else None

    # Detecta mudança de data/observação pra propagar ao Google só quando muda.
    mudou_evento = (dados.data_prevista is not None and dados.data_prevista != follow_up.data_prevista) or (
        dados.observacao is not None and dados.observacao != follow_up.observacao
    )
    if dados.data_prevista is not None:
        follow_up.data_prevista = dados.data_prevista
    if dados.observacao is not None:
        follow_up.observacao = dados.observacao

    cliente = db.get(Cliente, follow_up.cliente_id)

    # Espelha a edição no evento do Google (best-effort), se o follow-up já
    # tem um evento sincronizado.
    if mudou_evento and follow_up.google_event_id and gcal.oauth_configurado():
        cred = db.get(CredencialGoogle, profissional_id)
        if cred is not None:
            try:
                token = _access_token_valido(db, cred)
                titulo = f"Follow-up: {cliente.nome}" if cliente else "Follow-up"
                gcal.atualizar_evento_dia_inteiro(
                    token,
                    cred.calendar_id,
                    follow_up.google_event_id,
                    titulo,
                    follow_up.observacao,
                    follow_up.data_prevista,
                )
            except Exception:
                pass

    return _follow_up_para_resposta(follow_up, cliente.nome if cliente else None)


@router.delete("/follow-ups/{follow_up_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_follow_up(
    follow_up_id: uuid.UUID,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    follow_up = db.get(FollowUp, follow_up_id)
    if follow_up is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Follow-up não encontrado")

    # Remove o evento espelhado no Google, se houver (best-effort).
    if follow_up.google_event_id:
        cred = db.get(CredencialGoogle, profissional_id)
        if cred is not None and gcal.oauth_configurado():
            try:
                token = _access_token_valido(db, cred)
                gcal.excluir_evento(token, cred.calendar_id, follow_up.google_event_id)
            except Exception:
                pass

    db.delete(follow_up)


# ============================================================================
# Integração Google Agenda (OAuth)
# ============================================================================


def _access_token_valido(db: Session, cred: CredencialGoogle) -> str:
    """Retorna um access_token válido, renovando via refresh_token quando
    expirado (com 60s de folga) e persistindo o novo token."""
    agora = datetime.now(timezone.utc)
    expira = cred.access_token_expira_em
    if expira is not None and expira.tzinfo is None:
        expira = expira.replace(tzinfo=timezone.utc)
    if cred.access_token and expira and expira > agora:
        return cred.access_token

    novo = gcal.renovar_access_token(cred.refresh_token)
    cred.access_token = novo["access_token"]
    cred.access_token_expira_em = novo["expira_em"]
    db.flush()
    return cred.access_token


@router.get("/google/status", response_model=GoogleStatusResposta)
def google_status(
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    cred = db.get(CredencialGoogle, profissional_id)
    return GoogleStatusResposta(
        configurado=gcal.oauth_configurado(),
        conectado=cred is not None,
        email_google=cred.email_google if cred else None,
    )


@router.get("/google/conectar", response_model=GoogleAuthUrlResposta)
def google_conectar(
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    if not gcal.oauth_configurado():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Integração com o Google não está configurada no servidor.",
        )
    state = criar_state_oauth_google(str(profissional_id))
    return GoogleAuthUrlResposta(url=gcal.gerar_url_consentimento(state))


@router.get("/google/callback")
def google_callback(state: str, code: str | None = None, error: str | None = None):
    """Callback do OAuth do Google (aberta direto pelo navegador, sem Bearer).
    A identidade do profissional vem do `state` assinado. Ao final, redireciona
    de volta pro frontend com um marcador de sucesso/erro."""
    destino_ok = f"{settings.FRONTEND_URL or ''}/crm?google=conectado"
    destino_erro = f"{settings.FRONTEND_URL or ''}/crm?google=erro"

    profissional_id = decodificar_state_oauth_google(state)
    if not profissional_id or error or not code:
        return RedirectResponse(destino_erro)

    try:
        tokens = gcal.trocar_codigo_por_tokens(code)
    except Exception:
        return RedirectResponse(destino_erro)

    if not tokens.get("refresh_token"):
        # Sem refresh_token não conseguimos renovar depois — normalmente
        # acontece quando o usuário já autorizou antes sem revogar. prompt=consent
        # deve evitar, mas por segurança tratamos como erro.
        return RedirectResponse(destino_erro)

    # Callback não passa por get_db_com_rls (não há Bearer aqui): usamos uma
    # sessão com o contexto de RLS setado manualmente pro profissional do state.
    from sqlalchemy import text

    db = SessionLocal()
    try:
        db.execute(text("SET LOCAL app.current_profissional_id = :pid"), {"pid": profissional_id})
        db.execute(text("SET LOCAL app.is_admin = 'false'"))
        cred = db.get(CredencialGoogle, uuid.UUID(profissional_id))
        if cred is None:
            cred = CredencialGoogle(profissional_id=uuid.UUID(profissional_id))
            db.add(cred)
        cred.refresh_token = tokens["refresh_token"]
        cred.access_token = tokens["access_token"]
        cred.access_token_expira_em = tokens["expira_em"]
        cred.email_google = tokens["email_google"]
        db.commit()
    except Exception:
        db.rollback()
        return RedirectResponse(destino_erro)
    finally:
        db.close()

    return RedirectResponse(destino_ok)


@router.delete("/google/desconectar", status_code=status.HTTP_204_NO_CONTENT)
def google_desconectar(
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    cred = db.get(CredencialGoogle, profissional_id)
    if cred is not None:
        db.delete(cred)


# ============================================================================
# Tarefas — visão do cliente final (só lê e marca como concluída)
# ============================================================================


@router_cliente.get("/tarefas", response_model=list[TarefaResposta])
def listar_minhas_tarefas(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    return db.scalars(
        select(TarefaCliente)
        .where(TarefaCliente.cliente_id == cliente_id)
        .order_by(TarefaCliente.concluido.asc(), TarefaCliente.prazo.asc().nulls_last(), TarefaCliente.criado_em.desc())
    ).all()


@router_cliente.patch("/tarefas/{tarefa_id}", response_model=TarefaResposta)
def concluir_minha_tarefa(
    tarefa_id: uuid.UUID,
    dados: TarefaConcluir,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    tarefa = db.get(TarefaCliente, tarefa_id)
    if tarefa is None or tarefa.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarefa não encontrada")
    tarefa.concluido = dados.concluido
    tarefa.concluido_em = datetime.now(timezone.utc) if dados.concluido else None
    return tarefa
