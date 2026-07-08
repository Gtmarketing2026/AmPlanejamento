# Conformidade LGPD — AMplanejador

> ⚠️ **MINUTAS — NÃO PUBLICAR SEM REVISÃO JURÍDICA.** Estes documentos são
> rascunhos técnicos preparados a partir do funcionamento real do sistema
> (dados coletados, fornecedores, medidas de segurança). Precisam ser revisados
> por advogado/consultoria de LGPD e ter os campos 〔entre colchetes〕
> preenchidos antes de entrar no ar.

## Campos a preencher (valem para todos os documentos)
- 〔RAZÃO SOCIAL〕 — razão social da empresa controladora da plataforma
- 〔CNPJ〕
- 〔ENDEREÇO〕 — endereço completo da sede
- 〔NOME DO ENCARREGADO〕 — Encarregado (DPO) pela proteção de dados
- 〔E-MAIL DO ENCARREGADO〕 — e-mail do canal LGPD (ex: lgpd@…)
- 〔DATA DE VIGÊNCIA〕

## Papéis (importante — negócio B2B2C)
A plataforma tem **papel duplo** sob a LGPD:
- **Controladora** dos dados de cadastro/pagamento dos **planejadores** (clientes diretos da plataforma) e dos dados de acesso.
- **Operadora** (art. 39) dos dados financeiros dos **clientes finais**, tratados **por conta e ordem do planejador**, que é o Controlador da relação com o próprio cliente.

Isso precisa ser confirmado juridicamente e refletido nos contratos (planejador ↔ plataforma e planejador ↔ cliente final).

## Índice dos documentos
| # | Documento | Público-alvo | Vai ao ar? |
|---|-----------|--------------|-----------|
| 1 | [Política de Privacidade](politica-de-privacidade.md) | Público (site/app) | Sim |
| 2 | [Termos de Uso](termos-de-uso.md) | Público (site/app) | Sim |
| 3 | [Política de Cookies](politica-de-cookies.md) | Público (site/app) | Sim |
| 4 | [Consentimento Open Finance](consentimento-open-finance.md) | Cliente final (tela) | Quando ativar Pluggy |
| 5 | [Registro das Operações de Tratamento (ROPA)](ropa-registro-operacoes.md) | Interno | Não (mostrar à ANPD se solicitado) |
| 6 | [RIPD simplificado](ripd-simplificado.md) | Interno | Não |
| 7 | [Plano de Resposta a Incidentes](plano-resposta-incidentes.md) | Interno | Não |
| 8 | [DPA com fornecedores](dpa-fornecedores.md) | Interno / contratual | Não |
| 9 | [Política interna de segurança e acesso](politica-interna-seguranca.md) | Interno | Não |
| 10 | [Canal LGPD](canal-lgpd.md) | Público (site/app) + interno | Sim |

## Estado da implementação no produto
- Páginas no app: Política de Privacidade, Termos, Cookies e Canal LGPD **criadas** (em `frontend/src/pages/legal/`), com link no rodapé — **ainda não publicadas** (aguardando revisão + preenchimento).
- Medidas técnicas de segurança já no ar: ver [politica-interna-seguranca.md](politica-interna-seguranca.md) e o memory `seguranca-implementada`.
