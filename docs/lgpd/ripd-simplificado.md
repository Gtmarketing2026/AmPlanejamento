# Relatório de Impacto à Proteção de Dados (RIPD) — versão simplificada

> ⚠️ MINUTA — documento interno (art. 38 da LGPD). O RIPD é recomendado por
> tratarmos **dados financeiros + CPF em escala**. Revisar com jurídico/DPO.

**Controlador:** 〔RAZÃO SOCIAL〕 · **DPO:** 〔NOME DO ENCARREGADO〕 · **Data:** 〔DATA〕

## 1. Descrição do tratamento
Plataforma SaaS que organiza e acompanha finanças de clientes finais para planejadores. Trata dados de identificação (nome, CPF/CNPJ), de acesso (senha em hash) e **dados financeiros detalhados** (lançamentos, saldos, investimentos, dívidas, patrimônio), inclusive extraídos de extratos enviados e, futuramente, via Open Finance.

## 2. Necessidade e proporcionalidade
- Os dados coletados são os necessários ao serviço contratado (planejamento financeiro).
- A classificação por IA usa apenas a descrição do lançamento; não envia CPF nem credenciais a esse provedor.
- Acesso administrativo é minimizado e auditado.

## 3. Riscos identificados e mitigação
| Risco | Prob. | Impacto | Mitigação já aplicada | Ação recomendada |
|-------|-------|---------|-----------------------|------------------|
| Vazamento por acesso indevido entre clientes (multi-tenant) | Baixa | Alto | RLS por cliente no banco; testes de isolamento | Revisões periódicas de policies |
| Força bruta / roubo de credencial | Média | Alto | Hash bcrypt, rate limiting, MFA no admin | Avaliar MFA para planejador |
| Comprometimento da conta admin (bypassa RLS) | Baixa | Muito alto | MFA obrigatório opcional, impersonação auditada | Tornar MFA admin obrigatório |
| Transferência internacional (EUA) | Média | Médio | Fornecedores com contrato | Formalizar DPAs + base do art. 33 |
| Exposição de dados a provedor de IA | Baixa | Médio | Só descrição enviada; sem CPF | Confirmar não-treinamento no contrato |
| Perda de dados | Baixa | Alto | — | **Contratar backup (Supabase Pro/PITR)** |
| Incidente sem detecção | Média | Médio | Logs de segurança/auditoria | **Ativar monitoramento (Sentry)** + alertas |

## 4. Riscos residuais e decisão
〔Após as ações recomendadas, avaliar o risco residual e registrar a decisão do Controlador de prosseguir com o tratamento.〕

## 5. Conclusão
O tratamento é necessário e conta com salvaguardas relevantes. As pendências prioritárias são: **backup**, **monitoramento**, **DPAs formais** e **MFA obrigatório no admin**. Recomenda-se revisão jurídica e atualização anual ou a cada mudança relevante.
