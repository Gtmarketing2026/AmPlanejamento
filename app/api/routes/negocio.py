"""
Nível "Negócio" — admin dono/operador da plataforma Fluxo (tabela `admins`,
separada de `profissionais`). Ver CLAUDE.md, seção "Três níveis de acesso".

Login é independente do login de profissional (app/api/routes/auth.py) e do
de cliente final (app/api/routes/clientes.py): tabela própria, JWT com
tipo="admin", nunca aceito nas rotas dos outros dois níveis e vice-versa.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import get_admin_id_atual, get_db_negocio, get_db_sem_rls
from app.core.security import criar_access_token, hash_senha, verificar_senha
from app.models.admin import Admin
from app.models.cliente import Cliente
from app.models.despesa_operacional import DespesaOperacional
from app.models.profissional import Profissional
from app.models.transacao import Transacao
from app.schemas.cliente import LoginRequest, TokenResponse
from app.schemas.negocio import (
    AdminAtualizar,
    AdminPerfilResposta,
    CapacidadeItem,
    ClienteDoPlanejadorResposta,
    CredenciaisClienteAtualizar,
    CredenciaisClienteResposta,
    CredenciaisProfissionalAtualizar,
    CredenciaisProfissionalResposta,
    DespesaCriar,
    DespesaResposta,
    FaturaPlataformaResposta,
    MetricasNegocioResposta,
    PlanejadorResposta,
    StatusClienteAtualizar,
    StatusPlanejadorAtualizar,
    TransacaoNegocioResposta,
    TrialAtualizar,
)

router = APIRouter(prefix="/negocio", tags=["negocio"])


@router.post("/login", response_model=TokenResponse)
def login_admin(dados: LoginRequest, db: Session = Depends(get_db_sem_rls)):
    # get_db_sem_rls usa a conexão privilegiada -- necessário aqui porque o
    # login busca por e-mail sem ainda ter nenhum contexto de RLS (mesma
    # razão do login de profissional/cliente final).
    admin = db.scalar(select(Admin).where(Admin.email == dados.email))
    if not admin or not verificar_senha(dados.senha, admin.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos")

    token = criar_access_token(str(admin.id), tipo="admin")
    return TokenResponse(access_token=token)


@router.get("/perfil", response_model=AdminPerfilResposta)
def perfil_admin(
    admin_id: uuid.UUID = Depends(get_admin_id_atual),
    db: Session = Depends(get_db_negocio),
):
    admin = db.get(Admin, admin_id)
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin não encontrado")
    return admin


@router.patch("/perfil", response_model=AdminPerfilResposta)
def atualizar_perfil_admin(
    dados: AdminAtualizar,
    admin_id: uuid.UUID = Depends(get_admin_id_atual),
    db: Session = Depends(get_db_negocio),
):
    """O admin edita a própria senha e/ou e-mail de login (nível Negócio)."""
    admin = db.get(Admin, admin_id)
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin não encontrado")

    dados_informados = dados.model_dump(exclude_unset=True)

    novo_email = dados_informados.pop("email", None)
    if novo_email and novo_email != admin.email:
        ja_existe = db.scalar(select(Admin).where(Admin.email == novo_email, Admin.id != admin_id))
        if ja_existe:
            raise HTTPException(status_code=400, detail="E-mail já está em uso")
        admin.email = novo_email

    nova_senha = dados_informados.pop("senha", None)
    if nova_senha:
        admin.senha_hash = hash_senha(nova_senha)

    for campo, valor in dados_informados.items():
        setattr(admin, campo, valor)

    db.add(admin)
    db.flush()
    db.refresh(admin)
    return admin


@router.get("/metricas", response_model=MetricasNegocioResposta)
def metricas_negocio(db: Session = Depends(get_db_negocio)):
    dados = dict(db.execute(text("SELECT * FROM vw_metricas_negocio")).mappings().first())

    # Churn / retenção — calculados fora da view (evita migração da view em
    # produção; a view segue só com os KPIs originais).
    extra = db.execute(
        text("""
            SELECT
              (SELECT COUNT(*) FROM profissionais WHERE status = 'congelada') AS planejadores_congelados,
              (SELECT COUNT(*) FROM profissionais WHERE status = 'cancelada') AS planejadores_cancelados,
              (SELECT COUNT(*) FROM profissionais) AS planejadores_total,
              (SELECT COUNT(*) FROM clientes WHERE status = 'excluido') AS clientes_excluidos_total,
              (SELECT COALESCE(ROUND(SUM(valor_base + valor_extras), 2), 0)
                 FROM faturas WHERE status = 'paga') AS receita_acumulada,
              -- Vida média em meses: ativos contam até hoje; cancelados até o
              -- cancelamento (fallback: última atividade). ~30.44 dias/mês.
              (SELECT ROUND(AVG(meses)::numeric, 1) FROM (
                  SELECT EXTRACT(EPOCH FROM (
                            CASE WHEN p.status = 'cancelada'
                                 THEN COALESCE(a.data_cancelamento::timestamp, now())
                                 ELSE now() END
                            - p.criado_em
                         )) / (30.44 * 86400) AS meses
                  FROM profissionais p
                  LEFT JOIN LATERAL (
                      SELECT data_cancelamento FROM assinaturas
                      WHERE profissional_id = p.id ORDER BY criado_em DESC LIMIT 1
                  ) a ON true
              ) t) AS tempo_medio_assinatura_meses
        """)
    ).mappings().first()
    dados.update(dict(extra))

    total = dados.pop("planejadores_total", 0) or 0
    cancelados = dados.get("planejadores_cancelados", 0) or 0
    dados["churn_pct"] = round(cancelados / total * 100, 1) if total else None

    ticket = float(dados.get("ticket_medio") or 0)
    tempo = float(dados.get("tempo_medio_assinatura_meses") or 0)
    dados["ltv"] = round(ticket * tempo, 2) if ticket and tempo else None

    return dados


@router.get("/capacidade", response_model=list[CapacidadeItem])
def capacidade_e_limites(db: Session = Depends(get_db_negocio)):
    """Limites dos serviços externos que podem travar o sistema ao crescer.
    Onde dá, medimos o uso atual; onde não, marcamos como referência (info).
    Os limites são do tier de entrada de cada serviço -- se o plano pago for
    contratado, o teto sobe (a observação diz qual)."""
    # --- Medições reais ---
    google_conectados = db.scalar(text("SELECT COUNT(*) FROM credenciais_google")) or 0
    planejadores_total = db.scalar(text("SELECT COUNT(*) FROM profissionais")) or 0
    clientes_total = db.scalar(text("SELECT COUNT(*) FROM clientes")) or 0
    contas_of = db.scalar(
        text("SELECT COUNT(*) FROM contas_conectadas WHERE modo = 'open_finance'")
    ) or 0
    db_bytes = db.scalar(text("SELECT pg_database_size(current_database())")) or 0
    db_mb = round(db_bytes / (1024 * 1024), 1)

    def nivel(uso, limite, at=0.7, crit=0.9):
        if not limite:
            return "info"
        r = uso / limite
        return "critico" if r >= crit else "atencao" if r >= at else "ok"

    itens = [
        CapacidadeItem(
            servico="Google Agenda (OAuth)",
            recurso="Usuários no app em modo Teste",
            uso_atual=float(google_conectados),
            limite=100,
            unidade="planejadores conectados",
            nivel=nivel(google_conectados, 100),
            observacao=(
                "O app OAuth está em modo Teste: no máximo 100 usuários podem conectar o Google Agenda. "
                "Pra ir além, publicar/verificar o app no Google Cloud (processo de verificação)."
            ),
        ),
        CapacidadeItem(
            servico="Supabase (banco Postgres)",
            recurso="Tamanho do banco de dados",
            uso_atual=db_mb,
            limite=500,
            unidade="MB",
            nivel=nivel(db_mb, 500),
            observacao="Limite do plano Free (500 MB). No plano Pro sobe pra 8 GB. Também pausa o projeto após 1 semana sem uso no Free.",
        ),
        CapacidadeItem(
            servico="Supabase",
            recurso="Conexões conectadas via Open Finance",
            uso_atual=float(contas_of),
            limite=None,
            unidade="contas",
            nivel="info",
            observacao="Depende do plano da Pluggy quando o Open Finance for ativado (hoje a importação é por arquivo).",
        ),
        CapacidadeItem(
            servico="Vercel (hospedagem)",
            recurso="Plano / uso comercial",
            uso_atual=None,
            limite=None,
            unidade="",
            nivel="info",
            observacao="Plano Hobby é só p/ uso não-comercial e tem 100 GB de banda/mês + limite de execução das funções. Uso comercial exige o plano Pro.",
        ),
        CapacidadeItem(
            servico="OpenAI (classificação por IA)",
            recurso="Requisições por minuto / custo por token",
            uso_atual=None,
            limite=None,
            unidade="",
            nivel="info",
            observacao="Tem limite de requisições/minuto por tier e custo por token — escala com o volume de importações. Monitorar custo conforme cresce.",
        ),
        CapacidadeItem(
            servico="Plataforma",
            recurso="Planejadores cadastrados",
            uso_atual=float(planejadores_total),
            limite=None,
            unidade="planejadores",
            nivel="info",
            observacao=f"{planejadores_total} planejadores e {clientes_total} clientes finais hoje. Sem limite fixo no sistema — o gargalo aparece antes nos serviços acima.",
        ),
    ]
    return itens


@router.get("/planejadores", response_model=list[PlanejadorResposta])
def listar_planejadores(db: Session = Depends(get_db_negocio)):
    # bypass de app.is_admin já ativo nesta conexão (get_db_negocio) -- por
    # isso o SELECT abaixo enxerga profissionais de TODOS os tenants, mesmo
    # sem current_profissional_id setado.
    linhas = db.execute(
        text("""
            SELECT
                p.id, p.nome, p.email, p.subdominio, p.status, p.criado_em, p.trial_ate,
                (p.trial_ate IS NOT NULL AND p.trial_ate >= CURRENT_DATE) AS em_trial,
                atual.tipo_plano AS tipo_plano_atual,
                COALESCE(qtd.clientes_ativos, 0) AS clientes_ativos,
                COALESCE(ultimo.mrr_contribuido, 0) AS mrr_contribuido
            FROM profissionais p
            LEFT JOIN LATERAL (
                SELECT tipo_plano FROM assinaturas
                WHERE profissional_id = p.id ORDER BY criado_em DESC LIMIT 1
            ) atual ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS clientes_ativos FROM clientes
                WHERE profissional_id = p.id AND status = 'ativo'
            ) qtd ON true
            LEFT JOIN LATERAL (
                SELECT (valor_base + valor_extras) AS mrr_contribuido FROM faturas
                WHERE profissional_id = p.id ORDER BY ciclo_referencia DESC LIMIT 1
            ) ultimo ON true
            ORDER BY p.criado_em DESC
        """)
    ).mappings().all()
    return [dict(linha) for linha in linhas]


@router.get("/planejadores/{profissional_id}/clientes", response_model=list[ClienteDoPlanejadorResposta])
def listar_clientes_do_planejador(profissional_id: uuid.UUID, db: Session = Depends(get_db_negocio)):
    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planejador não encontrado")

    clientes = db.scalars(select(Cliente).where(Cliente.profissional_id == profissional_id)).all()
    return clientes


@router.post("/planejadores/{profissional_id}/entrar", response_model=TokenResponse)
def entrar_como_planejador(profissional_id: uuid.UUID, db: Session = Depends(get_db_negocio)):
    """Emite um token de profissional de verdade -- o admin entra no MESMO
    app que o planejador usa (Dashboard, Clientes, CRM, Faturas...), não uma
    tela resumida à parte. Não precisa da senha dele: o bypass de RLS
    (get_db_negocio) já dá acesso total aos dados; isso só troca a
    experiência de views bespoke do admin pela SPA real do profissional."""
    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planejador não encontrado")
    token = criar_access_token(str(profissional_id), tipo="profissional")
    return TokenResponse(access_token=token)


@router.post("/clientes/{cliente_id}/entrar", response_model=TokenResponse)
def entrar_como_cliente(cliente_id: uuid.UUID, db: Session = Depends(get_db_negocio)):
    """Mesma ideia, pro dashboard do cliente final -- 100% do painel dele,
    não uma listagem de lançamentos à parte."""
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    token = criar_access_token(str(cliente_id), tipo="cliente_final")
    return TokenResponse(access_token=token)


@router.patch("/planejadores/{profissional_id}/credenciais", response_model=CredenciaisProfissionalResposta)
def atualizar_credenciais_planejador(
    profissional_id: uuid.UUID, dados: CredenciaisProfissionalAtualizar, db: Session = Depends(get_db_negocio)
):
    """Suporte: admin reseta e-mail/senha de login de um planejador (ex: ele
    esqueceu a senha ou perdeu acesso ao e-mail). Bypass de RLS já ativo
    nesta conexão (get_db_negocio) -- enxerga qualquer profissional."""
    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planejador não encontrado")

    dados_informados = dados.model_dump(exclude_unset=True)

    novo_email = dados_informados.pop("email", None)
    if novo_email and novo_email != profissional.email:
        ja_existe = db.scalar(
            select(Profissional).where(Profissional.email == novo_email, Profissional.id != profissional_id)
        )
        if ja_existe:
            raise HTTPException(status_code=400, detail="E-mail já está em uso")
        profissional.email = novo_email

    nova_senha = dados_informados.pop("senha", None)
    if nova_senha:
        profissional.senha_hash = hash_senha(nova_senha)

    db.add(profissional)
    db.flush()
    db.refresh(profissional)
    return profissional


@router.patch("/clientes/{cliente_id}/credenciais", response_model=CredenciaisClienteResposta)
def atualizar_credenciais_cliente(
    cliente_id: uuid.UUID, dados: CredenciaisClienteAtualizar, db: Session = Depends(get_db_negocio)
):
    """Mesma ideia, pro cliente final: admin reseta nickname/senha de login
    sem precisar acionar o planejador dele."""
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")

    dados_informados = dados.model_dump(exclude_unset=True)

    novo_nickname = dados_informados.pop("nickname", None)
    if novo_nickname and novo_nickname != cliente.nickname:
        ja_existe = db.scalar(select(Cliente).where(Cliente.nickname == novo_nickname, Cliente.id != cliente_id))
        if ja_existe:
            raise HTTPException(status_code=400, detail="Nickname já está em uso")
        cliente.nickname = novo_nickname

    nova_senha = dados_informados.pop("senha", None)
    if nova_senha:
        cliente.senha_hash = hash_senha(nova_senha)

    db.add(cliente)
    db.flush()
    db.refresh(cliente)
    return cliente


@router.patch("/planejadores/{profissional_id}/status")
def atualizar_status_planejador(
    profissional_id: uuid.UUID,
    dados: StatusPlanejadorAtualizar,
    admin_id: uuid.UUID = Depends(get_admin_id_atual),
    db: Session = Depends(get_db_negocio),
):
    """Ativar/congelar/cancelar o acesso de um planejador. Congelar ou
    cancelar também pausa as conexões Open Finance dos clientes dele (mesma
    semântica da régua de inadimplência automatizada, disparada aqui
    manualmente pelo admin)."""
    if dados.status not in ("ativa", "congelada", "cancelada"):
        raise HTTPException(status_code=422, detail="status inválido")

    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planejador não encontrado")

    status_anterior = profissional.status
    profissional.status = dados.status
    db.add(profissional)

    if dados.status in ("congelada", "cancelada"):
        db.execute(
            text("""
                UPDATE contas_conectadas SET status = 'pausada'
                WHERE profissional_id = :pid AND status = 'ativa'
            """),
            {"pid": str(profissional_id)},
        )

    # auditoria_log.ator_tipo não tem valor "admin" (só profissional/
    # cliente_final/sistema) -- usamos 'sistema' e guardamos o admin_id no
    # detalhe pra manter rastreabilidade sem precisar migrar o schema.
    db.execute(
        text("""
            INSERT INTO auditoria_log (profissional_id, ator_tipo, acao, entidade, entidade_id, detalhe)
            VALUES (:pid, 'sistema', 'ADMIN_STATUS_ALTERADO', 'profissional', :pid,
                    jsonb_build_object('admin_id', :admin_id, 'status_anterior', :antes, 'status_novo', :depois))
        """),
        {"pid": str(profissional_id), "admin_id": str(admin_id), "antes": status_anterior, "depois": dados.status},
    )

    db.flush()
    return {"id": profissional_id, "status": dados.status, "status_anterior": status_anterior}


@router.patch("/planejadores/{profissional_id}/trial")
def conceder_trial(
    profissional_id: uuid.UUID,
    dados: TrialAtualizar,
    admin_id: uuid.UUID = Depends(get_admin_id_atual),
    db: Session = Depends(get_db_negocio),
):
    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planejador não encontrado")

    trial_anterior = profissional.trial_ate
    profissional.trial_ate = dados.trial_ate
    db.add(profissional)

    db.execute(
        text("""
            INSERT INTO auditoria_log (profissional_id, ator_tipo, acao, entidade, entidade_id, detalhe)
            VALUES (:pid, 'sistema', 'ADMIN_TRIAL_CONCEDIDO', 'profissional', :pid,
                    jsonb_build_object('admin_id', :admin_id, 'trial_anterior', :antes, 'trial_novo', :depois))
        """),
        {
            "pid": str(profissional_id),
            "admin_id": str(admin_id),
            "antes": trial_anterior.isoformat() if trial_anterior else None,
            "depois": dados.trial_ate.isoformat() if dados.trial_ate else None,
        },
    )

    db.flush()
    return {"id": profissional_id, "trial_ate": dados.trial_ate}


@router.patch("/clientes/{cliente_id}/status")
def atualizar_status_cliente(
    cliente_id: uuid.UUID,
    dados: StatusClienteAtualizar,
    admin_id: uuid.UUID = Depends(get_admin_id_atual),
    db: Session = Depends(get_db_negocio),
):
    """Mesma capacidade de ativar/desativar, agora pro cliente final --
    diferente do fluxo normal de exclusão do planejador (que pede motivo de
    churn), esse é um override direto do admin."""
    if dados.status not in ("ativo", "excluido"):
        raise HTTPException(status_code=422, detail="status inválido")

    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")

    status_anterior = cliente.status
    cliente.status = dados.status
    cliente.data_exclusao = date.today() if dados.status == "excluido" else None
    db.add(cliente)

    db.execute(
        text("""
            INSERT INTO auditoria_log (profissional_id, cliente_id, ator_tipo, acao, entidade, entidade_id, detalhe)
            VALUES (:pid, :cid, 'sistema', 'ADMIN_STATUS_CLIENTE_ALTERADO', 'cliente', :cid,
                    jsonb_build_object('admin_id', :admin_id, 'status_anterior', :antes, 'status_novo', :depois))
        """),
        {
            "pid": str(cliente.profissional_id),
            "cid": str(cliente_id),
            "admin_id": str(admin_id),
            "antes": status_anterior,
            "depois": dados.status,
        },
    )

    db.flush()
    return {"id": cliente_id, "status": dados.status, "status_anterior": status_anterior}


@router.get("/clientes/{cliente_id}/transacoes", response_model=list[TransacaoNegocioResposta])
def transacoes_do_cliente(cliente_id: uuid.UUID, db: Session = Depends(get_db_negocio)):
    """Drill-down do nível Negócio até um cliente específico — o admin vê os
    lançamentos dele (só leitura) via bypass de RLS, sem precisar do login do
    planejador nem do cliente."""
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    return db.scalars(
        select(Transacao).where(Transacao.cliente_id == cliente_id).order_by(Transacao.data.desc())
    ).all()


# ---------------------------------------------------------------------------
# Financeiro da Plataforma — cobrança recebida dos planejadores + custos do
# próprio negócio Fluxo (despesas_operacionais).
# ---------------------------------------------------------------------------


@router.get("/financeiro/faturas", response_model=list[FaturaPlataformaResposta])
def faturas_da_plataforma(db: Session = Depends(get_db_negocio)):
    linhas = db.execute(
        text("""
            SELECT f.id, f.profissional_id, p.nome AS planejador_nome,
                   f.ciclo_referencia, (f.valor_base + f.valor_extras) AS valor_total, f.status
            FROM faturas f
            JOIN profissionais p ON p.id = f.profissional_id
            ORDER BY f.ciclo_referencia DESC, p.nome
        """)
    ).mappings().all()
    return [dict(linha) for linha in linhas]


@router.get("/despesas", response_model=list[DespesaResposta])
def listar_despesas(db: Session = Depends(get_db_negocio)):
    return db.scalars(select(DespesaOperacional).order_by(DespesaOperacional.data.desc())).all()


@router.post("/despesas", response_model=DespesaResposta, status_code=status.HTTP_201_CREATED)
def criar_despesa(dados: DespesaCriar, db: Session = Depends(get_db_negocio)):
    categorias_validas = {
        "infraestrutura", "gateway_pagamento", "open_finance",
        "marketing", "ferramentas", "pessoal", "outro",
    }
    if dados.categoria not in categorias_validas:
        raise HTTPException(status_code=422, detail="categoria inválida")

    despesa = DespesaOperacional(
        descricao=dados.descricao,
        categoria=dados.categoria,
        valor=dados.valor,
        data=dados.data or date.today(),
    )
    db.add(despesa)
    db.flush()
    db.refresh(despesa)
    return despesa


@router.delete("/despesas/{despesa_id}", status_code=status.HTTP_200_OK)
def excluir_despesa(despesa_id: uuid.UUID, db: Session = Depends(get_db_negocio)):
    despesa = db.get(DespesaOperacional, despesa_id)
    if not despesa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despesa não encontrada")
    db.delete(despesa)
    db.flush()
    return {"ok": True}
