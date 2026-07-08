# DPA / Contratos com fornecedores (sub-operadores) — controle

> ⚠️ MINUTA — documento interno de controle. O DPA (Data Processing Agreement /
> Acordo de Tratamento de Dados) formaliza as obrigações de cada operador sob a
> LGPD. Revisar com jurídico; anexar os contratos assinados.

## 1. Por que
Cada empresa que trata dados pessoais por nossa conta (operador/sub-operador) deve ter um instrumento contratual que garanta: finalidade limitada, segurança, sigilo, sub-contratação controlada, suporte a direitos do titular, notificação de incidentes e regras de transferência internacional.

## 2. Situação por fornecedor
| Fornecedor | Papel | Trata o quê | DPA/termos | Transf. internacional | Status |
|-----------|-------|-------------|-----------|----------------------|--------|
| **Supabase** | Operador (banco/storage) | Todos os dados da aplicação | DPA padrão do fornecedor 〔anexar/aceitar〕 | EUA | 〔pendente confirmar〕 |
| **Vercel** | Operador (hospedagem) | Tráfego/execução | DPA padrão 〔anexar〕 | EUA | 〔pendente〕 |
| **OpenAI** | Operador (IA) | Descrição de lançamentos | DPA / termos de API (confirmar não-treinamento) | EUA | 〔pendente〕 |
| **Asaas** | Operador (pagamento) | Dados de cobrança | Termos + DPA 〔anexar〕 | Brasil | 〔pendente〕 |
| **Google** | Operador (Agenda/OAuth) | Dados de agenda/CRM | Google API Terms + DPA | EUA | 〔pendente〕 |
| **Pluggy** | Operador (Open Finance) | Dados bancários | Contrato + DPA (ao ativar) | Brasil | 〔ao ativar〕 |
| **Sentry** | Operador (monitoramento) | Metadados de erro | DPA padrão 〔ao ativar〕 | EUA | 〔ao ativar〕 |

## 3. Cláusulas mínimas a garantir em cada DPA
- Tratamento apenas conforme instruções do Controlador e para as finalidades acordadas.
- Confidencialidade e medidas de segurança adequadas.
- Regras para **sub-operadores** (autorização + mesmas obrigações).
- Apoio ao atendimento de **direitos dos titulares** e a solicitações da ANPD.
- **Notificação de incidentes** em prazo definido.
- **Transferência internacional** com salvaguardas (art. 33).
- Eliminação/devolução dos dados ao fim do contrato.

## 4. Ações
- 〔Aceitar/assinar e arquivar o DPA de cada fornecedor acima.〕
- 〔Manter esta tabela atualizada a cada novo fornecedor que trate dado pessoal.〕
