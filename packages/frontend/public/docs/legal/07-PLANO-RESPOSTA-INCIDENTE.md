# PLANO DE RESPOSTA A INCIDENTES DE SEGURANÇA

**Documento Interno** — Art. 50, §1º, II, "g" da LGPD
**Versão:** 1.0
**Última atualização:** 04/05/2026
**Responsável:** DPO Kontrata.ai

---

## 0. AVISO

Este plano é **acionado em emergência**. Mantenha cópia impressa e digital, acessível 24/7 ao DPO e equipe técnica.

---

## 1. DEFINIÇÕES

**Incidente de Segurança**: qualquer evento adverso, confirmado ou suspeito, que possa ter afetado a **confidencialidade, integridade ou disponibilidade** de dados pessoais.

**Categorias**:
| Tipo | Exemplo |
|------|---------|
| **Vazamento** | Dados expostos publicamente, em fórum, na deep web |
| **Acesso não autorizado** | Invasão de conta, escalada de privilégio, vazamento de credenciais |
| **Alteração indevida** | Dados modificados sem autorização (ex: ransomware) |
| **Perda** | Dados perdidos sem possibilidade de recuperação |
| **Indisponibilidade** | Serviço fora do ar prejudicando exercício de direitos |
| **Phishing/Engenharia Social** | Tentativas direcionadas a equipe ou usuários |

---

## 2. EQUIPE DE RESPOSTA

| Papel | Responsável | Contato Principal | Backup |
|-------|-------------|-------------------|--------|
| **Comandante de Incidente** | DPO Kontrata.ai | kontrataai@gmail.com / [tel] | [backup] |
| **Líder Técnico** | Roberto / [a definir] | [tel] | [backup] |
| **Comunicação Externa** | DPO Kontrata.ai | kontrataai@gmail.com | [backup] |
| **Jurídico** | Advogado contratado [a definir] | [contato] | - |
| **Suporte ao Cliente** | [a definir] | [contato] | - |
| **Forense** (se necessário) | Empresa terceirizada [a contratar] | [contato] | - |

**Acionamento 24/7**: WhatsApp do DPO + e-mail dpo@.

---

## 3. FLUXO DE RESPOSTA

```
┌─────────────────────┐
│  1. DETECÇÃO        │  Logs, alertas, denúncia, terceiro
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  2. TRIAGEM         │  Confirmar, classificar, priorizar
│  (até 1 hora)       │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  3. CONTENÇÃO       │  Bloquear, isolar, preservar evidências
│  (até 4 horas)      │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  4. ERRADICAÇÃO     │  Remover causa raiz
│  (até 24 horas)     │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  5. RECUPERAÇÃO     │  Restaurar serviço, monitorar
│  (até 48 horas)     │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  6. NOTIFICAÇÃO     │  ANPD + Cliente + Titular (paralelo)
│  ANPD: até 3 dias   │
│  Cliente: 24h       │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  7. PÓS-INCIDENTE   │  Lições aprendidas, melhorias
│  (até 30 dias)      │
└─────────────────────┘
```

---

## 4. ETAPAS DETALHADAS

### 4.1. DETECÇÃO

**Fontes de detecção**:
- Alertas automáticos (logs de acesso suspeito, picos de tráfego);
- Reclamação de cliente;
- Reclamação de titular;
- Comunicação de pesquisador de segurança;
- Notícia pública (fórum, deep web, mídia);
- Notificação de provedor (Cloudflare, Hostinger);
- Auditoria interna.

**Ação imediata**:
1. Quem detectou registra no canal `#incidentes` (Slack/WhatsApp);
2. Aciona Comandante de Incidente.

### 4.2. TRIAGEM (1 hora)

Comandante avalia:
- **É realmente um incidente?** (descartar falso positivo)
- **Categoria e gravidade**:
  - **Crítico**: dados sensíveis vazados, > 1.000 titulares, ou exposição pública
  - **Alto**: dados pessoais expostos a terceiros, < 1.000 titulares
  - **Médio**: tentativa de acesso, sem confirmação de exfiltração
  - **Baixo**: indisponibilidade temporária sem perda de dados
- **Acionamento da equipe completa** se alto/crítico.

**Output**: Ata inicial registrando fato, hora, fonte, primeiras impressões.

### 4.3. CONTENÇÃO (4 horas)

**Objetivo**: parar o sangramento.

**Ações típicas**:
- Revogar credenciais comprometidas;
- Bloquear IPs maliciosos no Cloudflare;
- Desativar funcionalidades vulneráveis;
- Isolar servidores afetados;
- **Preservar evidências** (snapshots, logs) antes de qualquer alteração;
- **NÃO desligar máquinas afetadas sem snapshot prévio** (perde memória/cache).

**Cuidado**: não destruir o cenário antes da forense.

### 4.4. ERRADICAÇÃO (24 horas)

- Identificar causa raiz (exploração de CVE? credencial vazada? insider?);
- Aplicar correção (patch, mudança de configuração, remoção de backdoor);
- Validar que correção resolveu;
- Verificar se outras instâncias têm a mesma vulnerabilidade.

### 4.5. RECUPERAÇÃO (48 horas)

- Restaurar serviço com base em backup limpo se necessário;
- Forçar redefinição de senhas dos usuários afetados;
- Monitorar de perto por mais 7-14 dias;
- Verificar se o atacante voltou.

### 4.6. NOTIFICAÇÃO

#### 4.6.1. Notificação ao Cliente Controlador
**Prazo**: até **24 horas** após confirmação do incidente.
**Canal**: e-mail + telefone para o DPO/responsável do Cliente.
**Conteúdo**:
- Descrição do incidente;
- Categoria e volume estimado de dados afetados;
- Causa provável;
- Medidas tomadas;
- Recomendações ao Cliente.

**Template**: ver Apêndice A.

#### 4.6.2. Notificação à ANPD
**Prazo**: prazo razoável — recomendação ANPD: **até 3 dias úteis**.
**Canal**: formulário oficial em https://www.gov.br/anpd
**Quando notificar**: incidentes que possam acarretar **risco ou dano relevante** aos titulares (Art. 48 LGPD).
**Quem notifica**: Cliente Controlador notifica ANPD; Kontrata.ai presta apoio técnico.
**Para incidentes na infra da Kontrata.ai**: Kontrata.ai notifica ANPD em paralelo, citando os Clientes afetados.

**Conteúdo (formulário ANPD)**:
- Descrição da natureza dos dados afetados;
- Informações sobre titulares envolvidos;
- Indicação das medidas técnicas e de segurança utilizadas para proteção;
- Riscos relacionados ao incidente;
- Motivos da demora (se aplicável);
- Medidas adotadas para reverter ou mitigar.

#### 4.6.3. Notificação aos Titulares
**Prazo**: imediatamente após notificação à ANPD ou conforme orientação dela.
**Canal**: e-mail individual; em casos de massa, comunicado público.
**Conteúdo**: linguagem clara e acessível, sem termos técnicos.
**Template**: ver Apêndice B.

### 4.7. PÓS-INCIDENTE (30 dias)

- Reunião de **lições aprendidas** com toda a equipe;
- Atualização do plano e medidas;
- Treinamento adicional se necessário;
- Atualização do ROPA;
- Relatório final ao DPO e ao Cliente;
- Arquivamento de toda documentação por **5 anos**.

---

## 5. CRITÉRIOS DE NOTIFICAÇÃO À ANPD (decisão)

Notifique se SIM em qualquer dos itens:
- [ ] Houve acesso não autorizado confirmado a dados pessoais?
- [ ] Dados sensíveis foram afetados (saúde, biometria, sindical)?
- [ ] Mais de 100 titulares foram potencialmente afetados?
- [ ] Há risco real de discriminação, fraude financeira ou dano à imagem?
- [ ] Dados de menores foram afetados?
- [ ] Os dados foram divulgados publicamente (vazamento)?

Em caso de dúvida, **notifique** — omissão é infração mais grave que a notificação preventiva.

---

## 6. EVIDÊNCIAS A PRESERVAR

- Logs do servidor (webserver, banco, autenticação);
- Snapshot/imagem das máquinas afetadas;
- Capturas de tela;
- E-mails e comunicações;
- Hashes de arquivos suspeitos;
- Trafego de rede (se possível);
- Cronograma detalhado dos eventos.

**Cadeia de custódia**: se houver intenção de levar à polícia/justiça, contratar **perícia forense** desde o início.

---

## 7. COMUNICAÇÃO

### 7.1. Internamente
- Canal `#incidentes` (Slack/WhatsApp);
- Reunião diária enquanto durar o incidente.

### 7.2. Externamente
- **NUNCA falar com mídia sem alinhar com jurídico**;
- Comunicação oficial deve passar pelo DPO/jurídico;
- Em redes sociais: silêncio até comunicado oficial;
- Para clientes: e-mail estruturado;
- Para titulares: e-mail/SMS individualizado quando possível.

---

## 8. DOCUMENTAÇÃO

Cada incidente deve ter:
- Ficha de incidente (ID, data, categoria, gravidade);
- Cronograma de ações;
- Lista de evidências;
- Comunicações enviadas;
- Lições aprendidas;
- Anexos (relatórios técnicos, ofícios da ANPD).

Modelo no Apêndice C.

---

## 9. EXERCÍCIOS / TABLE-TOPS

Recomenda-se simulação **a cada 6 meses** com cenários:
- Vazamento de banco de currículos;
- Ransomware no servidor;
- Vazamento de credencial admin;
- Ataque de phishing direcionado.

Documentar lições, atualizar plano.

---

## 10. CONTATOS EXTERNOS DE EMERGÊNCIA

| Entidade | Contato | Quando acionar |
|----------|---------|-----------------|
| **ANPD** | https://www.gov.br/anpd | Notificação de incidente |
| **Polícia Civil — DRCI/DICCI** | [SP/MG/RJ — depende da localização] | Crime cibernético |
| **CERT.br** | https://www.cert.br | Suporte técnico inicial |
| **Provedor Hostinger** | [link suporte] | Suspeita de comprometimento da VPS |
| **Cloudflare** | dashboard | DDoS, WAF |
| **Advogado** | [a contratar] | Apoio jurídico |
| **Forense** | [a contratar] | Perícia técnica |

---

## APÊNDICE A — TEMPLATE DE NOTIFICAÇÃO AO CLIENTE

```
Assunto: [URGENTE] Notificação de Incidente de Segurança — Kontrata.ai

Prezado(a) [Nome],

Em cumprimento à LGPD e ao DPA firmado entre nossas empresas, comunicamos
formalmente a ocorrência de incidente de segurança que pode ter afetado dados
pessoais sob sua responsabilidade.

DATA E HORA DA DETECÇÃO: __/__/____ às __:__

DESCRIÇÃO RESUMIDA:
[Texto curto e objetivo do que ocorreu]

DADOS POTENCIALMENTE AFETADOS:
- Categorias: [comuns / sensíveis]
- Tipos: [ex: nomes, CPFs, e-mails]
- Volume estimado de titulares: [número]
- Período do incidente: [início — fim]

CAUSA PROVÁVEL:
[Texto técnico]

MEDIDAS JÁ ADOTADAS:
- [Lista]

PRÓXIMOS PASSOS:
- [O que ainda será feito]

RECOMENDAÇÕES PARA O CLIENTE:
- Avaliar necessidade de notificar a ANPD (recomendamos consultar seu jurídico);
- Avaliar necessidade de notificar os titulares;
- [Outras recomendações específicas]

DOCUMENTAÇÃO:
Estamos preparando relatório completo, que será enviado em [prazo].

CANAL DEDICADO:
DPO Kontrata.ai: kontrataai@gmail.com
Telefone: [tel]

Atenciosamente,
[Nome do DPO]
Kontrata.ai
```

---

## APÊNDICE B — TEMPLATE DE NOTIFICAÇÃO AO TITULAR

```
Assunto: Aviso importante sobre seus dados pessoais

Olá [Nome],

Estamos entrando em contato para informar que ocorreu um incidente de segurança
que pode ter afetado alguns dos seus dados pessoais cadastrados em nossa plataforma.

O QUE ACONTECEU?
[Linguagem simples, sem jargões]

QUAIS DADOS PODEM TER SIDO AFETADOS?
[Lista clara: nome, e-mail, etc.]

O QUE JÁ FIZEMOS?
[Ações tomadas]

O QUE VOCÊ PODE FAZER?
- [Trocar senha, ativar 2FA, ficar atento a phishing, etc.]

LAMENTAMOS PROFUNDAMENTE
[Pedido de desculpas]

CANAL DE DÚVIDAS
E-mail: kontrataai@gmail.com

Atenciosamente,
Equipe Kontrata.ai
```

---

## APÊNDICE C — FICHA DE INCIDENTE

```
ID: INC-YYYY-NNNN
Categoria: [vazamento / acesso / alteração / perda / indisponibilidade]
Gravidade: [crítico / alto / médio / baixo]
Status: [aberto / em contenção / em erradicação / em recuperação / encerrado]

DATAS:
- Detecção: __/__/____ __:__
- Confirmação: __/__/____ __:__
- Contenção: __/__/____ __:__
- Erradicação: __/__/____ __:__
- Encerramento: __/__/____ __:__

DETECTADO POR: [pessoa/sistema]
COMANDANTE: [nome]

DESCRIÇÃO:
[texto livre]

CAUSA RAIZ:
[texto livre]

DADOS AFETADOS:
- Categorias: [...]
- Volume estimado: [...]
- Tenant(s) afetado(s): [...]

AÇÕES TOMADAS (ordem cronológica):
1. ...
2. ...

EVIDÊNCIAS:
[lista]

COMUNICAÇÕES:
- ANPD: [data, protocolo]
- Clientes: [datas]
- Titulares: [datas]

LIÇÕES APRENDIDAS:
[texto]

MELHORIAS PROPOSTAS:
[texto]

ANEXOS:
[lista de arquivos]
```

---

**Documento sujeito a revisão jurídica antes do uso comercial.**
