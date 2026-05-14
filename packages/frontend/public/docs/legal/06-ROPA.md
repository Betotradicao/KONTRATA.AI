# ROPA — REGISTRO DE OPERAÇÕES DE TRATAMENTO DE DADOS PESSOAIS

**Documento Interno** — Art. 37 da LGPD
**Versão:** 1.0
**Última atualização:** 04/05/2026
**Responsável pela manutenção:** DPO Kontrata.ai (kontrataai@gmail.com)

---

## ⚠️ NATUREZA DESTE DOCUMENTO

Este é um **documento interno obrigatório** pela LGPD. Não é compartilhado publicamente. Deve ser:
- Mantido **atualizado** sempre que houver mudança de processo, sistema ou base legal;
- Apresentado **à ANPD** quando solicitado;
- Apresentado **a Clientes** mediante solicitação razoável (resumo);
- Revisado **trimestralmente** pelo DPO.

---

## 1. CONTROLADOR / OPERADOR

### 1.1. Como Operador
A Kontrata.ai atua como Operador para os Clientes da plataforma Kontrata.ai. Os ROPAs específicos de cada Cliente devem ser mantidos por eles próprios, refletindo as decisões de tratamento que tomam.

### 1.2. Como Controlador
A Kontrata.ai atua como Controlador em relação a:
- Dados de seus Clientes (pessoa jurídica e responsáveis);
- Dados de Usuários administradores;
- Dados de cobrança;
- Dados de visitantes do site institucional;
- Logs operacionais e de auditoria internos.

Este ROPA cobre **ambos os papéis**.

### 1.3. Encarregado (DPO)
Nome: [a definir]
E-mail: kontrataai@gmail.com
Capacitação: [especificar curso/certificação]

---

## 2. OPERAÇÕES — VISÃO GERAL

| ID | Operação | Papel da Kontrata.ai | Categoria de Dados | Volume Estimado |
|----|----------|--------------|---------------------|------------------|
| OP-01 | Cadastro de Cliente (PJ) e Usuários | Controlador | Comuns | Baixo |
| OP-02 | Cadastro de Colaboradores no RH | Operador | Comuns + Sensíveis (saúde) | Alto |
| OP-03 | Banco de Currículos | Operador | Comuns + Sensíveis (DISC) | Médio |
| OP-04 | Vision Facial (biometria) | Operador | Sensíveis (biometria) | Médio |
| OP-05 | Vision PDV / Bipagens | Operador | Comuns (operadores) | Alto |
| OP-06 | Pesquisa de Clima | Operador | Comuns ou Sensíveis | Médio |
| OP-07 | Treinamentos e Certificados | Operador | Comuns | Médio |
| OP-08 | Recrutador IA | Operador | Comuns + Sensíveis (DISC, voz) | Médio |
| OP-09 | Logs e auditoria | Controlador | Comuns | Alto |
| OP-10 | E-mails transacionais | Controlador | Comuns | Médio |
| OP-11 | Marketing institucional | Controlador | Comuns | Baixo |

---

## OP-01 — CADASTRO DE CLIENTES E USUÁRIOS

| Item | Detalhe |
|------|---------|
| **Papel** | Controlador |
| **Finalidade** | Permitir contratação, autenticação, suporte e cobrança |
| **Base legal** | Execução de contrato (Art. 7, V) |
| **Dados** | Razão social, CNPJ, endereço, e-mail, telefone, nome/CPF do responsável, dados bancários para cobrança |
| **Origem** | Diretamente do Cliente |
| **Compartilhamento** | Hostinger (banco), provedor de e-mail, contabilidade externa |
| **Retenção** | Vigência do contrato + 5 anos (prescrição civil/fiscal) |
| **Medidas de segurança** | HTTPS, banco com acesso restrito, hash de senha, MFA admin (a implementar) |
| **Risco** | Baixo |

---

## OP-02 — CADASTRO DE COLABORADORES NO RH

| Item | Detalhe |
|------|---------|
| **Papel** | Operador |
| **Finalidade** | Gestão de RH conforme decidido pelo Cliente Controlador |
| **Base legal** | Definida pelo Cliente — tipicamente: execução de contrato de trabalho, obrigação legal (CLT, eSocial), legítimo interesse |
| **Dados Comuns** | Nome, CPF, RG, endereço, contato, dados bancários, cargo, salário, jornada, escala, foto, dependentes, formação |
| **Dados Sensíveis** | Saúde (ASOs, atestados), origem racial/étnica (eSocial), filiação sindical (descontos), biometria (se Vision Facial), dados genéticos (não tratados pela plataforma — vedado) |
| **Origem** | Inseridos pelo Cliente (RH) |
| **Compartilhamento** | Apenas dentro do tenant do Cliente; sub-operadores autorizados |
| **Retenção** | Definida pelo Cliente; mínimo legal CLT + eSocial = 30 anos para alguns dados |
| **Medidas de segurança** | Criptografia em trânsito, isolamento por tenant, RBAC, logs de auditoria |
| **Risco** | Alto (dados sensíveis e em volume) |

---

## OP-03 — BANCO DE CURRÍCULOS

| Item | Detalhe |
|------|---------|
| **Papel** | Operador |
| **Finalidade** | Pré-triagem e processo seletivo |
| **Base legal** | Consentimento do candidato (Art. 7, I; Art. 11, I se DISC) |
| **Dados Comuns** | Nome, CPF, RG, contato, endereço, foto, currículo, experiências, formação |
| **Dados Sensíveis** | Resultado DISC (se preenchido) — base legal: consentimento |
| **Origem** | Diretamente do Titular via formulário público |
| **Compartilhamento** | Apenas com o Cliente-Controlador |
| **Retenção** | 12 meses após cadastro (configurável pelo Cliente), exceto se contratado (vai pro RH) |
| **Medidas de segurança** | HTTPS, captcha (a implementar), rate limit, anonimização programada |
| **Risco** | Médio |

---

## OP-04 — VISION FACIAL (BIOMETRIA)

| Item | Detalhe |
|------|---------|
| **Papel** | Operador |
| **Finalidade** | Reconhecimento de colaboradores em câmeras para prevenção de perdas |
| **Base legal** | **Consentimento específico** (Art. 11, I) — Termo de Consentimento Biométrico assinado |
| **Dados** | Imagem facial (foto), embedding biométrico (vetor), metadados de cadastro |
| **Origem** | Cadastro pelo RH com consentimento do colaborador |
| **Compartilhamento** | Estritamente interno ao tenant; sem envio para serviços externos de IA |
| **Retenção** | Vigência do vínculo + 30 dias após desligamento; revogação implica exclusão em 15 dias |
| **Medidas de segurança** | Criptografia, isolamento, modelo local (sem upload externo), logs de quem cadastrou |
| **Risco** | **MUITO ALTO** (dado sensível biométrico) |
| **Avaliação de Impacto (DPIA)** | Recomendada — Art. 38 LGPD |

---

## OP-05 — VISION PDV / BIPAGENS

| Item | Detalhe |
|------|---------|
| **Papel** | Operador |
| **Finalidade** | Detecção de operações de risco em PDV, monitoramento de prevenção |
| **Base legal** | Legítimo interesse (Art. 7, IX) — operadores de caixa, com aviso prévio em treinamento |
| **Dados** | Identificação do operador, eventos de bipagem, palavras-chave detectadas |
| **Origem** | ERP do Cliente + sensores |
| **Retenção** | 12 meses para análise; estatísticas anonimizadas perpetuamente |
| **Medidas de segurança** | Acesso restrito a equipe de prevenção do Cliente |
| **Risco** | Médio |

---

## OP-06 — PESQUISA DE CLIMA

| Item | Detalhe |
|------|---------|
| **Papel** | Operador |
| **Finalidade** | Avaliar clima organizacional |
| **Base legal** | Consentimento (se identificada) ou Legítimo interesse (se anônima) |
| **Dados** | Respostas — podem incluir opiniões sobre lideranças, queixas (potencialmente sensíveis) |
| **Origem** | Funcionário voluntariamente |
| **Compartilhamento** | RH do Cliente |
| **Retenção** | 24 meses (configurável) |
| **Medidas de segurança** | Anonimização opcional, agregação de resultados |
| **Risco** | Médio |

---

## OP-07 — TREINAMENTOS E CERTIFICADOS

| Item | Detalhe |
|------|---------|
| **Papel** | Operador |
| **Finalidade** | Gerir capacitação e cumprir NRs (segurança do trabalho) |
| **Base legal** | Cumprimento de obrigação legal (NR-5, NR-6, etc.) |
| **Dados** | Lista de presença, certificados, datas |
| **Retenção** | 5 anos após emissão |
| **Risco** | Baixo |

---

## OP-08 — RECRUTADOR IA

| Item | Detalhe |
|------|---------|
| **Papel** | Operador |
| **Finalidade** | Pré-triagem automatizada de candidatos por IA conversacional |
| **Base legal** | Consentimento específico no formulário |
| **Dados** | Áudio/texto da entrevista, transcrição, avaliação |
| **Origem** | Candidato via link |
| **Compartilhamento** | Modelos de IA (Anthropic/OpenAI) — transferência internacional |
| **Retenção** | 12 meses |
| **Medidas de segurança** | Criptografia, opt-in, **revisão humana obrigatória da decisão final (Art. 20)** |
| **Risco** | **ALTO** (decisão automatizada + transferência internacional) |
| **Direito do Titular** | Direito a revisão humana explícito |
| **DPIA** | Recomendada |

---

## OP-09 — LOGS E AUDITORIA

| Item | Detalhe |
|------|---------|
| **Papel** | Controlador (logs operacionais da Kontrata.ai) e Operador (logs do tenant) |
| **Finalidade** | Segurança, investigação de incidentes, auditoria |
| **Base legal** | Legítimo interesse (Art. 7, IX) + obrigação legal (Marco Civil, Art. 15) |
| **Dados** | IP, timestamp, usuário, ação, recurso acessado |
| **Retenção** | Mínimo 6 meses (Marco Civil); recomendado 12 meses |
| **Medidas de segurança** | Append-only quando possível, acesso restrito ao DPO/segurança |
| **Risco** | Baixo |

---

## OP-10 — E-MAILS TRANSACIONAIS

| Item | Detalhe |
|------|---------|
| **Papel** | Controlador |
| **Finalidade** | Notificações operacionais (boas-vindas, recuperação de senha, alertas) |
| **Base legal** | Execução de contrato |
| **Dados** | E-mail, nome, conteúdo do e-mail |
| **Compartilhamento** | Provedor SMTP (a definir — Gmail, SendGrid, AWS SES) |
| **Retenção** | 12 meses para histórico; logs do provedor conforme política dele |
| **Risco** | Médio |

---

## OP-11 — MARKETING INSTITUCIONAL

| Item | Detalhe |
|------|---------|
| **Papel** | Controlador |
| **Finalidade** | Comunicar atualizações, novidades, promoções |
| **Base legal** | Consentimento (opt-in via newsletter) |
| **Dados** | E-mail, nome, segmentação |
| **Compartilhamento** | Provedor de e-mail marketing |
| **Retenção** | Até pedido de descadastro (link em todo e-mail) |
| **Risco** | Baixo |

---

## 3. CATEGORIAS DE TITULARES

| Categoria | Volume estimado | Risco |
|-----------|-----------------|-------|
| Clientes (PJ) e responsáveis | Baixo (~50) | Baixo |
| Usuários admins | Baixo (~200) | Baixo |
| Colaboradores ativos | Alto (~10.000+) | Alto |
| Colaboradores desligados | Médio | Médio (retenção legal) |
| Candidatos | Médio | Médio |
| Visitantes do site | Indefinido | Baixo |

---

## 4. SUB-OPERADORES E TRANSFERÊNCIA INTERNACIONAL

| Sub-operador | País | Finalidade | Base de Transferência |
|--------------|------|-----------|------------------------|
| Hostinger | BR/Lituânia | Hospedagem | Cláusulas contratuais padrão |
| Cloudflare | Global | CDN/DNS | Cláusulas contratuais padrão + agregação técnica |
| Anthropic | EUA | IA Recrutador | Cláusulas contratuais padrão; consentimento explícito |
| OpenAI | EUA | IA (alternativo) | Cláusulas contratuais padrão; consentimento explícito |
| Provedor SMTP | EUA/BR | E-mail | Cláusulas contratuais padrão |
| WhatsApp Business | Global | Mensagens | Cláusulas contratuais padrão |

---

## 5. MEDIDAS DE SEGURANÇA GLOBAIS

### Técnicas
- HTTPS/TLS em todas as interfaces (Cloudflare + Let's Encrypt);
- Hash bcrypt para senhas;
- Isolamento por tenant (banco PostgreSQL separado);
- Backups diários com retenção de 30 dias;
- Logs de auditoria;
- Atualizações de dependências;
- Revisão de código (a formalizar);
- Em implementação: criptografia em repouso para campos sensíveis (CPF, RG, dados bancários).

### Administrativas
- DPO designado;
- Acordos de confidencialidade com colaboradores e sub-operadores;
- Princípio do menor privilégio no acesso;
- Plano de Resposta a Incidente;
- Treinamento periódico em LGPD para equipe interna.

### Físicas
- Servidores em data center de provedor certificado (Hostinger);
- Sem acesso físico de pessoal da Kontrata.ai aos servidores.

---

## 6. AVALIAÇÕES DE IMPACTO (DPIA)

Operações que recomendam DPIA formal (Art. 38 LGPD):
- **OP-04 — Vision Facial** (biometria, dado sensível, decisão automatizada);
- **OP-08 — Recrutador IA** (decisão automatizada + transferência internacional + dado sensível);
- **OP-05 — Vision PDV** (monitoramento de trabalhadores, em volume).

DPIAs serão elaboradas conforme priorização e disponibilidade do DPO.

---

## 7. INCIDENTES REGISTRADOS

| Data | Tipo | Sistemas | Titulares | Status | Notif. ANPD |
|------|------|----------|-----------|--------|--------------|
| (nenhum até a data) | - | - | - | - | - |

---

## 8. REVISÃO

| Data da Revisão | Revisor | Mudanças |
|-----------------|---------|----------|
| 04/05/2026 | DPO Kontrata.ai | Versão inicial 1.0 |

---

**Próxima revisão programada:** 04/08/2026

---

**Documento confidencial. Uso interno e disponibilização sob demanda à ANPD/auditores autorizados.**
