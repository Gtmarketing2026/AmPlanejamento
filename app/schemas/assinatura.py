from pydantic import BaseModel


class EscolherPlanoRequest(BaseModel):
    tipo_plano: str  # 'essencial' | 'completo'
    cpf_cnpj: str  # exigido pelo Asaas para criar o customer


class AssinaturaResposta(BaseModel):
    tem_assinatura: bool
    plano_ativo: bool
    tipo_plano: str | None
    nome_plano: str | None
    valor_base: float | None
    invoice_url: str | None  # link de pagamento Asaas enquanto a 1ª fatura está pendente
    status_pagamento: str | None  # 'pendente' | 'paga' | 'atrasada' | None
