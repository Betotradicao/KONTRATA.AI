# RESUMO EXECUTIVO — LGPD NO KONTRATA.AI

**Para:** Roberto (fundador Kontrata.ai)
**De:** Consultoria técnica em Privacy by Design
**Data:** 04/05/2026
**Confidencial — uso interno**

---

## 📌 NOTA DE STATUS — MVP

O Kontrata.ai está em **fase MVP** (Minimum Viable Product). Atualmente:
- **Sem CNPJ formal** — operando como pessoa física até validar o produto;
- **Clientes atuais** são parceiros próximos (ex: Tradição, Mameva), não há contrato comercial formal de grande porte;
- **Documentação legal** em construção (este pacote);
- **Plano**: ao validar tração comercial, abrir CNPJ (MEI ou ME) e formalizar.

**Premissa estratégica**: equilibrar ritmo de desenvolvimento com proteção mínima. A documentação legal já existir (mesmo sem CNPJ) reduz risco e prepara terreno pra crescer.

Os campos `[a preencher]` nos documentos serão completados **assim que o CNPJ for constituído**.

---

## 1. SITUAÇÃO ATUAL

A plataforma **Kontrata.ai** está sendo preparada para revenda comercial. Trata dados pessoais em alto volume, incluindo **dados sensíveis** (saúde via ASOs, biometria via Vision Facial, eventualmente sindicalização). Hoje opera **sem documentação jurídica formal**, sem aceite registrado, sem mecanismo de exercício de direitos do titular, sem DPA com Clientes e sem DPO designado.

**Risco atual: ALTO.** Em caso de incidente ou fiscalização da ANPD, exposição financeira e reputacional severa.

---

## 2. ESTRATÉGIA RECOMENDADA

**Caminho híbrido (mais seguro e econômico):**

1. **Documentação técnico-jurídica completa** (entregue neste pacote — pasta `docs/legal/`):
   - Termos de Uso
   - Política de Privacidade
   - DPA (Contrato de Operador)
   - Consentimentos específicos (currículo, biometria)
   - ROPA (Registro de Operações)
   - Plano de Resposta a Incidente
   - Aviso de Câmeras
   - Checklist de implementação técnica

2. **Revisão por advogado especialista em LGPD** (R$ 3.000 a R$ 8.000):
   - Não cria do zero (você já chega 70-80% pronto);
   - Refina, ajusta para sua razão social/CNPJ, valida cláusulas;
   - Emite parecer que te protege em juízo;
   - Custo total reduzido em 40-60% comparado a fazer tudo no escritório.

3. **Implementação técnica em fases** (Checklist 09):
   - Fase 1 (2 semanas): aceites + páginas públicas
   - Fase 2 (1 mês): direitos do titular + auditoria
   - Fase 3 (2-3 meses): criptografia em repouso + MFA + retenção
   - Fase 4 (6 meses): refinamentos e DPIAs

---

## 3. AÇÕES IMEDIATAS (NESTA SEMANA)

| # | Ação | Responsável | Prazo |
|---|------|-------------|-------|
| 1 | Definir razão social e CNPJ a usar nos documentos | Roberto | Imediato |
| 2 | Designar DPO formal (pode ser você inicialmente) | Roberto | Esta semana |
| 3 | Configurar e-mail kontrataai@gmail.com | Roberto | Esta semana |
| 4 | Buscar 2-3 advogados LGPD para orçar revisão | Roberto | Esta semana |
| 5 | Implementar aceite no first-setup | Claude | Próxima sessão |

---

## 4. RISCOS PRINCIPAIS A MITIGAR

### 4.1. Vision Facial
**Risco**: Tratamento de dado biométrico sem consentimento específico assinado é violação direta do Art. 11 da LGPD. Multa máxima até 2% do faturamento, limitada a R$ 50 milhões por infração.

**Mitigação**: Implementar termo de consentimento biométrico (doc 05) ANTES de cadastrar qualquer rosto. Para clientes que já têm biometria cadastrada sem termo, **regularizar imediatamente** com assinatura retroativa ou purga dos cadastros.

### 4.2. Banco de Currículos
**Risco**: Coleta sem consentimento explícito ou com consentimento mal formalizado. Riscos de ações coletivas se vazar (CPF + endereço + foto = identificação completa).

**Mitigação**: Implementar checkbox de consentimento (doc 04) + retenção máxima de 12 meses + canal de revogação + criptografia.

### 4.3. ASOs e Atestados
**Risco**: Dados de saúde tratados sem cuidado especial. Acessíveis a qualquer admin do tenant.

**Mitigação**: Restringir acesso por permissão específica + log de quem acessou + criptografia em repouso.

### 4.4. Recrutador IA
**Risco**: Decisão automatizada sem revisão humana documentada. Direito do titular do Art. 20 não atendido.

**Mitigação**: Aviso explícito ao candidato sobre IA + revisão humana obrigatória antes de decisão final + opção de pedir revisão humana.

### 4.5. Multi-tenant
**Risco**: Vazamento entre tenants se houver bug de query/permissão.

**Mitigação**: Isolamento por banco de dados (já implementado) + revisão de queries que aceitam tenant ID + testes de penetração.

---

## 5. CUSTOS ESTIMADOS

| Item | Custo Estimado | Frequência |
|------|---------------|-------------|
| Advogado LGPD (revisão inicial) | R$ 3-8 mil | One-time |
| Advogado LGPD (consultoria contínua) | R$ 1-3 mil/mês | Mensal (opcional) |
| Plataforma de assinatura digital (Clicksign/D4Sign) | R$ 100-500/mês | Mensal |
| Backup adicional (off-site) | R$ 100-300/mês | Mensal |
| Auditoria de segurança / pentest | R$ 5-15 mil | Anual |
| Certificação ISO 27701 (futuro) | R$ 30-80 mil | A cada 3 anos |
| Selo comercial (LGPD Brasil etc.) | R$ 200-500/mês | Mensal (opcional) |
| **TOTAL inicial** | **~ R$ 8-15 mil** | First year |
| **TOTAL contínuo** | **~ R$ 1.500/mês** | Recorrente |

---

## 6. RETORNO ESPERADO

- **Proteção legal**: redução drástica do risco de multa e processo civil;
- **Vantagem comercial**: clientes corporativos exigem conformidade — vira diferencial de venda;
- **Confiança**: titulares (funcionários e candidatos) tratam o sistema como sério;
- **Capacidade de escala**: poder atender clientes maiores (rede, atacarejo, etc.) que pedem DPA assinado;
- **Defesa em caso de incidente**: documentação prova diligência razoável.

---

## 7. PRÓXIMOS PASSOS COMIGO (CLAUDE)

Posso, nas próximas sessões, em paralelo à revisão jurídica que você fará:

1. ⬜ Implementar tabela `consentimentos` + endpoints
2. ⬜ Implementar aceite no first-setup
3. ⬜ Implementar aceite no formulário público de currículos
4. ⬜ Criar tela "Meus Dados" do colaborador
5. ⬜ Implementar logs de auditoria de acesso a dados sensíveis
6. ⬜ Criar páginas públicas `/privacidade` e `/termos` com os textos aprovados
7. ⬜ Job de retenção automática de currículos (12 meses)
8. ⬜ Termo biométrico digital integrado ao Vision Facial

Tudo isso é **mecânica técnica** — não depende do advogado terminar pra começar. Quando os textos voltarem refinados, é só substituir o conteúdo nas páginas.

---

## 8. RESUMO PRÁTICO

Você tem agora:
✅ 8 documentos jurídico-técnicos profissionais prontos
✅ Roteiro de implementação técnica priorizado
✅ Lista de riscos específicos do seu sistema
✅ Estimativa de custos
✅ Briefing claro pra levar ao advogado

**Custo desta consultoria comigo**: zero
**Próximo investimento**: R$ 3-8 mil em advogado especialista
**Tempo até estar minimamente em conformidade**: ~1 mês com foco

---

**Recomendação final:** Não posterga. LGPD é um daqueles tipos de risco que parecem distantes até que se materializem — e quando se materializa, o estrago é grande. Cada dia operando sem isso é dia de exposição.

---

**Documento sujeito a revisão jurídica antes do uso comercial.**
