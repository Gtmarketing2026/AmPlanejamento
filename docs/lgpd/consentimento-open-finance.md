# Consentimento Open Finance — requisitos LGPD da tela

> ⚠️ MINUTA — a conexão via Open Finance (Pluggy) está ADIADA (ativar só quando
> a Andreia tiver as credenciais). Este documento define o que a tela de
> consentimento precisa conter para ficar conforme a LGPD + Open Finance/Bacen.
> A tela atual (`frontend/src/pages/openfinance/ConsentPage.jsx`) é uma prévia
> ilustrativa e recebeu os elementos de consentimento abaixo.

## 1. O consentimento precisa ser
Livre, informado, específico e destacado (art. 7º, I e art. 8º da LGPD) — e revogável a qualquer momento.

## 2. Elementos obrigatórios na tela
- **Quem** vai acessar os dados (a Plataforma, em nome do planejador identificado).
- **Quais dados** serão lidos (lista explícita: saldos, lançamentos, etc.).
- **Finalidade** (conciliação/acompanhamento financeiro) — e que é **somente leitura**, nunca movimentação.
- **Prazo/validade** do consentimento e como **revogar**.
- **Link para a Política de Privacidade**.
- Ação afirmativa clara ("Autorizar"), sem caixas pré-marcadas.
- Menção ao Open Finance regulado pelo Bacen.

## 3. Registro do consentimento (prova)
Ao ativar o Pluggy, registrar no banco: titular, data/hora, escopo autorizado, versão do texto de consentimento e evento de revogação. 〔Implementar tabela de consentimentos quando ativar.〕

## 4. Revogação
Disponibilizar, no painel do cliente, opção de **revogar** a conexão a qualquer momento, encerrando o acesso e registrando o evento.

## 5. Estado no código
- Tela de prévia reforçada com: aviso de somente-leitura, lista do que é autorizado, link para a Política de Privacidade e menção à revogação.
- Fluxo real (OAuth Pluggy + persistência do consentimento) fica para a ativação do Open Finance.
