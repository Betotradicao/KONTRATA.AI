---
tags: [legalidade, juridico, ia, recrutamento, lgpd, anpd, pl-2338, helen]
data: 2026-08-15
status: ⚠️ PERMITIDO, MAS COM CONDIÇÕES
---

# ⚖️ IA fazendo pré-entrevista — é LEGAL no Brasil (com 4 condições)

> Pesquisa em fontes públicas 2026-08-15. **NÃO é parecer jurídico.**
> Validar com advogado trabalhista/LGPD antes de vender como diferencial.
> Contexto: módulo [[../modulos/rh-ia-recrutadora]] (Helen) já em produção no Tradição.

## ✅ Conclusão

**Nenhuma lei brasileira proíbe IA conduzir entrevista ou pré-entrevista.**
Não existe artigo na LGPD, na CLT ou em resolução da ANPD que vede a prática.

O que gera penalidade não é **usar** IA — é **como** se usa. São 4 frentes de risco,
e a mais perigosa **não é a LGPD**.

---

## 🔴 Frente 1 — LGPD Art. 20 (decisão automatizada)

- Art. 20 dá ao titular **direito de pedir revisão** de decisão tomada *unicamente*
  por tratamento automatizado que afete seus interesses — **inclui perfil profissional**.
- ⚠️ O **§3º original (que exigia revisor humano) foi VETADO** na Lei 13.853/2019.
  Logo, a lei **não exige** revisor humano hoje — mas a ANPD está apertando isso.
- Art. 20 §1º: controlador deve fornecer **informação clara sobre os critérios** quando solicitado.
- "Revisão pro forma" (humano que só carimba) provavelmente **não** afasta a regra.

### 🎯 Regra prática que resolve
**IA entrevista, IA pontua, IA organiza. QUEM REPROVA É HUMANO.**
Se um humano decide de fato antes de comunicar a reprovação, o Art. 20 deixa de morder.

---

## 🔴 Frente 2 — Dado sensível (o risco que quase ninguém enxerga)

- **Voz e vídeo = biometria = dado sensível** (Art. 5º II + Art. 11).
- Pior: IA que analisa **emoção, microexpressão, tom de voz** gera **inferência sobre
  saúde mental / origem étnica** → dado sensível de novo, por outra porta.
- Base legal exigida: **consentimento específico e destacado** (Art. 11 I).
  ⚠️ Legítimo interesse **não** serve.

### 🎯 Decisão de produto recomendada
**NÃO analisar emoção / microexpressão / tom de voz.** Analisar o **conteúdo da resposta**.
**Por quê:**
1. Elimina a camada mais pesada de dado sensível.
2. **HireVue removeu análise facial em 2021** após auditoria provar viés.
3. **MIT Tech Review (Schellmann, 2021)**: MyInterview deu score parecido lendo Wikipedia
   vs. candidata real → *personality scoring por vídeo é espúrio*.
→ Ou seja: é risco jurídico alto **para comprar uma métrica que não funciona.**

---

## 🔴 Frente 3 — Lei 9.029/95 + MPT (discriminação) — **o risco que mais dói**

Mais perigoso que a ANPD, e pouco falado.

- Se o algoritmo reprova sistematicamente mulheres, pessoas mais velhas, negros, PCDs →
  **discriminação indireta**. **Não precisa haver intenção — o resultado basta.**
- Exposição: **ação civil pública do MPT**, dano moral coletivo, além da Lei 9.029/95.
- **NUNCA** coletar/inferir: estado civil, filhos, gravidez, religião, idade, orientação
  sexual, partido, origem.
- Mitigação: medir **paridade de score por grupo demográfico** periodicamente e documentar.

---

## 🟡 Frente 4 — PL 2338/2023 (Marco Legal da IA) — o que vem aí

- Aprovado no **Senado em 10/12/2024**; em 2026 tramita na **Câmara** (votação prevista
  no plenário em 27/05/2026). **Ainda não está em vigor.**
- Modelo europeu (AI Act): risco excessivo / alto / baixo.
- **RH e recrutamento = ALTO RISCO** → avaliação de impacto, transparência da lógica
  decisória, supervisão humana, auditoria.
- Sanções previstas: **até R$ 50 milhões por infração**.
- ⚠️ Ressalva: Executivo apontou **vício de iniciativa** (competências à ANPD) e enviou
  PL complementar em dez/2025 criando o **SIA**. Texto final ainda pode mudar.

→ **Arquitetar transparência agora custa pouco; fazer retrofit depois custa caro.**

---

## ⚠️ Frente 5 — ANPD já está fiscalizando (não é futuro)

- ANPD colocou **IA e decisões automatizadas** no **Mapa de Temas Prioritários 2026-2027**
  (um dos 4 eixos de fiscalização).
- Cita explicitamente **triagem de currículos com viés algorítmico e recrutamento**, exigindo
  demonstrar que existe **revisão humana disponível e acessível**.
- **Nota Técnica 12/2025**: consolidou 124 contribuições da consulta pública sobre Art. 20.
  Não cria obrigação direta, mas **sinaliza a direção regulatória**.
- Sanção LGPD: até **2% do faturamento no Brasil, teto R$ 50M por infração**.

---

## 🧨 Kontrata é penalizável? (SIM — não estamos imunes)

| Papel | Quem | Base |
|---|---|---|
| **Controlador** | O supermercado cliente (define a finalidade) | LGPD Art. 5 VI |
| **Operador** | **Kontrata** (trata em nome dele) | LGPD Art. 5 VII |

⚠️ **Art. 42**: o operador responde **solidariamente** se descumprir a lei **ou** as
instruções do controlador. **"Sou só o software" NÃO é blindagem.**

### 🎯 Proteção obrigatória
Contrato de operador (**DPA**) com cada cliente, definindo papéis, finalidade, retenção,
subprocessadores e responsabilidades. Sem isso, herdamos o risco do cliente.

---

## ✅ Checklist que blinda (7 itens)

1. **Humano reprova**, sempre. IA nunca dá o "não" final.
2. **Consentimento específico e destacado** antes da entrevista (não enterrado em termo geral).
3. **Avisar que é IA.** Nunca fingir que é pessoa.
4. **Sem análise de emoção/microexpressão/voz** — só conteúdo da resposta.
5. **Retenção curta** (90–180 dias pós-processo) com exclusão automática.
6. **Canal de revisão** visível: "não concordou? pede revisão humana aqui".
7. **DPA com o cliente** + log de quem decidiu o quê (trilha de auditoria).

---

## 💰 Leitura comercial

Fazer isso certo **não é custo, é diferencial de venda**. Gupy/Solides/Kenoby não comunicam
isso com clareza. "Nossa IA nunca reprova sozinha — quem decide é você, e o candidato pode
pedir revisão" é argumento de venda **e** blindagem jurídica no mesmo pacote.

---

## 📚 Fontes

- ANPD — Mapa de Temas Prioritários 2026-2027 (IA como eixo de fiscalização)
- ANPD — Nota Técnica nº 12/2025 (Art. 20 / decisões automatizadas)
- PL 2338/2023 — https://www25.senado.leg.br/web/atividade/materias/-/materia/157233
- LGPD (Lei 13.709/2018) Art. 5 II, Art. 11, Art. 20, Art. 42
- Lei 9.029/1995 (anti-discriminação na contratação)
- MIT Tech Review / Schellmann (2021) — crítica ao personality scoring por vídeo

## 🔗 Relacionados

- [[disc-em-candidatos]] — ⚠️ risco ALTO, diferente deste caso (DISC é teste psicológico privativo)
- [[../modulos/rh-ia-recrutadora]] — Helen, módulo em produção
- [[../modulos/rh]] · [[lgpd-compliance]]
