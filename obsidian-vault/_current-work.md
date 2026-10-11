# Trabalho atual (11/10/2026)

## 🚧 Portal do Colaborador + importação de holerites — codado, aguardando Beto testar na tela
Spec/arquitetura em [[modulos/portal-colaborador]]. Ambiente local: front http://localhost:3004 (rede: http://10.6.1.171:3004), back :3010.
Tudo **sem commit** ainda. Arquivos novos/alterados:
- backend: `migrations/1787600000000-*`, `1787700000000-*`, `services/{holerite,holerite-importacao,portal-colaborador}.service.ts`, `controllers/{rh-holerites,portal-colaborador}.controller.ts`, `routes/portal-colaborador.routes.ts`, `middleware/auth.ts` (authenticateColaborador + 403 pra token de colaborador no painel), `middleware/access-log.middleware.ts` (mask senha), `controllers/rh-folha.controller.ts` (holerite usa service), `controllers/rh.controller.ts` (CRUD tipos holerite), `routes/rh.routes.ts`, `index.ts`, `package.json` (+pdf-lib).
- frontend: `pages/RhHolerites.jsx`, `pages/portal/{PortalLogin,PortalPrimeiroAcesso,PortalHolerites}.jsx`, `utils/portalApi.js`, `App.jsx`, `Sidebar.jsx`, `ModulosTab.jsx`, `modulesConfig.js`, `RhConfiguracoes.jsx` (aba Tipos Holerite).
- PDF de amostra: `Holerites 092026 - Tradição Comercial -Atualizado 1.pdf` (raiz do repo, não commitar).

Próximo passo: Beto testa em Financeiro RH → HOLERITES (importar o PDF, classificar, publicar) e abre /portal. Depois: commit + deploy (Tradição primeiro).

## ✅ Castrioto instalado + carga inicial feita (ver [[clientes/castrioto]])

## Feito local (sem commit): autofill do Chrome em Config. de REDE
`APIsTab.jsx` + `PontoRhidTab.jsx` com `autoComplete="off"`/`"new-password"`.

## Ainda em aberto (sessões anteriores)
- WhatsApp Tradição: instância `KONTRATAAI` caiu 08/09, QR novo; token `C508ABA4…`; Atendente Virtual → instância `TESTE` inexistente. Ver [[tradicao]].
- 21 commits locais do site/painel sem push (desde `1203da0`).
- 🚨 `/api/config/configurations` responde 200 sem login em todos os clientes.
