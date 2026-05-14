# TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADO BIOMÉTRICO (FACIAL)

**Versão:** 1.0
**Última atualização:** 04/05/2026

---

## ⚠️ AVISO LEGAL CRÍTICO

A **biometria facial é considerada DADO PESSOAL SENSÍVEL** pela LGPD (Art. 5, II), exigindo:
- **Consentimento específico, livre, informado e inequívoco** do Titular (Art. 11, I);
- **Finalidade específica e justificada**;
- **Não vinculação obrigatória ao emprego** — recusa não pode gerar prejuízo;
- **Possibilidade de revogação a qualquer momento**.

Este termo deve ser:
- **Assinado fisicamente** ou por assinatura digital qualificada (ICP-Brasil ou plataforma equivalente);
- **Arquivado pelo Cliente (empresa)** por todo o período de tratamento + 5 anos;
- **Renovado** se a finalidade ou tecnologia mudar.

---

## TERMO

### TERMO DE CONSENTIMENTO PARA CADASTRO E USO DE BIOMETRIA FACIAL

Pelo presente instrumento, eu,

**Nome completo:** ____________________________________________
**CPF:** _______________________
**RG:** _______________________
**Cargo:** _______________________
**Empresa empregadora (Controladora):** ____________________________________________
**CNPJ da Empresa:** _______________________

declaro, de forma **livre, expressa, informada, específica e inequívoca**, que:

---

### 1. RECEBI INFORMAÇÕES CLARAS SOBRE

**1.1.** O que é o cadastro biométrico facial:
A captura, processamento e armazenamento de uma representação matemática (vetor de características — *embedding*) extraída da minha imagem facial, utilizada para reconhecimento automático em câmeras instaladas no estabelecimento.

**1.2.** Para que serve (FINALIDADES):
- ☐ **Prevenção de perdas** — identificação de colaboradores em áreas controladas (ex: estoque, depósitos, câmaras frias);
- ☐ **Controle de acesso** a áreas restritas;
- ☐ **Registro de presença** (se aplicável e configurado pela empresa);
- ☐ **Identificação em ocorrências** (ex: divergência de inventário, sinistros).

> **A empresa deve marcar somente as finalidades efetivamente aplicadas.**

**1.3.** Quais dados serão coletados:
- 1 a 5 fotos do rosto;
- Vetor matemático (embedding) gerado a partir das fotos;
- Metadados: data/hora do cadastro, identificação do operador que cadastrou.

**1.4.** Onde os dados ficam armazenados:
- No servidor da empresa-Controladora, dentro da plataforma Kontrata.ai (operada pela Kontrata.ai);
- **Não há envio das imagens para serviços externos de IA**;
- Dados criptografados em trânsito (HTTPS) e em repouso (a partir da implementação completa).

**1.5.** Quem terá acesso:
- Sistema de reconhecimento facial automatizado (sem intervenção humana);
- Equipe de Prevenção de Perdas e RH da empresa-Controladora, com login individualizado;
- Kontrata.ai, exclusivamente para suporte técnico, mediante registro;
- Autoridades, quando legalmente exigido.

**1.6.** Por quanto tempo:
Pelo período do meu vínculo trabalhista com a empresa, sendo **excluído em até 30 dias após o desligamento**.

**1.7.** Riscos:
- Falsos positivos (ser confundido com outra pessoa) — improvável, mas possível;
- Falsos negativos (não ser reconhecido) — improvável, mas possível;
- Em caso de incidente de segurança, embedding não é reversível em foto, mas pode ser comprometido junto com os dados.

---

### 2. CONSINTO COM

☐ A coleta da minha imagem facial em até 5 fotos no momento do cadastro;
☐ A geração de vetor biométrico (embedding) e seu armazenamento criptografado;
☐ A captura automática da minha imagem pelas câmeras da empresa nas áreas onde o sistema está instalado, exclusivamente para as finalidades indicadas no item 1.2;
☐ A comparação automática entre a imagem capturada pelas câmeras e o meu cadastro biométrico;
☐ O registro de eventos de identificação (data, hora, local, evento) para fins de prevenção e auditoria.

---

### 3. ESTOU CIENTE DE QUE

**3.1.** **Este consentimento é VOLUNTÁRIO**: minha recusa **não pode resultar em prejuízo, retaliação, alteração contratual ou demissão**.

**3.2.** **Posso revogar a qualquer momento**:
- Por solicitação ao RH/DPO da empresa, sem precisar justificar;
- A revogação implica exclusão do meu cadastro biométrico em até **15 dias**;
- A revogação **não tem efeito retroativo** — registros já gerados permanecem por prazo legal.

**3.3.** **Tenho os direitos do Art. 18 da LGPD**:
- Confirmação da existência de tratamento;
- Acesso aos meus dados biométricos (descrição, não a foto crua);
- Correção;
- Eliminação;
- Portabilidade;
- Revisão de decisões automatizadas;
- Informação sobre compartilhamento.

**3.4.** **Posso reclamar à ANPD**: https://www.gov.br/anpd

**3.5.** **Em caso de incidente de segurança**, serei notificado nos termos da LGPD.

**3.6.** **A empresa NÃO usará** meus dados biométricos para:
- Avaliação de desempenho psicológico/emocional;
- Reconhecimento de emoções;
- Vigilância em áreas de uso pessoal (banheiros, vestiários);
- Compartilhamento com terceiros não autorizados;
- Análises preditivas comportamentais.

**3.7.** **A finalidade é exclusiva** e qualquer uso para outras finalidades **exige novo consentimento**.

---

### 4. CANAIS DE CONTATO

**Encarregado de Dados (DPO) da Empresa:**
Nome: ____________________________________________
E-mail: _______________________
Telefone: _______________________

**Encarregado de Dados (DPO) da Kontrata.ai:**
E-mail: kontrataai@gmail.com

**RH da Empresa:**
E-mail: _______________________

---

### 5. DECLARAÇÃO FINAL

Declaro que **li, compreendi e aceitei** este termo, ciente de que:
- Posso solicitar uma cópia assinada;
- Posso esclarecer dúvidas com o RH ou DPO antes de assinar;
- A assinatura é voluntária.

---

### 6. ASSINATURAS

**Local:** ____________________________________
**Data:** ___/___/______

---

**COLABORADOR**

____________________________________________
[Nome completo]
CPF:

---

**TESTEMUNHA (sugerido — não obrigatório)**

____________________________________________
Nome:
CPF:
Cargo:

---

**REPRESENTANTE DA EMPRESA**

____________________________________________
Nome:
Cargo:
CPF:

---

## REGISTRO TÉCNICO NO SISTEMA

Quando o cadastro for realizado no Vision Facial, o sistema deve armazenar:

| Campo | Valor |
|-------|-------|
| **id_consentimento** | UUID |
| **colaborador_id** | FK |
| **versao_termo** | "v1.0" |
| **hash_termo** | SHA-256 do conteúdo |
| **data_assinatura** | timestamp |
| **arquivo_termo_assinado** | URL do PDF |
| **finalidades_marcadas** | array (prevenção, acesso, presença, ocorrências) |
| **operador_que_cadastrou** | usuário_id |
| **status** | ativo / revogado |
| **data_revogacao** | timestamp (se aplicável) |
| **motivo_revogacao** | texto livre |

---

## FLUXO DE REVOGAÇÃO

1. Colaborador solicita revogação (verbal, e-mail ou sistema);
2. RH registra a solicitação no sistema;
3. Sistema marca consentimento como `revogado`;
4. Em até **15 dias**:
   - Embedding facial é **excluído** do banco;
   - Foto original (se armazenada) é **excluída**;
   - Histórico de identificações é **anonimizado** (mantém estatística, remove vínculo);
5. Sistema gera **declaração de exclusão** entregue ao colaborador;
6. Notificação ao DPO da Kontrata.ai registrando a operação.

---

## CHECKLIST DE CONFORMIDADE PARA O CLIENTE

Antes de cadastrar qualquer colaborador no Vision Facial, o Cliente deve confirmar:

- [ ] Termo impresso ou em formato digital qualificado;
- [ ] Termo assinado pelo colaborador;
- [ ] Cópia entregue ao colaborador;
- [ ] Termo arquivado em pasta digital ou física segura;
- [ ] Aviso de monitoramento por câmeras afixado no estabelecimento;
- [ ] Política de Privacidade da empresa fornecida ao colaborador;
- [ ] Funcionário ciente do procedimento de revogação;
- [ ] DPO da empresa designado e contatável.

---

**Documento sujeito a revisão jurídica antes do uso comercial.**
**Por se tratar de DADO SENSÍVEL, recomenda-se ENFATICAMENTE revisão por advogado especializado em LGPD antes da implementação.**
