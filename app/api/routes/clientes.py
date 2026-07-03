import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls, get_profissional_id_atual
from app.core.config import settings
from app.models.cliente import Cliente
from app.schemas.cliente import ClienteCriar, ClienteExcluir, ClienteResposta

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("", response_model=list[ClienteResposta])
def listar_clientes(db: Session = Depends(get_db_com_rls)):
    # Graças ao RLS, esta query já vem filtrada para o profissional autenticado
    # mesmo sem WHERE explícito — mas mantemos o filtro de status por clareza.
    clientes = db.scalars(select(Cliente).where(Cliente.status == "ativo")).all()
    return clientes


@router.post("", response_model=ClienteResposta, status_code=status.HTTP_201_CREATED)
def criar_cliente(
    dados: ClienteCriar,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    total_ativos = db.scalar(
        select(Cliente).where(Cliente.status == "ativo")
    )
    # Nota: isto é ilustrativo — em produção, usar select(func.count()) em vez
    # de carregar o objeto. Mantido simples aqui para foco na regra de negócio.
    qtd_ativos = len(db.scalars(select(Cliente).where(Cliente.status == "ativo")).all())

    cliente = Cliente(
        profissional_id=profissional_id,
        nome=dados.nome,
        tipo=dados.tipo,
        documento=dados.documento,
        valor_honorario_mensal=dados.valor_honorario_mensal,
        data_cadastro=date.today(),
    )
    db.add(cliente)
    db.flush()

    # Cadastrar já cobra o ciclo atual integral (regra fechada anteriormente).
    # A geração da cobrança em si é responsabilidade do job de faturamento,
    # não desta rota — aqui só garantimos que o cliente entrou no cômputo
    # do próximo fechamento de ciclo.
    if qtd_ativos >= settings.CLIENTES_INCLUSOS_PLANO_BASE:
        # Sinalização para o frontend mostrar o aviso de cliente extra.
        # (não bloqueia a criação — cliente extra é permitido, só é cobrado)
        pass

    db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}", status_code=status.HTTP_200_OK)
def excluir_cliente(
    cliente_id: uuid.UUID,
    dados: ClienteExcluir,
    db: Session = Depends(get_db_com_rls),
):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        # Por causa do RLS, um cliente de outro profissional simplesmente
        # não é encontrado aqui — não vaza informação sobre existência dele.
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    hoje = date.today()
    dentro_do_prazo = hoje <= cliente.data_limite_exclusao

    cliente.status = "excluido"
    cliente.data_exclusao = hoje
    cliente.motivo_churn = dados.motivo_churn
    cliente.motivo_churn_detalhe = dados.motivo_churn_detalhe
    db.add(cliente)

    return {
        "gerara_cobranca_proximo_ciclo": not dentro_do_prazo,
        "data_limite_que_era": cliente.data_limite_exclusao,
    }
