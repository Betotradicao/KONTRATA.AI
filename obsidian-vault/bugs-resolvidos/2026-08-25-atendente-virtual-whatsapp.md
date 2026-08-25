# Atendente Virtual — menu automático no WhatsApp

**Data:** 2026-08-25
**Onde:** sistema dos CLIENTES (`packages/backend` + `packages/frontend`)

Menu numerado de atendimento. Escopo enxuto de propósito — sem construtor
visual de fluxos, sem IA, sem aba de conversas. Portado do chatbot do
prevenção-no-radar (`MarketingChatbot.jsx` + `mkt-chatbot.service.ts`).

## Onde fica
- Menu lateral → **ATENDENTE VIRTUAL** (módulo `atendente-virtual`, precisa
  ser ligado em Configurações → Módulos)
- Config do número: Configurações de REDE → aba **Atendente Virtual**
- Tabelas: `atendente_config`, `atendente_sessoes`, `atendente_mensagens`

## ⚠️ Instância da Evolution SEPARADA da dos disparos
O atendente precisa RECEBER mensagem (webhook). Ligar webhook no número dos
disparos faria o bot responder quem só respondeu um aviso de aniversário
ou de exame.

## 🪤 Armadilhas que custaram tempo (todas reais, nesta ordem)

**1. URL com `/manager`.** É o painel visual da Evolution, não a API. O teste
respondia `state: unknown` com a instância conectada. `limparUrl()` tira
automaticamente — é o endereço que a pessoa tem na mão pra copiar.

**2. Webhook não cadastrado = bot mudo, sem erro nenhum.** Tudo salvo, tudo
conectado, e nada acontece. Por isso `configurarWebhook()` registra sozinho ao
salvar, em vez de instruir na tela. Tenta o formato novo (`{webhook:{...}}`) e
cai pro antigo se a Evolution for mais velha.

**3. Interruptor que parecia rótulo.** Era um checkbox pequeno ao lado do texto
"Desligado". O usuário clicou em salvar achando que já estava ligado, e o
sistema gravou "desligado" obedientemente. Virou botão grande com chave.

**4. Log DEPOIS da checagem de ativo = diagnóstico cego.** Com o bot desligado
não sobrava rastro, e "não chegou nada" ficava indistinguível de "chegou e foi
ignorado". Agora registra ANTES de checar.

**5. "Falar com Atendente" calava o bot pra sempre.** `com_atendente = true`
fazia o bot ignorar tudo — da opção 2 em diante nada respondia, nem repetindo a
1. Corrigido: **número de opção funciona SEMPRE**, e escolher qualquer opção que
não seja a de atendente devolve a conversa pro bot.

**6. Reenviar o menu ao fim de cada opção furava o intervalo.** Parecia que a
regra das 4h não funcionava. O menu não é mais reenviado sozinho.

## Comportamento que parece bug mas é intencional
- Mensagem solta dentro do intervalo → **silêncio**. A mensagem de "não
  entendi" foi removida a pedido: virava eco em quem só manda "oi".
- `simular_digitando` + `segundos_espera` (2s): resposta instantânea entrega
  que é robô. A espera vale POR MENSAGEM — opção com 3 passos leva 6s.

## Como testar sem WhatsApp
`POST /api/atendente-virtual/webhook` com um payload fake da Evolution. Número
fictício falha no envio (400 `exists:false`) mas o motor roda e grava sessão —
o que prova que a lógica funcionou.

## Tags
#feature #whatsapp #chatbot #evolution #atendente-virtual
