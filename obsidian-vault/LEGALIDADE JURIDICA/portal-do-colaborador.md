---
tags: [legalidade, juridico, portal-colaborador, assinatura-eletronica, holerite, ponto, advertencia, lgpd]
data_pesquisa: 2026-08-08
status: 🧊 BACKLOG — pesquisa concluida, construcao adiada por decisao do usuario (08/08/2026)
---

# 🏛️ Portal do Colaborador — fundamentos legais e plano

**Pergunta de origem (08/08/2026):** criar uma área grande no kontrata onde o colaborador
loga e vê mural de avisos, assinaturas pendentes, holerites, cartão de ponto, advertências
e Manual do Colaborador — com assinatura que tenha **validade jurídica no Brasil**.

> ⚠️ Síntese de fontes públicas (ago/2026), **NÃO é parecer jurídico**. Validar com
> advogado trabalhista antes de produção. Complementa [[assinatura-eletronica-rh]].

> [!note] 🧊 Status: BACKLOG (08/08/2026)
> Usuário decidiu **adiar a construção** — "vamos deixar apenas em histórias por enquanto,
> depois a gente estuda uma forma de ver isso". A pesquisa abaixo fica pronta pra quando
> retomar. **Nada foi codado.**

## 0. 🎯 A ARQUITETURA JÁ DECIDIDA (ler antes de tudo)

Na mesma conversa o usuário definiu o desenho, e ele é **muito mais simples** do que a
pesquisa assumia:

> "Não iremos fazer marcação de ponto lá. A ideia é pegar os **holerites em PDF enviados
> pela contabilidade**, assim como o **espelho de ponto em PDF do relógio**, e subir esse
> PDF no sistema. Ele apenas vai **desmembrar e identificar cada pessoa**. E o RH, vendo que
> está tudo certinho, aperta **um botão** que tanto **anexa na pasta** de holerites/cartão de
> ponto quanto **envia para o acesso do colaborador**."

**Consequências:**
- ✅ **Mata a preocupação de REP-P por completo** (§2). O Kontrata não emite nada — é sistema
  de **guarda e entrega** de PDF que já veio pronto de terceiro. Sem ICP-Brasil, sem PAdES,
  sem homologação.
- ✅ A assinatura avançada em cima do documento **deixa de ser necessária**. O que o
  `art. 464` pede (prova de que recebeu) é atendido pelo **log de acesso + ciência**:
  quem abriu, quando, IP, aceite. Bem mais barato de construir.
- 🔄 O problema técnico **muda de lugar**: vira **fatiar o PDF e acertar de quem é cada página**.
- 🚨 **RISCO PRINCIPAL — e não é jurídico, é de vazamento:** página atribuída à pessoa errada
  = colaborador A vê o **salário** do colaborador B. Incidente LGPD, não bug de tela.
  Por isso o botão de conferência do RH **é o controle de segurança do fluxo**, não conveniência.
  Desenhar com: casamento por **CPF/matrícula** (nunca por nome — homônimo e grafia variam),
  score de confiança por página, e **bloqueio de publicação** enquanto houver página duvidosa.
  **Nunca publicar automático.**

**Estado das dependências (conferido em 08/08/2026):**
- ✅ `pdf-parse` no backend (extrai texto)  ·  ✅ `pdfkit`  ·  ✅ `sharp`
- ❌ falta `pdf-lib` (fatiar páginas)  ·  ❌ **sem OCR** — PDF escaneado sem camada de texto
  não será lido (holerite de contabilidade e espelho RHiD costumam ser digitais, então ok)

**Bloqueio pra começar:** precisa de **PDF de exemplo real** de cada tipo (lote de holerites
e lote de espelho) pra escrever o identificador, e confirmar se **CPF ou matrícula aparece
impresso em cada página**.

## 1. ✅ A boa notícia: o portal é expressamente respaldado

Nada aqui exige lei nova. A base já existe:
- **MP 2.200-2/2001 art. 10 §2º** — assinatura fora da ICP-Brasil vale **se as partes aceitarem o método**.
- **Lei 14.063/2020** — define simples / avançada / qualificada.
- **Portaria MTP 671/2021** — o próprio MTE validou guarda e assinatura digital de documento trabalhista.
- **CLT art. 464 § único** — comprovante de **depósito bancário tem força de recibo**. É a chave do holerite.

**Alvo do produto = assinatura AVANÇADA** (2FA + trilha de auditoria). Não precisa de ICP-Brasil,
com **uma exceção** (§4).

## 2. 🚨 A distinção que muda a arquitetura: EXIBIR ≠ SER REP-P

O comprovante **de cada marcação** de ponto é obrigação do **REP-P** (o sistema de registro),
e a Portaria 671 exige que ele seja PDF assinado em **PAdES com certificado ICP-Brasil**,
disponibilizado ao trabalhador logo após a marcação (com extração das últimas 48h).

➡️ **No kontrata o relógio é a RHiD/Control iD — o REP-P é DELES, não nosso.**
Se o portal apenas **exibe o espelho/cartão de ponto** (consulta, conferência, PDF de espelho),
ficamos **fora** da obrigação de REP-P. Se um dia emitirmos o comprovante oficial da marcação,
viramos REP-P e herdamos ICP-Brasil + homologação + AFD/AEJ em CAdES (.p7s).

**Decisão de produto:** portal = **espelho para conferência e ciência**, não emissor de comprovante fiscal.
- Detalhe: **REP-A** exige previsão em acordo/convenção coletiva; **REP-P não exige**.

## 3. 📄 Mapa por item pedido

| Item | Base legal / o que exige | Nível de assinatura |
|---|---|---|
| **Holerite** | CLT art. 464 exige recibo assinado, **mas** o § único dá força de recibo ao depósito bancário. TST já anulou contracheque sem assinatura como prova. **Solução digital: log de acesso + aceite com trilha.** | Avançada (ou aceite logado + trilha) |
| **Cartão de ponto (espelho)** | Portaria 671. Só exibição/conferência → sem ICP. Emitir comprovante oficial → REP-P + PAdES ICP. | Avançada p/ o aceite do espelho |
| **Advertência / suspensão** | CLT art. 474 (suspensão ≤ 30 dias). **Recusa em assinar NÃO invalida** — registra-se a recusa + **2 testemunhas**. | Avançada + **fluxo de recusa** |
| **Manual do Colaborador / regulamento interno** | Integra o contrato; obriga durante todo o vínculo. Quem assinou o termo de ciência não alega desconhecimento. | Avançada, com **versionamento** |
| **Mural de avisos** | Sem exigência formal — o valor é a **prova de ciência**. Para NR-1/OS de segurança, a norma **aceita registro eletrônico** desde que se comprove acesso + ciência. | Ciência registrada (log) ou aceite |
| **Assinaturas pendentes** | É a fila dos itens acima. | — |

## 4. ⛔ A regra de ouro (onde se perde na Justiça)

O TST **rejeita assinatura escaneada/colada**. Para a avançada valer, guardar SEMPRE:
1. **Autoria** — CPF + nome + método de autenticação usado (CPC art. 411, II)
2. **Integridade** — **hash SHA-256** do documento (CPC art. 784 §4º)
3. **Consentimento + trilha** — IP, data/hora, user-agent, log do aceite
4. **PDF lacrado** (tamper-evident) + **página de certificado de auditoria** anexa

> 💡 O diferencial do produto **não é "ter assinatura"** — é ter a **trilha certa**.
> É isso que separa documento que vale na Justiça de documento que o juiz rasga.

## 5. 🔐 Opções de autenticação/assinatura (o "várias opções" pedido)

Ordem de robustez crescente. Todas registram a mesma trilha:
1. **Login do portal** (senha própria) — base mínima; sozinha é assinatura *simples*
2. **OTP por e-mail** — sobe pra avançada
3. **OTP por WhatsApp/SMS** — ⭐ melhor pro público de supermercado (já temos Evolution API)
4. **Selfie/foto no ato** — reforço de autoria (⚠️ biometria = dado sensível LGPD art. 11)
5. **gov.br assinatura avançada** (API `assinarPKCS7`, hash SHA-256 do PDF) — exige conta **prata ou ouro**; bom como opção premium
6. **ICP-Brasil (qualificada)** — só onde a lei exigir; raro no RH privado

⚠️ **A adesão ao método precisa ser aceita pelas partes** (MP 2.200-2) → **termo de adesão
ao meio eletrônico** assinado na admissão é pré-requisito de tudo.

## 6. ⏳ Guarda (LGPD × obrigação legal)

Não dá pra apagar a pedido do titular quando há obrigação legal de guarda:
- **5 anos** — contratos, acordos, recibos de férias e pagamento (prescrição trabalhista)
- **20 anos** — ASO / PCMSO após o desligamento
- **30 anos** — documentos de FGTS (o mais longo)

Base legal LGPD para o portal = **cumprimento de obrigação legal** (art. 7º, II) e
**execução do contrato** (art. 7º, V) — **não** consentimento, que o empregado pode revogar
e é viciado pela hierarquia. Consentimento só para o acessório (ex: foto/biometria).

## 7. 🧱 Implicação técnica (quando construir)

- Tabela de **assinaturas** com: documento_id, colaborador_id, tipo de doc, **hash SHA-256**,
  método de autenticação, IP, user-agent, timestamp, status (pendente/assinado/recusado/expirado)
- **Versionamento** de Manual/políticas: mudou a versão → **nova ciência** de todos
- Gerar **PDF lacrado + página de certificado** (autoria, hash, trilha) no momento do aceite
- **Fluxo de recusa** na advertência: registra recusa + 2 testemunhas (espelha o mundo físico)
- Notificação por **WhatsApp** (Evolution API já existe) puxando pro portal
- Login do colaborador: já existe `type: 'employee'` no auth — **reaproveitar**, não criar outro

## 8. ⚠️ Riscos / pegadinhas
- **Não** prometer "validade jurídica garantida" em material de venda — dizer o que o sistema **registra**.
- Portal não substitui entrega do holerite a quem não tem acesso digital → prever **alternativa impressa**.
- Notificar fora do horário toca em **direito à desconexão** — agendar envio em horário comercial.
- Reforma trabalhista em discussão em 2026: **revalidar antes de vender como conformidade**.

## 🔗 Relacionados
- [[assinatura-eletronica-rh]] · [[fontes-e-jurisprudencia]] · [[00-INDICE]]
- [[../modulos/rh]] · [[../modulos/lgpd-compliance]]
- Modo demonstração LGPD (mascaramento p/ vídeo): `_current-work.md`

## 📚 Fontes
- Migalhas — validade de assinaturas eletrônicas nas relações trabalhistas
- TST — contracheques sem assinatura inválidos como prova de evolução salarial
- Pontotel / TOTVS Espaço Legislação — Portaria 671/2021 (PAdES, CAdES, REP-P × REP-A)
- Contabeis / Jusbrasil — advertência: recusa em assinar + 2 testemunhas
- Portal NR1 / eduseg — NR-1 aceita registro eletrônico de ciência e log de EaD
- eBox Digital / SOC — prazos de guarda (5 / 20 / 30 anos)
- manual-integracao-assinatura-eletronica.servicos.gov.br — API assinatura avançada gov.br
