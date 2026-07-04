-- ============================================================================
-- MIGRAÇÃO: Camada Negócio (Admin de verdade, separado de profissionais)
-- ============================================================================
-- Aditiva: não faz DROP nem altera dado existente em nenhuma tabela. Rodar
-- UMA VEZ no SQL Editor do Supabase, depois de já ter o schema_seguranca.sql
-- original aplicado (este projeto já está em produção).
--
-- Coexiste com o mecanismo já existente de admin interno
-- (profissionais.is_admin + get_db_admin + rotas /admin/*, que continuam
-- funcionando exatamente como estão) — esta é uma camada NOVA e adicional,
-- por isso os nomes abaixo (tabela `admins`, GUC `app.is_admin`, rotas
-- /negocio/*) foram escolhidos pra não colidir com o que já existe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABELA: admins (dono/operador da plataforma Fluxo — nível "Negócio", acima
-- de profissional. Tabela separada de propósito: não é um profissional com
-- flag, é outro nível de acesso inteiro, sem cota, sem assinatura, sem
-- cobrança.)
-- ----------------------------------------------------------------------------
CREATE TABLE admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    senha_hash      TEXT NOT NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- TABELA: despesas_operacionais (custos do NEGÓCIO Fluxo em si — hospedagem,
-- taxa do Asaas, taxa do provedor Open Finance etc. Não confundir com
-- despesas dos clientes finais, que ficam em `transacoes`.)
-- ----------------------------------------------------------------------------
CREATE TABLE despesas_operacionais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    descricao       TEXT NOT NULL,
    categoria       TEXT NOT NULL CHECK (categoria IN (
                        'infraestrutura', 'gateway_pagamento', 'open_finance',
                        'marketing', 'ferramentas', 'pessoal', 'outro'
                      )),
    valor           NUMERIC(12,2) NOT NULL,
    data            DATE NOT NULL DEFAULT CURRENT_DATE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Somente admin (nível Negócio) acessa esta tabela — sem RLS por
-- profissional_id porque não pertence a nenhum profissional, pertence ao
-- negócio como um todo. Protegido no nível de aplicação: só rotas
-- autenticadas como admin (get_db_negocio) tocam nesta tabela.

-- ============================================================================
-- ⚠️  BYPASS DE ADMIN — `app.is_admin`
-- ============================================================================
-- Cada policy abaixo ganha uma cláusula extra:
--   OR current_setting('app.is_admin', true)::boolean IS TRUE
-- Isso permite que um admin autenticado (tabela `admins`) enxergue e edite
-- dados de QUALQUER profissional/cliente, sem precisar da senha de ninguém.
--
-- REGRA DE SEGURANÇA INEGOCIÁVEL: `app.is_admin` só pode ser setado como
-- 'true' pelo backend, DEPOIS de validar um JWT de admin genuíno (tabela
-- `admins`). Nunca aceitar esse valor vindo de header, query param ou body
-- da requisição. Se essa variável puder ser forjada por qualquer request,
-- todo o isolamento multi-tenant do banco inteiro é anulado de uma vez.
-- Ver `app/api/deps.py::get_db_negocio` — única dependência autorizada a
-- setar essa GUC, e só depois de `get_admin_id_atual` validar o token.
-- ============================================================================

ALTER POLICY isolar_profissional ON profissionais
    USING (id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_assinaturas ON assinaturas
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_clientes ON clientes
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_contas ON contas_conectadas
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_transacoes ON transacoes
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_importacoes ON importacoes_extrato
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_categorias ON categorias
    USING (profissional_id IS NULL
           OR profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_subcategorias ON subcategorias
    USING (profissional_id IS NULL
           OR profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_instituicoes ON instituicoes_bancarias
    USING (profissional_id IS NULL
           OR profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_tags ON tags
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_transacoes_tags ON transacoes_tags
    USING (
        current_setting('app.is_admin', true)::boolean IS TRUE
        OR EXISTS (
            SELECT 1 FROM transacoes t
            WHERE t.id = transacoes_tags.transacao_id
            AND t.profissional_id = current_setting('app.current_profissional_id', true)::UUID
        )
    );

ALTER POLICY isolar_faturas ON faturas
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_patrimonio ON patrimonio_snapshots
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_metas ON metas
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_metas_aportes ON metas_aportes
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_dividas ON dividas
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_notificacoes ON notificacoes
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_simulacoes ON simulacoes
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_investimentos ON investimentos
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_interacoes_crm ON interacoes_crm
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

ALTER POLICY isolar_followups ON follow_ups
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

-- ----------------------------------------------------------------------------
-- VIEW: métricas do negócio (nível Admin — "tudo sobre o negócio")
-- ----------------------------------------------------------------------------
CREATE VIEW vw_metricas_negocio AS
SELECT
    (SELECT COUNT(*) FROM profissionais WHERE status = 'ativa')      AS planejadores_ativos,
    (SELECT COUNT(*) FROM clientes WHERE status = 'ativo')            AS clientes_ativos_total,
    ROUND(
        (SELECT COUNT(*) FROM clientes WHERE status = 'ativo')::NUMERIC
        / NULLIF((SELECT COUNT(*) FROM profissionais WHERE status = 'ativa'), 0)
    , 1)                                                                AS media_clientes_por_planejador,
    -- MRR: soma do valor total das assinaturas ativas (base + extras do último ciclo de cada uma)
    (
        SELECT ROUND(SUM(f.valor_base + f.valor_extras), 2)
        FROM faturas f
        INNER JOIN (
            SELECT profissional_id, MAX(ciclo_referencia) AS ultimo_ciclo
            FROM faturas GROUP BY profissional_id
        ) ultimo ON ultimo.profissional_id = f.profissional_id AND ultimo.ultimo_ciclo = f.ciclo_referencia
        INNER JOIN profissionais p ON p.id = f.profissional_id AND p.status = 'ativa'
    )                                                                    AS mrr,
    -- Ticket médio = MRR / nº de planejadores ativos
    (
        SELECT ROUND(
            SUM(f.valor_base + f.valor_extras) / NULLIF(COUNT(DISTINCT f.profissional_id), 0)
        , 2)
        FROM faturas f
        INNER JOIN (
            SELECT profissional_id, MAX(ciclo_referencia) AS ultimo_ciclo
            FROM faturas GROUP BY profissional_id
        ) ultimo ON ultimo.profissional_id = f.profissional_id AND ultimo.ultimo_ciclo = f.ciclo_referencia
    )                                                                    AS ticket_medio,
    -- Receita realizada no mês corrente = faturas efetivamente pagas
    (
        SELECT COALESCE(ROUND(SUM(valor_base + valor_extras), 2), 0)
        FROM faturas
        WHERE status = 'paga' AND date_trunc('month', ciclo_referencia) = date_trunc('month', CURRENT_DATE)
    )                                                                    AS receita_mes_atual,
    -- Despesa operacional do mês corrente (custo de rodar o negócio Fluxo)
    (
        SELECT COALESCE(ROUND(SUM(valor), 2), 0)
        FROM despesas_operacionais
        WHERE date_trunc('month', data) = date_trunc('month', CURRENT_DATE)
    )                                                                    AS despesa_mes_atual;

-- Esta view não tem RLS — é global por natureza (métricas do negócio como
-- um todo). Protegida no nível de aplicação: só rotas autenticadas como
-- admin (get_db_negocio) podem consultá-la.
