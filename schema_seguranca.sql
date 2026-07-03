-- ============================================================================
-- SCHEMA: Fluxo — App de Planejamento Financeiro (B2B2C)
-- Foco desta versão: isolamento multi-tenant (RLS) + auditoria
-- Postgres 14+
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSÕES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- para uuid e criptografia de tokens

-- ----------------------------------------------------------------------------
-- TABELA: profissionais (tenant)
-- ----------------------------------------------------------------------------
CREATE TABLE profissionais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    senha_hash      TEXT NOT NULL,  -- hash bcrypt (passlib), nunca senha em texto puro
    -- Admin interno da Fluxo (equipe/suporte) — enxerga todos os tenants via
    -- rotas /admin/*, que usam a conexão privilegiada (SessionLocalAdmin)
    -- SÓ depois de confirmar is_admin=true na própria linha do profissional
    -- (lida com a conexão restrita, respeitando RLS normalmente). Ver
    -- app/api/deps.py::get_profissional_admin_atual.
    is_admin        BOOLEAN NOT NULL DEFAULT false,
    -- Marca própria (subdominio/cor_marca/logo_url) é EXCLUSIVA do Plano
    -- Completo (assinaturas.tipo_plano = 'completo'). A aplicação deve
    -- checar isso antes de permitir editar esses campos ou de servir o
    -- subdomínio personalizado — não há CHECK de banco pra isso porque
    -- depende de outra tabela (assinaturas), então fica como regra de
    -- negócio no backend, não constraint SQL.
    subdominio      TEXT NOT NULL UNIQUE,          -- white-label: app.<subdominio>.fluxo.com.br
    cor_marca       TEXT DEFAULT '#4C8DFF',
    logo_url        TEXT,
    -- Token OAuth do Google Calendar, mesma lógica de criptografia do token
    -- de consentimento Open Finance — nunca em texto puro, nunca em log.
    google_calendar_token_enc BYTEA,
    google_calendar_conectado_em TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'ativa'  -- ativa | congelada | cancelada
                        CHECK (status IN ('ativa', 'congelada', 'cancelada')),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- TABELA: assinaturas
-- ----------------------------------------------------------------------------
CREATE TABLE assinaturas (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id         UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    -- Duas versões do produto: 'essencial' (upload manual de extrato/fatura,
    -- sem custo de Open Finance) e 'completo' (Open Finance, conciliação
    -- automática). Um profissional pode fazer upgrade de essencial -> completo
    -- sem migração de dado: a tabela contas_conectadas já suporta os dois modos.
    tipo_plano              TEXT NOT NULL DEFAULT 'essencial'
                                CHECK (tipo_plano IN ('essencial', 'completo')),
    clientes_inclusos        INT NOT NULL DEFAULT 4,
    valor_base              NUMERIC(10,2) NOT NULL,
    valor_por_extra         NUMERIC(10,2) NOT NULL,
    -- Gateway de pagamento (Asaas): nunca armazenamos dados de cartão — só os
    -- IDs que o Asaas retorna. asaas_customer_id é criado uma vez por
    -- profissional; asaas_subscription_id referencia a assinatura recorrente
    -- lá no Asaas (1 assinatura Asaas = 1 assinatura Fluxo).
    gateway_customer_token   TEXT NOT NULL,  -- mantido por compatibilidade — usar asaas_customer_id daqui pra frente
    asaas_customer_id        TEXT,
    asaas_subscription_id    TEXT,
    data_vencimento          DATE NOT NULL,
    data_inadimplencia       DATE,
    data_congelamento        DATE,   -- = data_inadimplencia + 5 dias, calculado por job
    data_cancelamento        DATE,   -- = data_congelamento + 30 dias, calculado por job
    criado_em                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- TABELA: clientes (do profissional)
-- ----------------------------------------------------------------------------
CREATE TABLE clientes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id         UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    nome                    TEXT NOT NULL,
    tipo                    TEXT NOT NULL CHECK (tipo IN ('PF', 'PJ')),
    documento               TEXT NOT NULL,  -- CPF ou CNPJ
    data_cadastro            DATE NOT NULL DEFAULT CURRENT_DATE,
    data_limite_exclusao     DATE GENERATED ALWAYS AS (data_cadastro + INTERVAL '35 days') STORED,
    status                  TEXT NOT NULL DEFAULT 'ativo'
                                CHECK (status IN ('ativo', 'excluido')),
    data_exclusao            DATE,
    -- Preenchido quando status = 'excluido'. Alimenta análise de retenção/churn
    -- no painel analítico — sem isso, "por que os clientes saem" fica um chute.
    motivo_churn             TEXT CHECK (motivo_churn IN (
                                'preco', 'insatisfacao_resultado', 'mudou_planejador',
                                'nao_engajou', 'encerrou_necessidade', 'outro'
                              )),
    motivo_churn_detalhe      TEXT,  -- texto livre complementar, opcional
    conexao_pausada          BOOLEAN NOT NULL DEFAULT false,
    -- Contexto CRM básico (perfil vem de questionário/observação do profissional)
    perfil_comportamental     TEXT,   -- ex: 'Cauteloso', 'Arrojado', 'Disciplinado'
    objetivo_principal        TEXT,   -- texto livre, resumo do que o cliente mais busca
    -- Quanto o PROFISSIONAL cobra desse cliente pelo serviço de planejamento
    -- (não confundir com o que a Fluxo cobra do profissional). Alimenta
    -- ticket médio e LTV no painel analítico.
    valor_honorario_mensal    NUMERIC(10,2),
    criado_em                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- TABELA: contas_conectadas (Open Finance)
-- ----------------------------------------------------------------------------
CREATE TABLE contas_conectadas (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id               UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id         UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE, -- redundante de propósito: acelera RLS sem join
    -- 'open_finance' = sincronização automática via provedor (Pluggy etc.)
    -- 'manual' = alimentada por upload de extrato/fatura (plano Essencial)
    modo                    TEXT NOT NULL DEFAULT 'open_finance'
                                CHECK (modo IN ('open_finance', 'manual')),
    provedor                TEXT,                    -- ex: 'pluggy'. NULL quando modo = 'manual'
    item_id_provedor         TEXT,                    -- id do item no provedor. NULL quando modo = 'manual'
    banco                   TEXT,
    tipo_conta               TEXT,
    -- Token de consentimento: só existe no modo Open Finance, sempre criptografado.
    -- pgcrypto: pgp_sym_encrypt(token, chave) na escrita / pgp_sym_decrypt na leitura,
    -- com a chave vindo de secret manager — nunca hardcoded na migration.
    token_consentimento_enc  BYTEA,
    status                  TEXT NOT NULL DEFAULT 'ativa'
                                CHECK (status IN ('ativa', 'pausada', 'revogada', 'erro')),
    consentimento_expira_em  TIMESTAMPTZ,
    ultima_sincronizacao      TIMESTAMPTZ,
    criado_em                TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Garante que conta em modo Open Finance sempre tem os campos do provedor,
    -- e que conta manual não carrega token à toa.
    CONSTRAINT chk_modo_consistente CHECK (
        (modo = 'open_finance' AND provedor IS NOT NULL AND item_id_provedor IS NOT NULL)
        OR
        (modo = 'manual' AND provedor IS NULL AND token_consentimento_enc IS NULL)
    )
);

-- ----------------------------------------------------------------------------
-- TABELA: importacoes_extrato (Plano Essencial — upload manual de
-- extrato/fatura, sem Open Finance)
-- ----------------------------------------------------------------------------
CREATE TABLE importacoes_extrato (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_conectada_id   UUID NOT NULL REFERENCES contas_conectadas(id) ON DELETE CASCADE,
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    tipo_documento       TEXT NOT NULL CHECK (tipo_documento IN ('extrato', 'fatura_cartao')),
    formato_arquivo      TEXT NOT NULL CHECK (formato_arquivo IN ('ofx', 'csv', 'pdf')),
    -- Caminho no storage (S3/GCS/etc.), nunca o binário no banco
    arquivo_url          TEXT NOT NULL,
    periodo_inicio        DATE,
    periodo_fim           DATE,
    status               TEXT NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente', 'processando', 'processado', 'erro')),
    transacoes_importadas INT DEFAULT 0,
    transacoes_duplicadas INT DEFAULT 0,  -- pegas pelo hash_dedup, não reinseridas
    erro_detalhe          TEXT,
    enviado_por           TEXT NOT NULL DEFAULT 'profissional'
                            CHECK (enviado_por IN ('profissional', 'cliente_final')),
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
    processado_em          TIMESTAMPTZ
);

CREATE INDEX idx_importacoes_cliente ON importacoes_extrato (cliente_id, criado_em DESC);

-- Fluxo de processamento (lógica de aplicação):
--   1. Upload do arquivo -> salva em storage -> INSERT com status='pendente'
--   2. Worker assíncrono lê o arquivo (parser OFX é direto; CSV varia por banco,
--      manter um mapeamento de colunas por banco; PDF exige extração de texto/OCR)
--   3. Cada transação extraída passa pela MESMA lógica de dedup da tabela
--      transacoes (hash_dedup) — um extrato reenviado não duplica lançamento
--   4. Atualiza status='processado' + contadores, ou 'erro' + erro_detalhe


-- ----------------------------------------------------------------------------
-- TABELAS: taxonomia de classificação (categoria > subcategoria, instituição,
-- tags) — cada profissional tem sua própria lista, com um conjunto padrão
-- pré-cadastrado (seed abaixo) e opção de criar novos itens livremente.
-- ----------------------------------------------------------------------------
CREATE TABLE categorias (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id     UUID REFERENCES profissionais(id) ON DELETE CASCADE, -- NULL = categoria padrão do sistema, visível a todos
    nome                TEXT NOT NULL,
    tipo                TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'neutra')),
    padrao_sistema       BOOLEAN NOT NULL DEFAULT false, -- true = veio do seed, não pode ser excluída
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_categoria_nome UNIQUE (profissional_id, nome)
);

CREATE TABLE subcategorias (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id         UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    profissional_id     UUID REFERENCES profissionais(id) ON DELETE CASCADE, -- NULL = padrão do sistema
    nome                TEXT NOT NULL,
    padrao_sistema       BOOLEAN NOT NULL DEFAULT false,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_subcategoria_nome UNIQUE (categoria_id, nome)
);

CREATE TABLE instituicoes_bancarias (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id     UUID REFERENCES profissionais(id) ON DELETE CASCADE, -- NULL = padrão do sistema
    nome                TEXT NOT NULL,
    padrao_sistema       BOOLEAN NOT NULL DEFAULT false,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_instituicao_nome UNIQUE (profissional_id, nome)
);

CREATE TABLE tags (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    nome                TEXT NOT NULL,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_tag_nome UNIQUE (profissional_id, nome)
);

-- ----------------------------------------------------------------------------
-- TABELA: transacoes (normalizadas — conta e cartão no mesmo formato,
-- independente de vir de Open Finance ou de importação manual)
-- ----------------------------------------------------------------------------
CREATE TABLE transacoes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_conectada_id   UUID NOT NULL REFERENCES contas_conectadas(id) ON DELETE CASCADE,
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE, -- redundante de propósito, mesma lógica acima
    data                DATE NOT NULL,
    descricao            TEXT NOT NULL,           -- nome da compra/lançamento, como veio do extrato/fatura
    valor               NUMERIC(12,2) NOT NULL,
    tipo                TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    origem              TEXT NOT NULL CHECK (origem IN ('conta', 'cartao')),
    -- Classificação (mesma estrutura categoria > subcategoria da referência)
    categoria_id          UUID REFERENCES categorias(id) ON DELETE SET NULL,
    subcategoria_id       UUID REFERENCES subcategorias(id) ON DELETE SET NULL,
    instituicao_id        UUID REFERENCES instituicoes_bancarias(id) ON DELETE SET NULL,
    -- Identificação do cartão, quando origem = 'cartao'
    cartao_nome           TEXT,        -- ex: 'Nubank Roxinho'
    cartao_ultimos_digitos TEXT,       -- ex: '4471' — nunca o número completo
    -- Parcelamento
    parcela_atual         INT,         -- ex: 3
    parcela_total         INT,         -- ex: 10 (compra em 10x, esta é a parcela 3)
    conciliado           BOOLEAN NOT NULL DEFAULT false,
    -- Rastreabilidade: de qual importação manual essa transação veio (NULL
    -- se veio de sincronização automática via Open Finance).
    importacao_id         UUID REFERENCES importacoes_extrato(id) ON DELETE SET NULL,
    -- Dedup: provedores de Open Finance reprocessam histórico com frequência,
    -- e a mesma transação pode chegar mais de uma vez em sincronizações
    -- diferentes. Este hash é a defesa contra duplicidade.
    hash_dedup          TEXT NOT NULL,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Mesma conta + mesmo hash nunca pode se repetir. Ao inserir, calcular:
    --   hash_dedup = sha256(conta_conectada_id || data || valor || descricao_original)
    -- e usar ON CONFLICT DO NOTHING na escrita.
    CONSTRAINT uq_transacao_dedup UNIQUE (conta_conectada_id, hash_dedup)
);

CREATE INDEX idx_transacoes_cliente_data ON transacoes (cliente_id, data DESC);
CREATE INDEX idx_transacoes_categoria ON transacoes (categoria_id);
CREATE INDEX idx_transacoes_instituicao ON transacoes (instituicao_id);
CREATE INDEX idx_transacoes_cartao ON transacoes (cartao_ultimos_digitos) WHERE cartao_ultimos_digitos IS NOT NULL;

-- transacoes_tags depende de transacoes existir (FK) — por isso vem depois.
CREATE TABLE transacoes_tags (
    transacao_id         UUID NOT NULL REFERENCES transacoes(id) ON DELETE CASCADE,
    tag_id               UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transacao_id, tag_id)
);


-- ----------------------------------------------------------------------------
-- TABELA: patrimonio_snapshots (curva de patrimônio projetado/histórico)
-- ----------------------------------------------------------------------------
CREATE TABLE patrimonio_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    data_referencia       DATE NOT NULL,       -- mês/ano do snapshot
    valor_patrimonio      NUMERIC(14,2) NOT NULL,
    -- projetado = calculado por simulação (aposentadoria, etc.); realizado = soma de saldos reais
    tipo                 TEXT NOT NULL DEFAULT 'realizado' CHECK (tipo IN ('realizado', 'projetado')),
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_patrimonio_snapshot UNIQUE (cliente_id, data_referencia, tipo)
);

CREATE INDEX idx_patrimonio_cliente_data ON patrimonio_snapshots (cliente_id, data_referencia DESC);

-- ----------------------------------------------------------------------------
-- TABELA: metas (projetos de vida — viagem, sair do aluguel, aposentadoria...)
-- ----------------------------------------------------------------------------
CREATE TABLE metas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    titulo               TEXT NOT NULL,             -- ex: 'Sair do aluguel'
    tipo                 TEXT NOT NULL DEFAULT 'outro'
                            CHECK (tipo IN ('aposentadoria', 'viagem', 'imovel', 'quitar_divida',
                                             'reserva_emergencia', 'educacao', 'outro')),
    valor_alvo            NUMERIC(12,2),
    valor_atual           NUMERIC(12,2) NOT NULL DEFAULT 0,
    progresso_pct         NUMERIC(5,2) GENERATED ALWAYS AS (
                             CASE WHEN valor_alvo IS NULL OR valor_alvo = 0 THEN 0
                                  ELSE LEAST(100, ROUND(valor_atual / valor_alvo * 100, 2))
                             END
                           ) STORED,
    prazo                DATE,
    status               TEXT NOT NULL DEFAULT 'em_andamento'
                            CHECK (status IN ('em_andamento', 'concluida', 'pausada')),
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_metas_cliente ON metas (cliente_id, status);

-- ----------------------------------------------------------------------------
-- TABELA: metas_aportes (histórico de contribuição — alimenta o progresso)
-- ----------------------------------------------------------------------------
CREATE TABLE metas_aportes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_id              UUID NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    valor                NUMERIC(12,2) NOT NULL,
    data                 DATE NOT NULL DEFAULT CURRENT_DATE,
    origem               TEXT DEFAULT 'manual' CHECK (origem IN ('manual', 'transacao_vinculada')),
    transacao_id          UUID REFERENCES transacoes(id) ON DELETE SET NULL,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: todo aporte atualiza valor_atual da meta automaticamente
CREATE OR REPLACE FUNCTION atualizar_valor_meta()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE metas
    SET valor_atual = valor_atual + NEW.valor,
        atualizado_em = now()
    WHERE id = NEW.meta_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualizar_meta
    AFTER INSERT ON metas_aportes
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_valor_meta();

-- ----------------------------------------------------------------------------
-- TABELA: dividas (módulo dedicado — inspirado no Dhana; diferente de
-- classificar uma parcela em "Dívidas" nas transações, aqui rastreamos o
-- passivo inteiro: saldo devedor, juros, prazo de quitação)
-- ----------------------------------------------------------------------------
CREATE TABLE dividas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    tipo                 TEXT NOT NULL CHECK (tipo IN (
                            'emprestimo_pessoal', 'financiamento_imobiliario',
                            'financiamento_veiculo', 'cartao_parcelado',
                            'cheque_especial', 'outro'
                          )),
    credor               TEXT NOT NULL,           -- ex: 'Itaú', 'Banco PAN'
    valor_total           NUMERIC(12,2) NOT NULL,
    valor_pago            NUMERIC(12,2) NOT NULL DEFAULT 0,
    valor_restante         NUMERIC(12,2) GENERATED ALWAYS AS (valor_total - valor_pago) STORED,
    taxa_juros_mensal_pct   NUMERIC(6,3),
    parcelas_totais        INT,
    parcelas_pagas         INT DEFAULT 0,
    data_inicio            DATE,
    data_prevista_quitacao  DATE,
    status                TEXT NOT NULL DEFAULT 'ativa'
                            CHECK (status IN ('ativa', 'quitada', 'atrasada')),
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dividas_cliente ON dividas (cliente_id, status);

-- ----------------------------------------------------------------------------
-- TABELA: notificacoes (alertas — inspirado no Dhana: "para você e o
-- cliente". Diferente de interacoes_crm, que é histórico de relacionamento
-- visto só pelo profissional; aqui o destinatário pode ser o cliente final.)
-- ----------------------------------------------------------------------------
CREATE TABLE notificacoes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    destinatario         TEXT NOT NULL CHECK (destinatario IN ('profissional', 'cliente_final', 'ambos')),
    tipo                 TEXT NOT NULL CHECK (tipo IN (
                            'gasto_acima_categoria', 'meta_atingida', 'meta_em_risco',
                            'fatura_proxima_vencimento', 'divida_proxima_vencimento',
                            'conexao_desatualizada', 'consentimento_expirando', 'outro'
                          )),
    titulo               TEXT NOT NULL,
    mensagem             TEXT NOT NULL,
    lida_profissional      BOOLEAN NOT NULL DEFAULT false,
    lida_cliente          BOOLEAN NOT NULL DEFAULT false,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notificacoes_cliente ON notificacoes (cliente_id, criado_em DESC);
CREATE INDEX idx_notificacoes_nao_lidas_prof ON notificacoes (profissional_id) WHERE lida_profissional = false;

-- ----------------------------------------------------------------------------
-- TABELA: simulacoes (projeções interativas — "e se eu aportar R$X a mais
-- por mês?" — inspirado no módulo "Projeções de futuro" do Dhana)
-- ----------------------------------------------------------------------------
CREATE TABLE simulacoes (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id                UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id          UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    nome_cenario               TEXT NOT NULL DEFAULT 'Cenário base',
    patrimonio_inicial          NUMERIC(14,2) NOT NULL,
    aporte_mensal               NUMERIC(12,2) NOT NULL,
    taxa_retorno_anual_pct       NUMERIC(6,3) NOT NULL,
    prazo_anos                 INT NOT NULL,
    -- Resultado fica cacheado aqui pra não recalcular toda vez que o cliente
    -- revisita a tela — recalculado sob demanda quando os parâmetros mudam.
    valor_final_projetado        NUMERIC(14,2),
    criado_por                 TEXT NOT NULL DEFAULT 'profissional' CHECK (criado_por IN ('profissional', 'cliente_final')),
    criado_em                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_simulacoes_cliente ON simulacoes (cliente_id, criado_em DESC);

-- Fórmula de projeção (lógica de aplicação, não trigger de banco — mais
-- simples de ajustar sem migration se a fórmula evoluir):
--   valor_final = patrimonio_inicial * (1+i)^n + aporte_mensal * (((1+i)^n - 1) / i)
--   onde i = taxa_retorno_anual_pct/100/12 (taxa mensal), n = prazo_anos*12

-- ----------------------------------------------------------------------------
-- TABELA: investimentos (preparação de schema — 3 dos 4 concorrentes
-- analisados têm isso como módulo próprio. Fica pronto no schema mesmo que
-- a integração de dados ainda não exista no MVP, pra não migrar depois.)
-- ----------------------------------------------------------------------------
CREATE TABLE investimentos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    conta_conectada_id   UUID REFERENCES contas_conectadas(id) ON DELETE SET NULL, -- NULL se lançado manualmente
    tipo                 TEXT NOT NULL CHECK (tipo IN (
                            'acao', 'fundo', 'fii', 'renda_fixa', 'tesouro_direto',
                            'previdencia', 'cripto', 'outro'
                          )),
    nome_ativo            TEXT NOT NULL,
    instituicao_id        UUID REFERENCES instituicoes_bancarias(id) ON DELETE SET NULL,
    quantidade            NUMERIC(18,8),
    valor_aplicado         NUMERIC(14,2),
    valor_atual            NUMERIC(14,2),
    data_referencia         DATE NOT NULL DEFAULT CURRENT_DATE,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investimentos_cliente ON investimentos (cliente_id, data_referencia DESC);


-- ----------------------------------------------------------------------------
-- TABELA: interacoes_crm (linha do tempo de relacionamento)
-- ----------------------------------------------------------------------------
CREATE TABLE interacoes_crm (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    tipo                 TEXT NOT NULL
                            CHECK (tipo IN ('reuniao', 'mensagem', 'alerta_automatico', 'onboarding', 'nota')),
    titulo               TEXT NOT NULL,
    descricao             TEXT,
    ator_tipo            TEXT NOT NULL DEFAULT 'profissional'
                            CHECK (ator_tipo IN ('profissional', 'sistema')),
    data_interacao         TIMESTAMPTZ NOT NULL DEFAULT now(),
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interacoes_cliente ON interacoes_crm (cliente_id, data_interacao DESC);

-- ----------------------------------------------------------------------------
-- TABELA: follow_ups (próximos contatos agendados)
-- ----------------------------------------------------------------------------
CREATE TABLE follow_ups (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    data_prevista         DATE NOT NULL,
    observacao            TEXT,
    concluido            BOOLEAN NOT NULL DEFAULT false,
    concluido_em          TIMESTAMPTZ,
    -- Integração Google Calendar (unidirecional no MVP: seu banco é a fonte
    -- de verdade, o evento no Google é reflexo).
    google_event_id       TEXT,
    sincronizado_google    BOOLEAN NOT NULL DEFAULT false,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_followups_pendentes ON follow_ups (profissional_id, data_prevista) WHERE concluido = false;

-- Gatilho automático de alerta (referente ao alerta usado no CRM da tela 06):
-- é lógica de aplicação (job periódico), não trigger de banco, porque depende
-- de comparar gasto do mês vs. média histórica — mais simples de manter em código.
-- Ao disparar, o job insere uma linha em interacoes_crm com tipo='alerta_automatico'.


-- ----------------------------------------------------------------------------
-- VIEW: retenção por cliente (base para LTV real, não estimado)
-- ----------------------------------------------------------------------------
CREATE VIEW vw_retencao_clientes AS
SELECT
    c.id                    AS cliente_id,
    c.profissional_id,
    c.nome,
    c.tipo,
    c.status,
    c.data_cadastro,
    c.data_exclusao,
    c.motivo_churn,
    c.valor_honorario_mensal,
    -- data de referência: se já saiu, usa a data de exclusão; se ativo, usa hoje
    COALESCE(c.data_exclusao, CURRENT_DATE)                    AS data_referencia,
    -- meses de relacionamento, com precisão de 1 casa decimal
    ROUND(
        (COALESCE(c.data_exclusao, CURRENT_DATE) - c.data_cadastro) / 30.44
    , 1)                                                        AS meses_relacionamento,
    -- LTV realizado até agora: honorário mensal × meses de relacionamento
    -- (aproximação — não considera reajuste de honorário ao longo do tempo;
    -- se precisar de precisão maior, migrar para uma tabela de honorarios_recebidos
    -- com lançamento mês a mês, no mesmo padrão de metas_aportes)
    ROUND(
        c.valor_honorario_mensal * ((COALESCE(c.data_exclusao, CURRENT_DATE) - c.data_cadastro) / 30.44)
    , 2)                                                        AS ltv_realizado
FROM clientes c;

-- ----------------------------------------------------------------------------
-- VIEW: métricas de carteira por profissional (alimenta o painel analítico)
-- ----------------------------------------------------------------------------
CREATE VIEW vw_metricas_carteira AS
SELECT
    profissional_id,
    COUNT(*) FILTER (WHERE status = 'ativo')                    AS clientes_ativos,
    COUNT(*) FILTER (WHERE status = 'excluido')                 AS clientes_churned,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'excluido')::NUMERIC
        / NULLIF(COUNT(*), 0) * 100
    , 1)                                                         AS taxa_churn_pct,
    ROUND(AVG(valor_honorario_mensal) FILTER (WHERE status = 'ativo'), 2) AS ticket_medio,
    ROUND(AVG(meses_relacionamento) FILTER (WHERE status = 'excluido'), 1) AS retencao_media_churn_meses,
    ROUND(AVG(ltv_realizado), 2)                                AS ltv_medio_realizado,
    -- LTV projetado: ticket médio × retenção média observada nos clientes que já saíram.
    -- Se ainda não há churn suficiente pra ser confiável, cai no fallback de 24 meses.
    ROUND(
        AVG(valor_honorario_mensal) FILTER (WHERE status = 'ativo')
        * COALESCE(NULLIF(AVG(meses_relacionamento) FILTER (WHERE status = 'excluido'), 0), 24)
    , 2)                                                         AS ltv_projetado
FROM vw_retencao_clientes
GROUP BY profissional_id;

-- ----------------------------------------------------------------------------
-- VIEW: motivos de churn agregados (pro profissional entender padrão de saída)
-- ----------------------------------------------------------------------------
CREATE VIEW vw_motivos_churn AS
SELECT
    profissional_id,
    motivo_churn,
    COUNT(*) AS total
FROM clientes
WHERE status = 'excluido' AND motivo_churn IS NOT NULL
GROUP BY profissional_id, motivo_churn
ORDER BY profissional_id, total DESC;

-- Nota sobre RLS em views: Postgres respeita a policy das tabelas base
-- automaticamente ao consultar a view (security_invoker é o padrão a partir
-- do PG 15). Em PG 14, criar as views com WITH (security_invoker = true)
-- explicitamente, ou aplicar o filtro de profissional_id na query da aplicação.


-- ----------------------------------------------------------------------------
-- TABELA: faturas (cobrança do profissional, por ciclo)
-- ----------------------------------------------------------------------------
CREATE TABLE faturas (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id         UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    ciclo_referencia         DATE NOT NULL,          -- ex: 2026-07-01, representa o mês do ciclo
    clientes_inclusos_no_ciclo INT NOT NULL,          -- snapshot: não muda se a cota mudar depois
    clientes_extras_no_ciclo INT NOT NULL DEFAULT 0,
    valor_base              NUMERIC(10,2) NOT NULL,
    valor_extras             NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_total              NUMERIC(10,2) GENERATED ALWAYS AS (valor_base + valor_extras) STORED,
    status                  TEXT NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente', 'paga', 'atrasada', 'cancelada')),
    -- Idempotency key: gerada de forma determinística (ex: profissional_id + ciclo_referencia)
    -- ANTES de chamar o gateway de pagamento. Se o job de cobrança rodar duas vezes
    -- (retry de rede, deploy no meio do processamento, etc.), a constraint abaixo
    -- impede cobrar o mesmo ciclo duas vezes.
    idempotency_key         TEXT NOT NULL,
    gateway_charge_id        TEXT,   -- mantido por compatibilidade — usar asaas_payment_id daqui pra frente
    asaas_payment_id         TEXT,   -- id da cobrança (payment) no Asaas, vinculada à asaas_subscription_id
    asaas_status             TEXT,   -- espelha o status bruto do Asaas (PENDING, RECEIVED, CONFIRMED, OVERDUE...)
    criado_em                TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_fatura_ciclo UNIQUE (profissional_id, ciclo_referencia),
    CONSTRAINT uq_fatura_idempotency UNIQUE (idempotency_key)
);

-- ----------------------------------------------------------------------------
-- TABELA: webhook_events (eventos recebidos de provedores externos —
-- Open Finance E Asaas compartilham esta mesma tabela, diferenciados pela
-- coluna 'provedor'. Mesma lógica de idempotência/validação serve pros dois.)
-- ----------------------------------------------------------------------------
CREATE TABLE webhook_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provedor            TEXT NOT NULL,           -- ex: 'pluggy'
    evento_id_provedor   TEXT NOT NULL,           -- id único que o provedor envia no payload
    tipo_evento          TEXT NOT NULL,           -- ex: 'item/updated', 'consent/revoked'
    assinatura_valida     BOOLEAN NOT NULL,        -- resultado da checagem de HMAC/assinatura
    payload_bruto         JSONB NOT NULL,
    processado            BOOLEAN NOT NULL DEFAULT false,
    processado_em         TIMESTAMPTZ,
    recebido_em           TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Idempotência de webhook: o mesmo evento pode ser reenviado pelo provedor.
    -- Esta constraint garante que só processamos uma vez.
    CONSTRAINT uq_webhook_evento UNIQUE (provedor, evento_id_provedor)
);

CREATE INDEX idx_webhook_nao_processado ON webhook_events (processado) WHERE processado = false;

-- Regra de aplicação (não é constraint de banco, é lógica do backend):
--   1. Receber webhook -> validar assinatura HMAC com o secret do provedor
--   2. INSERT em webhook_events com ON CONFLICT (provedor, evento_id_provedor) DO NOTHING
--   3. Se o INSERT não inseriu nada (já existia), retornar 200 sem reprocessar
--   4. Se assinatura_valida = false, logar em auditoria_log como possível tentativa
--      de forjar evento, e NUNCA processar o conteúdo
--   5. Processar de forma assíncrona (fila), não na mesma requisição do webhook


-- Estratégia: cada request da aplicação define, no início da conexão/transação,
-- a variável de sessão `app.current_profissional_id` com o id do profissional
-- autenticado. O Postgres então filtra AUTOMATICAMENTE qualquer SELECT/UPDATE/
-- DELETE para linhas daquele profissional — mesmo que o código da aplicação
-- esqueça o WHERE, ou que alguém troque um ID na URL.
--
-- No backend, isso normalmente é feito assim a cada request autenticada:
--   SET LOCAL app.current_profissional_id = '<uuid-do-profissional-logado>';
-- (dentro da mesma transação da query — nunca uma conexão compartilhada global)
-- ============================================================================

ALTER TABLE profissionais       ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_conectadas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE importacoes_extrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategorias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE instituicoes_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrimonio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_aportes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulacoes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE investimentos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE interacoes_crm      ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups          ENABLE ROW LEVEL SECURITY;

-- profissionais: só enxerga a própria linha
CREATE POLICY isolar_profissional ON profissionais
    USING (id = current_setting('app.current_profissional_id', true)::UUID);

-- demais tabelas: filtram por profissional_id
CREATE POLICY isolar_assinaturas ON assinaturas
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_clientes ON clientes
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_contas ON contas_conectadas
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_transacoes ON transacoes
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_importacoes ON importacoes_extrato
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

-- Categorias/subcategorias/instituições com profissional_id NULL são padrão
-- do sistema (seed) e visíveis a todos; as demais são exclusivas de quem criou.
CREATE POLICY isolar_categorias ON categorias
    USING (profissional_id IS NULL OR profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_subcategorias ON subcategorias
    USING (profissional_id IS NULL OR profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_instituicoes ON instituicoes_bancarias
    USING (profissional_id IS NULL OR profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_tags ON tags
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

-- transacoes_tags não tem profissional_id próprio (é tabela de junção) —
-- o isolamento vem por join com a transação, que já tem RLS.
ALTER TABLE transacoes_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolar_transacoes_tags ON transacoes_tags
    USING (EXISTS (
        SELECT 1 FROM transacoes t
        WHERE t.id = transacoes_tags.transacao_id
        AND t.profissional_id = current_setting('app.current_profissional_id', true)::UUID
    ));

CREATE POLICY isolar_faturas ON faturas
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_patrimonio ON patrimonio_snapshots
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_metas ON metas
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_metas_aportes ON metas_aportes
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_dividas ON dividas
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_notificacoes ON notificacoes
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_simulacoes ON simulacoes
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_investimentos ON investimentos
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_interacoes_crm ON interacoes_crm
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

CREATE POLICY isolar_followups ON follow_ups
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID);

-- IMPORTANTE: o usuário/role da aplicação no banco NÃO pode ter BYPASSRLS,
-- e não deve ser dono (owner) das tabelas — dono do Postgres sempre ignora RLS.
-- Crie uma role de aplicação separada:
--
--   CREATE ROLE app_fluxo LOGIN PASSWORD '...' NOSUPERUSER NOBYPASSRLS;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_fluxo;


-- ============================================================================
-- AUDITORIA
-- ============================================================================
-- Log central de acesso e mudança de estado. Foco: LGPD (quem acessou dado
-- financeiro sensível) + rastreabilidade da régua de cobrança (congelou,
-- cancelou, reativou).
-- ============================================================================

CREATE TABLE auditoria_log (
    id                  BIGSERIAL PRIMARY KEY,
    profissional_id     UUID REFERENCES profissionais(id) ON DELETE SET NULL,
    cliente_id           UUID REFERENCES clientes(id) ON DELETE SET NULL,
    ator_tipo           TEXT NOT NULL CHECK (ator_tipo IN ('profissional', 'cliente_final', 'sistema')),
    ator_id             UUID,               -- id de quem executou a ação (nulo se for 'sistema')
    acao                TEXT NOT NULL,      -- ex: 'ACESSOU_TRANSACOES', 'ASSINATURA_CONGELADA', 'CONSENTIMENTO_REVOGADO'
    entidade             TEXT,               -- ex: 'cliente', 'assinatura', 'conta_conectada'
    entidade_id          UUID,
    detalhe              JSONB,              -- payload livre (ex: status anterior -> novo)
    ip_origem            INET,
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auditoria_profissional ON auditoria_log (profissional_id, criado_em DESC);
CREATE INDEX idx_auditoria_acao ON auditoria_log (acao, criado_em DESC);

-- Exemplo de uso a partir da aplicação (não do trigger, para manter contexto
-- de negócio explícito no evento, ao invés de log genérico de UPDATE):
--
--   INSERT INTO auditoria_log (profissional_id, ator_tipo, ator_id, acao, entidade, entidade_id, detalhe)
--   VALUES (
--     '<profissional_id>', 'sistema', NULL, 'ASSINATURA_CONGELADA', 'assinatura', '<assinatura_id>',
--     jsonb_build_object('motivo', 'inadimplencia_d5', 'clientes_pausados', 3)
--   );

-- ----------------------------------------------------------------------------
-- Trigger simples de auditoria automática para mudança de status sensível
-- (complementa, não substitui, os eventos de negócio inseridos pela aplicação)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_mudanca_status_assinatura()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.data_congelamento IS DISTINCT FROM OLD.data_congelamento
       OR NEW.data_cancelamento IS DISTINCT FROM OLD.data_cancelamento THEN
        INSERT INTO auditoria_log (profissional_id, ator_tipo, acao, entidade, entidade_id, detalhe)
        VALUES (
            NEW.profissional_id, 'sistema', 'ASSINATURA_STATUS_ALTERADO', 'assinatura', NEW.id,
            jsonb_build_object(
                'data_congelamento_anterior', OLD.data_congelamento,
                'data_congelamento_novo', NEW.data_congelamento,
                'data_cancelamento_anterior', OLD.data_cancelamento,
                'data_cancelamento_novo', NEW.data_cancelamento
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_assinatura
    AFTER UPDATE ON assinaturas
    FOR EACH ROW
    EXECUTE FUNCTION log_mudanca_status_assinatura();

-- auditoria_log não tem RLS: é o profissional consultando SÓ o próprio
-- histórico via aplicação (WHERE profissional_id = ...), mas o time interno
-- de suporte/compliance precisa poder consultar tudo em caso de investigação.
-- Se quiser reforçar isolamento aqui também, adicione a mesma policy das
-- tabelas acima e crie uma role separada 'app_suporte' com BYPASSRLS restrito.


-- ============================================================================
-- SEED: taxonomia padrão do sistema (categorias, subcategorias, instituições)
-- profissional_id = NULL => visível para todos os profissionais, e serve de
-- ponto de partida. Cada profissional pode criar itens próprios além destes
-- (respeitando a constraint de nome único por profissional_id).
-- ============================================================================

-- Categorias-mãe
INSERT INTO categorias (nome, tipo, padrao_sistema) VALUES
    ('Despesas obrigatórias',    'saida',   true),
    ('Despesas não obrigatórias','saida',   true),
    ('Financiamentos',           'saida',   true),
    ('Dívidas',                  'saida',   true),
    ('Renda',                    'entrada', true),
    ('Investimentos',            'saida',   true),
    ('Classificação neutra',     'neutra',  true),
    ('Empresa e autônomo',       'saida',   true),
    ('Projetos',                 'saida',   true);

-- Subcategorias — Despesas obrigatórias
INSERT INTO subcategorias (categoria_id, nome, padrao_sistema)
SELECT id, sub_nome, true FROM categorias, UNNEST(ARRAY[
    'Alimentação','Casa','Casa de veraneio','Cuidados pessoais','Educação',
    'Filhos e família','Impostos e taxas','Mercado','Pets','Prestadores de serviço',
    'Profissional','Saúde','Despesas médicas','Seguros','Transporte','Serviços financeiros'
]) AS sub_nome
WHERE categorias.nome = 'Despesas obrigatórias';

-- Subcategorias — Despesas não obrigatórias
INSERT INTO subcategorias (categoria_id, nome, padrao_sistema)
SELECT id, sub_nome, true FROM categorias, UNNEST(ARRAY[
    'Assinaturas e serviços','Compras','Esportes','Lazer','Presentes e doações',
    'Restaurantes','Tarifas bancárias','Roupas e acessórios','Viagens','Outros'
]) AS sub_nome
WHERE categorias.nome = 'Despesas não obrigatórias';

-- Subcategorias — Financiamentos
INSERT INTO subcategorias (categoria_id, nome, padrao_sistema)
SELECT id, sub_nome, true FROM categorias, UNNEST(ARRAY[
    'Financiamento imobiliário','Financiamento veículo'
]) AS sub_nome
WHERE categorias.nome = 'Financiamentos';

-- Subcategorias — Dívidas
INSERT INTO subcategorias (categoria_id, nome, padrao_sistema)
SELECT id, 'Dívidas e empréstimos', true FROM categorias
WHERE categorias.nome = 'Dívidas';

-- Subcategorias — Renda
INSERT INTO subcategorias (categoria_id, nome, padrao_sistema)
SELECT id, sub_nome, true FROM categorias, UNNEST(ARRAY[
    'Renda','Renda cônjuge','Outras fontes de renda'
]) AS sub_nome
WHERE categorias.nome = 'Renda';

-- Subcategorias — Investimentos
INSERT INTO subcategorias (categoria_id, nome, padrao_sistema)
SELECT id, 'Aplicação em investimentos', true FROM categorias
WHERE categorias.nome = 'Investimentos';

-- Subcategorias — Classificação neutra
INSERT INTO subcategorias (categoria_id, nome, padrao_sistema)
SELECT id, sub_nome, true FROM categorias, UNNEST(ARRAY[
    'Resgate de investimentos','Transferência mesma titularidade','Pagamento fatura de cartão',
    'Despesas reembolsáveis','Reembolsos','Sem classificação'
]) AS sub_nome
WHERE categorias.nome = 'Classificação neutra';

-- Subcategorias — Empresa e autônomo
INSERT INTO subcategorias (categoria_id, nome, padrao_sistema)
SELECT id, sub_nome, true FROM categorias, UNNEST(ARRAY[
    'Meios de pagamento','Infraestrutura','Ferramentas','Marketing','Colaboradores',
    'Prestadores de serviço','Taxas e impostos','Insumos e outros'
]) AS sub_nome
WHERE categorias.nome = 'Empresa e autônomo';

-- Subcategorias — Projetos
INSERT INTO subcategorias (categoria_id, nome, padrao_sistema)
SELECT id, sub_nome, true FROM categorias, UNNEST(ARRAY[
    'Viagem','Veículo','Casa','Família','Eletrônicos','Educação','Hobby',
    'Profissional','Saúde','Outros'
]) AS sub_nome
WHERE categorias.nome = 'Projetos';

-- Instituições bancárias padrão (mercado brasileiro)
INSERT INTO instituicoes_bancarias (nome, padrao_sistema) VALUES
    ('Mercado Pago', true), ('Itaú', true), ('Nubank', true), ('XP Banking', true),
    ('Banco PAN', true), ('Banco Sofisa', true), ('Nomad', true), ('ABC Brasil', true),
    ('Bradesco', true), ('Santander', true), ('Banco do Brasil', true), ('Caixa', true),
    ('Inter', true), ('C6 Bank', true), ('BTG Pactual', true);
