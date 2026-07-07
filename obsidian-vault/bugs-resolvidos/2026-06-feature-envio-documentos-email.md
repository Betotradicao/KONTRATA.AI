---
tags: [feature, rh, email, kontrata]
data: 2026-06-25
status: implementado-aguardando-teste
---

# Feature: Envio de documentos do RH por e-mail (piloto: Ficha Cadastral)

Botão **📧 Enviar por e-mail** na Ficha de Admissão → gera o PDF e anexa, enviando
**pelo e-mail DA EMPRESA (cliente)**, não pelo remetente de recuperação de senha.

## Arquitetura (decisões com WHY)

- **PDF gerado no FRONTEND** (`html2canvas` + `jspdf`, já nas deps) e mandado em base64.
  WHY: a Ficha é HTML montado no front (`window.print`); o backend não tem renderer
  HTML→PDF (sem puppeteer). Reaproveita o MESMO HTML da impressão via `buildFichaHtml()`
  (extraído de `imprimirFicha`). Foto convertida pra dataURL antes do capture (evita
  canvas "tainted" por CORS do MinIO).
- **Remetente = e-mail da empresa**, separado do remetente do sistema (recuperação de
  senha). Config própria: `email_empresa_user` / `email_empresa_pass` / `email_empresa_nome`
  na tabela `configurations` (por cliente). WHY: cliente quer que o e-mail saia do
  endereço dele (ex: RH do supermercado), que a Contabilidade reconhece.
- **Provedor detectado pelo domínio** em `email.service.makeTransporter()`:
  Gmail (`service:gmail`), **Yahoo** (`smtp.mail.yahoo.com:465 SSL` — pega @yahoo.com e
  @yahoo.com.br), senão SMTP custom (.env). `verifyCredentials()` e `sendEmailFrom()`
  usam o mesmo helper.

## Onde mexe

**Backend:**
- `services/email.service.ts`: `SendEmailOptions.attachments` + `cc`; `makeTransporter()`
  (extraído); `sendEmailFrom(creds, opts)` (envia com creds da empresa, from = e-mail dela);
  `verifyCredentials(user,pass)` (testa SMTP).
- `controllers/rh-email-doc.controller.ts` (NOVO): `enviarDocumento` (usa email_empresa_* se
  existir, senão fallback pro remetente padrão) + `testarEmailEmpresa`.
- `routes/rh.routes.ts`: `POST /rh/enviar-documento-email` + `POST /rh/email-empresa/testar`.

**Frontend:**
- `components/configuracoes/EmailsPadronizadosTab.jsx` (NOVO): aba com sub-abas
  **🏢 Email Empresa** (remetente + testar conexão INLINE abaixo dos botões) / **📇 Destinatários**
  (lista editável) / **📋 Ficha Cadastral** (assunto+corpo padrão). Editor de texto em 2 colunas
  com **painel de variáveis CLICÁVEIS** (inserem no cursor do campo ativo): `{NOME}` `{CARGO}`
  `{EMPRESA}` `{RESPONSAVEL}`. ⚠️ precisa do `<Toaster>` montado (RhConfiguracoes não tem).
- **{RESPONSAVEL}** = nome de usuário administrativo (Liberação de Acesso). No modal de envio
  da Ficha um dropdown lista os nomes (vindos de `GET /employees?limit=200`, campo `.name`) e
  re-aplica o token no assunto/corpo a partir do template base; cleanup final no envio.
- `pages/RhConfiguracoes.jsx`: aba `emails_padronizados` plugada (import + TABS + render).
- `pages/rh/FichasAdmissaoSection.jsx`: `buildFichaHtml()`/`gerarPdfFicha()`/`fotoComoDataUrl()`
  no módulo; handlers `abrirEnviarEmail`/`enviarEmailFicha`; botão + `<EnviarEmailModal>`.

## Config keys novas (em `configurations`, por cliente)
`email_empresa_user`, `email_empresa_pass`, `email_empresa_nome`,
`email_destinatarios` (JSON `[{nome,email}]`), `email_textos_padrao` (JSON `{ficha_cadastral:{assunto,corpo}}`).

## Para expandir a outros documentos
Adicionar entrada em `DOC_TIPOS` (EmailsPadronizadosTab) e replicar o botão+modal/gerador
no componente do doc. O endpoint e o serviço já são genéricos.

## Status
✅ Testado end-to-end LOCAL (Yahoo do cliente, e-mail chegou na inbox com PDF íntegro após fix
do prefixo data-uri). ✅ COMMIT+PUSH (`3231b76`, branch KONTRATAAI). ✅ **DEPLOY no TRADIÇÃO
(25/06) feito+VERIFICADO:** backend healthy, rota `/rh/email-empresa/testar` 401, bundle público
com marcador `email-empresa`. ⏳ Falta deploy nos outros 7 kontrata.

⚠️ **PÓS-DEPLOY por cliente:** as creds `email_empresa_*` e os destinatários NÃO migram (são por
banco/cliente). Em produção, cada cliente precisa cadastrar o e-mail remetente (Yahoo + senha de
app) e os destinatários na aba Emails Padronizados antes de usar.

## Lição: layout de PDF via html2canvas (campos "encavalados")
Grade de 4 colunas muito estreita + `gap:1px` fazia nomes longos quebrarem linha e
colidirem com a linha de baixo (e o html2canvas chega a "comer" espaços no wrap →
"DONASCIMENTOALVES"). Fix (commit `c807078`): 4→3 colunas, `gap:5px 16px`,
`align-items:start`, `line-height:1.45`, `overflow-wrap:anywhere`, e campos de texto
longo (nome/pai/mãe/cônjuge/reservista/certidão/cartório) em **largura total**
(`grid-column:1 / -1`, helper `linhaW`). Regra geral: em PDF rasterizado, texto longo →
linha inteira, nunca célula estreita de grade.

## Gotcha de deploy (PowerShell→ssh→bash)
`docker ps --format "{{...}}"` e comandos com `()`/aspas aninhadas QUEBRAM no wrapper. Usar
`docker ps` puro + `grep -e x -e y` (sem aspas), evitar parênteses em echo.
