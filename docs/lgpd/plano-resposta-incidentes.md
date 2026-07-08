# Plano de Resposta a Incidentes de Segurança — AMplanejador

> ⚠️ MINUTA — documento interno. Revisar com jurídico/DPO. Manter os contatos
> atualizados e testar o plano periodicamente.

## 1. Objetivo
Definir como detectar, conter, tratar e comunicar incidentes de segurança que possam acarretar risco ou dano aos titulares (art. 48 da LGPD).

## 2. Papéis e contatos
| Papel | Responsável | Contato |
|-------|-------------|---------|
| Encarregado (DPO) | 〔NOME DO ENCARREGADO〕 | 〔E-MAIL/TELEFONE〕 |
| Responsável técnico | 〔NOME〕 | 〔CONTATO〕 |
| Jurídico | 〔NOME/ESCRITÓRIO〕 | 〔CONTATO〕 |

## 3. O que é um incidente
Acesso não autorizado, vazamento, perda, alteração ou indisponibilidade relevante de dados pessoais. Exemplos: exposição de dados entre clientes, comprometimento da conta admin, vazamento de banco, perda sem backup.

## 4. Fluxo de resposta
1. **Detecção/registro** — via monitoramento (Sentry, quando ativo), logs de segurança/auditoria, alerta do provedor (Supabase/Vercel) ou denúncia pelo [Canal LGPD](canal-lgpd.md). Registrar data/hora, quem detectou e evidências.
2. **Classificação** — gravidade (dados afetados, volume, sensibilidade — aqui há dado financeiro + CPF, portanto tende a "alto").
3. **Contenção** — ex.: revogar sessões/tokens, resetar credenciais, congelar contas afetadas, rotacionar segredos (JWT_SECRET, chaves de API), isolar o vetor.
4. **Erradicação e correção** — corrigir a causa raiz (patch, policy RLS, dependência vulnerável).
5. **Recuperação** — restaurar de backup se necessário, validar integridade.
6. **Comunicação:**
   - À **ANPD** e aos **titulares afetados** em prazo razoável quando houver risco/dano relevante (art. 48). 〔Confirmar prazo/limiar com jurídico — orientação ANPD.〕
   - Conteúdo mínimo: natureza dos dados, titulares afetados, medidas adotadas, riscos e medidas de mitigação.
7. **Pós-incidente** — relatório, lições aprendidas, atualização de controles e deste plano.

## 5. Registro
Manter um **registro de incidentes** (mesmo os contidos sem dano), com linha do tempo e decisões. 〔Definir onde: planilha/ferramenta interna.〕

## 6. Ações preventivas relacionadas (pendentes)
- Ativar **Sentry** + alertas (código já pronto, falta o DSN).
- Contratar **backup** (Supabase Pro/PITR) para viabilizar a etapa de recuperação.
- Rotina de rotação de segredos e revisão de acessos.
