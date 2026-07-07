---
tags: [legalidade, juridico, assinatura-eletronica, rh, contratacao]
data_pesquisa: 2026-06-25
status: referencia
---

# Assinatura Eletrônica em Documentos de RH (sem ICP-Brasil)

**Pergunta de origem:** até onde dá pra ir com assinatura digital **não-ICP** nos documentos
de um processo de contratação? Resposta curta: **quase tudo** — desde que com trilha de auditoria correta.

> ⚠️ Síntese de fontes públicas (jun/2026), NÃO parecer formal. Ver [[fontes-e-jurisprudencia]].

## 1. Base legal — por que vale sem ICP-Brasil

- **MP 2.200-2/2001, art. 10 §2º:** assinaturas eletrônicas FORA da ICP-Brasil são válidas
  **se as partes aceitarem** o método. (É a brecha que libera tudo.)
- **Código Civil art. 107** + **CLT art. 443:** contrato de trabalho admite forma tácita/verbal/escrita
  → se aceita o não-escrito, aceita o escrito em digital.
- **Lei 14.063/2020:** define os 3 tipos (simples / avançada / qualificada).
- **Portaria MTP 671/2021:** o **próprio Ministério do Trabalho** validou guarda e assinatura
  digital de documentos trabalhistas (e regula o comprovante de ponto eletrônico).

## 2. Os 3 tipos de assinatura (Lei 14.063/2020)

| Tipo | O que é | Uso no RH |
|---|---|---|
| **Simples** | login/senha, clique de aceite | Fraca — risco de contestação |
| **Avançada** ⭐ | 2FA (OTP SMS/e-mail) + trilha de auditoria (IP, hora, hash, log); SEM ICP | **PADRÃO IDEAL** pra quase tudo de RH |
| **Qualificada** | certificado ICP-Brasil (e-CNPJ/e-CPF) | Só onde a lei exige; raro no RH privado. Único com presunção absoluta de autenticidade. |

**Alvo do kontrata = AVANÇADA.** Não precisa de ICP-Brasil.

## 3. ⛔ Regra de ouro (onde se perde na Justiça)

O **TST rejeita assinatura escaneada/colada** (imagem da rubrica à mão) — fácil de fraudar, NÃO vale.
Pra a avançada valer, a plataforma PRECISA gerar e guardar:

1. **Autoria** — quem assinou (CPF, nome) + método de autenticação (2FA). (CPC art. 411, II)
2. **Integridade** — **hash SHA-256** do documento (prova que não mudou). (CPC art. 784 §4º)
3. **Consentimento + trilha** — **IP, data/hora, log do aceite** + **PDF à prova de adulteração**
   com página de certificado/auditoria anexa.

Sem isso → "vulnerável à contestação, pode ser rejeitado pelo juiz". Com isso → robusto.

## 4. 🗺️ Mapa por documento

### ✅ Pode com assinatura AVANÇADA não-ICP (o grosso da contratação)
- Contrato de trabalho + aditivos (validado TRT-9)
- Contrato de experiência
- Ficha / registro de empregado (Portaria 671)
- Termo de Vale-Transporte
- Acordo de compensação / banco de horas
- Termo de recebimento de **EPI**
- Políticas internas, código de conduta, regulamento interno
- Termo **LGPD** / uso de imagem
- **Holerite / recibo de pagamento**
- Aviso e recibo de **férias**
- **Advertências / suspensões**
- ASO (atestado de saúde ocupacional)

### ⚠️ Pode, mas com cuidado extra
- **Cartão/comprovante de ponto** → Portaria 671 exige formato **PAdES** (PDF Advanced Electronic
  Signature). Atende-se, mas precisa implementar nesse padrão técnico.
- **Rescisão / TRCT** → TRT-8 aceitou eletrônica, mas é o doc de MAIOR litígio. Usar avançada
  reforçada (ou qualificada p/ blindagem máxima). Atenção à **homologação no sindicato**
  (contratos +1 ano em certas categorias) — segue regra de convenção coletiva.

## 5. Conclusão pro produto

- **Praticamente TODO o processo de contratação pode ser digital não-ICP.**
- Portal do colaborador (**cartão de ponto + holerite**) é **expressamente respaldado** (Portaria 671).
- O diferencial NÃO é "ter assinatura" — é **ter a trilha de auditoria certa** (hash + IP + 2FA +
  log + PDF lacrado). É isso que separa "documento que vale na Justiça" de "documento que o juiz rasga".
- kontrata pode gerar isso nativamente → fecha o ciclo **gerar → assinar → arquivar** no sistema.

## 6. Implicação técnica (quando formos construir)
Trilha mínima a capturar/guardar por assinatura: CPF+nome do signatário, método 2FA usado,
IP, timestamp, hash SHA-256 do PDF, log do aceite, e gerar PDF tamper-evident + página de
certificado. Formato PAdES no caso do ponto. Tudo viável sem ICP-Brasil.
