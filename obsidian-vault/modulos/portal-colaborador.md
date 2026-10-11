---
tags: [modulo, rh, portal-colaborador, holerite, whatsapp]
status: ✅ MVP codado e testado localmente (11/10/2026) — aguardando validação do Beto + deploy
---

# 📱 Portal do Colaborador — holerite digital com ciência

Retomada do backlog de [[../LEGALIDADE JURIDICA/portal-do-colaborador|Portal do Colaborador (jurídico)]] em 11/10/2026,
motivada pela 2ª loja do [[../clientes/castrioto|Castrioto]]. **Escopo do MVP = só holerite.**
O motor (documento + hash + ciência com trilha) é genérico pra depois servir espelho de ponto, advertência e manual.

## Decisões do Beto (11/10/2026) — e o porquê
| Decisão | Escolha | Por quê |
|---|---|---|
| Fonte do holerite | **PDF da contabilidade importado** (não o gerador `rh-folha`) | Clientes ainda não usam a Folha do sistema. O gerador continua existindo (`publicarGerado`) pra quando usarem |
| Classificação | RH confere **de quem é** + **tipo** (lista editável: Pagamento, Adiantamento, Férias, 13º) + competência, depois **Publicar** | Página atribuída à pessoa errada = salário de A pro B (incidente LGPD). Nunca publica automático |
| Acesso | **Link fixo `/portal` + CPF + senha** | Beto quer "um acesso dele", não link descartável por documento |
| 1ª senha | **Link de 1º acesso** (72h) onde ele confirma o CPF e cria a senha | Evita senha trafegando no WhatsApp e senha = data de nascimento (fraca) |
| WhatsApp | **Só o link** (PDF fica dentro do portal) | Decisão revista no teste real: com o PDF no chat o colaborador não entra e a ciência não é registrada. Anexo existe como opção desligada (`configurations.portal_whats_anexar_pdf = 'true'`) |
| Prova de recebimento | Botão **"Ciente / Recebi"** grava SHA-256 do PDF + IP + user-agent + hora + método `cpf_senha` | CLT 464 § único + MP 2.200-2. Assinatura "simples" (sem 2FA) — OTP é fase 2 |
| Termo de adesão ao meio eletrônico | Doc Padronizado fase 1 (protegido) + subpasta TERMO MEIO ELETRÔNICO em DOCS CONTRATAÇÃO | MP 2.200-2 exige que as partes aceitem o método; assinado em papel na admissão |

## Assinatura (ciência) — como funciona e o que mostrar a um juiz (11/10/2026)
- **Desde 573b4d6 o código é pedido pra ABRIR** holerite ainda não confirmado (decisão do Beto: protege o salário). Validado → libera aquele documento por 30 min (`otp_validado_aceite_id/otp_validado_em`); "Ciente" dentro da janela = 1 toque e conta como 2 fatores. Depois do Ciente abre só com login.
- (histórico) antes, o "Ciente / Recebi" pedia **código de 6 dígitos no WhatsApp** (10 min, 5 tentativas, 1/min, só vale pro documento, guardado como SHA-256) → método `cpf_senha_otp_whatsapp` = assinatura **avançada** (Lei 14.063). Se o envio falha (sem celular / Evolution fora) libera ciência simples `cpf_senha` **só pra aquele documento** (`otp_falhou_aceite_id`) — backend nunca deixa pular o código se ele foi enviado.
- Após a ciência: `<holerite>_ASSINADO.pdf` (holerite + página "Comprovante de Ciência Eletrônica") vai pra pasta HOLERITES. **Original fica** — é ele que o SHA-256 impresso confere. RH também baixa em Publicações → 📄 comprovante.
- **Prova em juízo** = (1) PDF assinado com comprovante; (2) arquivo original → qualquer perito recalcula o SHA-256 e bate com o impresso; (3) trilha `rh_documento_aceite_eventos` (publicado, código enviado, visualizado, aceito, IP/UA); (4) termo de adesão ao meio eletrônico assinado na admissão; (5) `access_logs`; (6) comprovante do depósito bancário (CLT 464 § ún.) — continua sendo a prova principal do pagamento.

## Desligado
- Acessa por `portal_dias_acesso_desligado` dias após `data_desligamento` (padrão **150 = 5 meses**, editável na aba Acessos; 0 = corta). Sem data de desligamento = bloqueado.
- Bloqueio manual `rh_colaborador_acessos.ativo=false` vale por cima. Checado no login e **em toda requisição** (`PortalColaboradorService.podeAcessar`).

## Como o PDF da contabilidade é lido (calibrado com Tradição 09/2026, 39 págs)
Cada página tem `Periodo : 09/2026 Nro 111 Nome FULANO Admissão … CPF 15015202881 Função …` e o conteúdo repetido 2x (2 vias).
- **CPF** → casa com `rh_colaboradores.cpf` (dígitos) = confiança *alta*; nome exato normalizado = *média*; 2 primeiros nomes = *baixa*; senão *não identificado* (vermelho, RH escolhe).
- **Páginas consecutivas com mesmo CPF+período = 1 documento** (holerite que estourou a página, ex.: 12/13 e 38/39).
- **Tipo** = primeira `palavras_chave` de `rh_tipos_holerite` que aparece no título (13º/férias/adiantamento antes de "pagamento").
- "Nro" da contabilidade **≠ matrícula** do sistema — não usar pra casar.
- PDF escaneado (sem camada de texto) é recusado com mensagem clara.
- Regex em `lerCamposDaPagina()` (`services/holerite-importacao.service.ts`). Outro escritório contábil com layout diferente → ajustar ali.

## Arquitetura
- **Migrations** `1787600000000-CreatePortalColaborador` (acessos, aceites, eventos, termo) e `1787700000000-CreateHoleriteImportacao` (tipos, lotes, itens, `aceites.tipo_holerite_id`). Rodam sozinhas no boot.
- **Backend**
  - `services/holerite.service.ts` — gerador antigo extraído, devolve Buffer.
  - `services/holerite-importacao.service.ts` — pdf-parse (texto/página) + pdf-lib (fatiar) + MinIO `rh/holerites-import/lote-N/`.
  - `services/portal-colaborador.service.ts` — `publicarDocumento()` (hash → MinIO pasta HOLERITES → `rh_documentos` → aceite pendente → WhatsApp), `garantirAcesso()`, `reenviar()`, `listarPublicacoes()`. WhatsApp copia o padrão `sendText`+`sendMedia` do `dp-docs-whats.service.ts`; número = `celular` normalizado `55DDDN`.
  - `controllers/rh-holerites.controller.ts` → `/api/rh/holerites/*` (lotes, itens, publicar, publicações, eventos, acessos) + `/api/rh/configuracoes/tipos-holerite`.
  - `controllers/portal-colaborador.controller.ts` + `routes/portal-colaborador.routes.ts` → **`/api/portal`** (login, setup/:token, me, holerites, pdf, ciencia, senha). Rate-limit 20/10min nas públicas. Bloqueio 15 min após 5 senhas erradas.
  - JWT **`type: 'colaborador'`** (7 dias). `authenticateColaborador` só aceita esse tipo; **`authenticateToken` do painel rejeita (403)** esse tipo — testado.
  - Link do WhatsApp = `FRONTEND_URL` (instalador grava `https://<cliente>`), fallback host da requisição.
- **Frontend**
  - RH: `/rh/holerites` (`pages/RhHolerites.jsx`, módulo `rh-holerites` sob FINANCEIRO RH) — abas Importar & Classificar / Publicações (status, reenviar, trilha, copiar link) / Acessos (gerar link 1º acesso, reset).
  - Portal (público, token em `localStorage.portal_token`, axios próprio `utils/portalApi.js`): `/portal`, `/portal/primeiro-acesso/:token`, `/portal/holerites`.
  - Config RH → aba **Tipos Holerite** (nome, descrição, palavras-chave).

## Pegadinhas conhecidas
- Bucket MinIO tem policy **public-read** → o PDF publicado é alcançável por quem tiver a URL. Mitigação: URL nunca sai do backend (portal e preview são proxy). Fase 2: URL assinada/bucket privado.
- **Dev local não tem MinIO**: `configurations` do `kontrata_dev` aponta pro MinIO da VPS (bucket `minio-tradicao`, do Radar) — testes locais gravam lá. Limpar depois (DELETE lote/documento apaga do MinIO).
- `access_logs` mascara `senha/senha_atual/nova_senha` (adicionado ao mask).
- `trust proxy` não está setado → IP vem de `x-forwarded-for` manual (helper copiado do `lgpd.controller`).
- Publicação e reenvio são **manuais** (direito à desconexão: RH clica em horário comercial). Sem cron.
- Republicar mesma competência+tipo marca o aceite anterior `substituido` (documento antigo fica na pasta).

## Teste feito em 11/10 (local, PDF real da Tradição)
39 págs → 37 holerites em 1,9 s · 24 por CPF, 6 por nome, 7 não identificados (não existem no banco de dev) · publicar 2 → pasta HOLERITES + aceite + link de 1º acesso · fluxo completo do colaborador (setup → login → PDF → ciência → trilha com IP/UA) · isolamento de tokens · bloqueio por tentativas. Dados de teste removidos.

## Pendências pós-MVP
- OTP WhatsApp no aceite (assinatura avançada) · espelho de ponto/advertência/manual no mesmo motor · comprovante PDF de ciência · bucket privado · "Publicar" a partir da Folha do sistema na UI (API já existe: `POST /rh/holerites/publicar-gerado`).
- Castrioto: cadastrar **celulares** dos 30 e configurar **Evolution** antes do 1º disparo.
