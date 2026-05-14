# CHECKLIST DE IMPLEMENTAÇÃO TÉCNICA — LGPD NO KONTRATA.AI

**Documento Interno** — Guia de desenvolvimento
**Versão:** 1.0
**Última atualização:** 04/05/2026

---

## OBJETIVO

Lista priorizada de implementações técnicas necessárias no Kontrata.ai para conformidade com LGPD. Cada item indica:
- 🔴 **Crítico**: bloqueia uso comercial seguro
- 🟡 **Importante**: deve ser entregue antes de escala
- 🟢 **Desejável**: melhoria contínua

---

## 1. ACEITES DE TERMOS

### 1.1. Tabela de aceites
🔴 **Crítico** — Status: ⬜ Pendente

```sql
CREATE TABLE consentimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,  -- 'termos_uso', 'privacidade', 'curriculo', 'biometria', etc
  versao VARCHAR(20) NOT NULL,  -- 'v1.0'
  hash_conteudo VARCHAR(64) NOT NULL,  -- SHA-256 do texto aceito
  titular_tipo VARCHAR(20) NOT NULL,  -- 'cliente', 'usuario', 'colaborador', 'candidato'
  titular_id VARCHAR(50) NOT NULL,
  cpf_hash VARCHAR(64),
  ip VARCHAR(45) NOT NULL,
  user_agent TEXT,
  aceito_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revogado_em TIMESTAMPTZ,
  motivo_revogacao TEXT,
  arquivo_url TEXT  -- PDF do termo se assinatura física
);
CREATE INDEX idx_consentimentos_titular ON consentimentos(titular_tipo, titular_id);
CREATE INDEX idx_consentimentos_tipo ON consentimentos(tipo);
```

### 1.2. Aceite no first-setup
🔴 **Crítico** — Status: ⬜ Pendente

- Modal/checkbox antes de criar a empresa;
- Link clicável pra abrir os Termos e Política;
- Botão "Aceitar e prosseguir" desabilitado até checkbox marcado;
- Grava no banco com IP/UA/timestamp.

### 1.3. Aceite no formulário público de currículo
🔴 **Crítico** — Status: ⬜ Pendente

- Checkbox obrigatório antes do "Enviar";
- Texto e link para termo;
- Grava com IP/UA do candidato.

### 1.4. Aceite biométrico (Vision Facial)
🔴 **Crítico** (se Vision Facial estiver ativo) — Status: ⬜ Pendente

- Tela de upload do termo assinado em PDF;
- OU geração automática do termo + assinatura digital integrada (Clicksign / D4Sign);
- Antes de capturar a primeira foto;
- Grava arquivo + metadados.

### 1.5. Versionamento
🟡 **Importante** — Status: ⬜ Pendente

- Sistema sabe qual versão de termo cada usuário aceitou;
- Quando termo for atualizado, força reaceite no próximo login;
- Mantém histórico das versões antigas acessíveis.

---

## 2. DIREITOS DO TITULAR

### 2.1. Tela "Meus Dados" (colaborador)
🔴 **Crítico** — Status: ⬜ Pendente

- Acessível pelo próprio colaborador (login);
- Mostra todos os dados pessoais armazenados;
- Botão **Exportar** (gera JSON + PDF);
- Botão **Solicitar Correção** (vira ticket pro RH);
- Botão **Solicitar Exclusão** (vira ticket pro DPO da empresa).

### 2.2. Portal do candidato
🟡 **Importante** — Status: ⬜ Pendente

- Link único enviado por e-mail após cadastro;
- Token assinado JWT com expiração;
- Acessa: dados, status do processo, exclusão.

### 2.3. Endpoint de exportação
🔴 **Crítico** — Status: ⬜ Pendente

```
GET /api/lgpd/exportar/:tipo/:id
→ ZIP com:
   - dados.json
   - dados.pdf
   - mapa_de_dados.txt (origem de cada campo)
```

### 2.4. Anonimização (vs deleção)
🔴 **Crítico** — Status: ⬜ Pendente

- Para cumprir CLT/eSocial não pode hard-delete colaborador;
- Implementar `colaboradorAnonimizar(id)` que:
  - Substitui nome por "Colaborador #ID";
  - Hash CPF (mantém para conferência fiscal);
  - Limpa contato, foto, endereço;
  - Mantém dados financeiros/fiscais por 5 anos.

### 2.5. Solicitações registradas
🟡 **Importante** — Status: ⬜ Pendente

```sql
CREATE TABLE solicitacoes_lgpd (
  id UUID PRIMARY KEY,
  titular_id VARCHAR(50),
  tipo VARCHAR(50),  -- 'acesso', 'correcao', 'exclusao', 'portabilidade', 'revogacao'
  status VARCHAR(20),  -- 'aberto', 'em_atendimento', 'concluido', 'rejeitado'
  prazo_legal DATE,  -- 15 dias após criada
  criada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  observacoes TEXT
);
```

---

## 3. SEGURANÇA TÉCNICA

### 3.1. Senhas
🔴 **Crítico** — Status: ✅ Implementado (bcrypt)

Verificar:
- [ ] bcrypt com cost ≥ 10;
- [ ] Senhas nunca aparecem em logs;
- [ ] Recuperação de senha por token único + expiração.

### 3.2. Criptografia em repouso para campos sensíveis
🟡 **Importante** — Status: ⬜ Pendente

Campos a criptografar:
- CPF, RG, CTPS, PIS;
- Conta bancária;
- Embedding biométrico facial;
- Dados de saúde (ASOs).

Sugestão: pgcrypto + chave KMS / variável de ambiente.

### 3.3. Logs de auditoria
🔴 **Crítico** — Status: ⬜ Pendente (parcial — falta auditoria de leitura)

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER,
  cliente_id INTEGER,
  acao VARCHAR(50),  -- 'CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT'
  recurso VARCHAR(100),  -- 'colaborador', 'curriculo', 'biometria'
  recurso_id VARCHAR(50),
  campos_acessados TEXT[],  -- pra leituras de dados sensíveis
  ip VARCHAR(45),
  user_agent TEXT,
  ocorrido_em TIMESTAMPTZ DEFAULT NOW()
);
```

Especialmente importante: **logar acesso a dados sensíveis** (foto, biometria, ASOs, dados bancários).

### 3.4. MFA / 2FA para admins
🟢 **Desejável** — Status: ⬜ Pendente

Pelo menos para usuários `master` e `admin`.

### 3.5. Bloqueio de tentativas de senha
🟡 **Importante** — Status: ⬜ Pendente

- 5 tentativas → bloqueio de 15 min;
- Notifica admin do tenant;
- Log de tentativas.

### 3.6. Logout automático
🟢 **Desejável** — Status: ⬜ Pendente

Após 30 min de inatividade, expira o JWT.

### 3.7. Rate limiting
🟡 **Importante** — Status: ⬜ Pendente

- Por IP no formulário público de currículo (anti-spam);
- Por user em endpoints sensíveis;
- Cloudflare Page Rules + middleware Express.

### 3.8. Headers de segurança
🟡 **Importante** — Status: ⬜ Pendente

- CSP (Content-Security-Policy);
- X-Frame-Options;
- X-Content-Type-Options;
- Strict-Transport-Security (HSTS).

### 3.9. Sanitização de input
🟡 **Importante** — Status: ✅ Implementado (TypeORM parametrizado)

Verificar:
- [ ] Não há `query` com concatenação de string;
- [ ] Validação de tamanhos e tipos em DTOs;
- [ ] Sanitização HTML em campos de texto longos.

---

## 4. RETENÇÃO E EXCLUSÃO AUTOMÁTICA

### 4.1. Job de retenção de currículos
🔴 **Crítico** — Status: ⬜ Pendente

```
Diariamente:
  SELECT * FROM rh_curriculos
  WHERE created_at < NOW() - INTERVAL '12 months'
    AND status NOT IN ('contratado')
  → anonimizar ou excluir
```

### 4.2. Limpeza de logs antigos
🟡 **Importante** — Status: ⬜ Pendente

- Logs de auditoria > 12 meses → arquivar/comprimir;
- Logs > 24 meses → deletar (mantém estatística agregada).

### 4.3. Política de retenção configurável por tenant
🟢 **Desejável** — Status: ⬜ Pendente

Tela em "Configurações > Privacidade" do Cliente:
- Retenção de currículos: 6 / 12 / 24 meses;
- Retenção de logs: 6 / 12 meses;
- Retenção de gravações: 30 / 60 / 90 dias.

---

## 5. CONSENTIMENTO E REVOGAÇÃO

### 5.1. Tela de gestão de consentimentos
🟡 **Importante** — Status: ⬜ Pendente

Para cada usuário/colaborador:
- Ver seus consentimentos ativos;
- Botão revogar individual;
- Histórico de revogações.

### 5.2. Trigger de exclusão pós-revogação
🔴 **Crítico** — Status: ⬜ Pendente

Quando consentimento é revogado:
- Em até 15 dias: trigger automático de exclusão;
- Notifica DPO;
- Gera comprovante.

---

## 6. INCIDENTES

### 6.1. Tabela de incidentes
🟡 **Importante** — Status: ⬜ Pendente

Estrutura conforme Ficha de Incidente do Plano de Resposta.

### 6.2. Detecção automatizada
🟢 **Desejável** — Status: ⬜ Pendente

Alertas:
- Login de novo IP/país;
- Tentativas excessivas de senha;
- Pico anormal de exportação de dados;
- Acesso fora de horário comercial a dados sensíveis.

### 6.3. Painel do DPO
🟢 **Desejável** — Status: ⬜ Pendente

Dashboard interno com:
- Incidentes abertos;
- Solicitações LGPD pendentes (com prazo);
- Aceites pendentes de reaceite (após nova versão);
- Métricas de auditoria.

---

## 7. INTEGRAÇÕES E TERCEIROS

### 7.1. Lista pública de sub-operadores
🟡 **Importante** — Status: ⬜ Pendente

Página `/sub-operadores` com a lista atualizada.

### 7.2. DPA com sub-operadores
🔴 **Crítico** — Status: ⬜ Pendente (revisar contratos da Hostinger, Cloudflare, Anthropic, OpenAI)

Confirmar que cada um tem DPA assinado ou cláusulas equivalentes.

---

## 8. TRANSPARÊNCIA

### 8.1. Página pública /privacidade
🔴 **Crítico** — Status: ⬜ Pendente

Política de Privacidade publicada no site.

### 8.2. Página pública /termos
🔴 **Crítico** — Status: ⬜ Pendente

Termos de Uso publicados.

### 8.3. Página /dpo (canal de contato)
🔴 **Crítico** — Status: ⬜ Pendente

E-mail kontrataai@gmail.com ativo + formulário de contato no site.

### 8.4. Banner de cookies
🟡 **Importante** — Status: ⬜ Pendente

No site institucional, com:
- Aceitar todos / Apenas necessários / Configurar;
- Categorias: necessários, analíticos, marketing.

---

## 9. DPIA (RELATÓRIOS DE IMPACTO)

### 9.1. DPIA para Vision Facial
🟡 **Importante** — Status: ⬜ Pendente

Documento que avalia:
- Necessidade e proporcionalidade do tratamento;
- Riscos identificados;
- Medidas de mitigação;
- Justificativa do uso.

### 9.2. DPIA para Recrutador IA
🟡 **Importante** — Status: ⬜ Pendente

Mesmo formato; ênfase em decisão automatizada.

---

## 10. TREINAMENTO E DOCUMENTAÇÃO

### 10.1. Treinamento interno LGPD
🟡 **Importante** — Status: ⬜ Pendente

Para toda a equipe da Kontrata.ai, especialmente quem tem acesso a dados.

### 10.2. Manual de boas práticas para Cliente
🟢 **Desejável** — Status: ⬜ Pendente

PDF entregue ao Cliente no onboarding com:
- Como configurar permissões;
- Como exercer direitos dos titulares;
- Boas práticas de uso.

### 10.3. FAQ público
🟢 **Desejável** — Status: ⬜ Pendente

Página de FAQ sobre privacidade no site.

---

## 11. ROADMAP SUGERIDO

### Fase 1 (próximas 2 semanas) — Crítico
1. Tabela `consentimentos` + endpoints
2. Aceite no first-setup
3. Aceite no formulário de currículo
4. Página `/privacidade` e `/termos` no site institucional
5. E-mail dpo@ ativo

### Fase 2 (próximo mês) — Crítico restante
1. Aceite biométrico no Vision Facial
2. Logs de auditoria de acesso a dados sensíveis
3. Tela "Meus Dados" do colaborador
4. Endpoint de exportação
5. Job de retenção de currículos

### Fase 3 (próximos 2-3 meses) — Importante
1. Criptografia em repouso para campos sensíveis
2. MFA para admins
3. Tabela de solicitações LGPD + tela de gestão
4. Tela de revogação de consentimentos
5. Configurações de retenção por tenant

### Fase 4 (próximos 6 meses) — Desejável
1. Painel do DPO
2. Detecção automatizada de incidentes
3. DPIAs formais
4. Banner de cookies
5. Auditoria externa / certificação

---

## 12. ANTES DE REVENDER PRA OUTRO CLIENTE

Checklist mínimo:
- [ ] Termos de Uso e Política revisados por advogado
- [ ] DPA pronto para assinatura
- [ ] DPO da Kontrata.ai designado e e-mail ativo
- [ ] Consentimento de currículo e biometria implementados
- [ ] Página `/privacidade` e `/termos` publicadas
- [ ] Tela "Meus Dados" do colaborador
- [ ] Plano de Resposta a Incidente formalizado
- [ ] Treinamento básico da equipe interna feito
- [ ] Lista de sub-operadores publicada
- [ ] Aceite no first-setup gravando no banco

---

**Próxima revisão:** 04/06/2026
**Responsável:** DPO Kontrata.ai
