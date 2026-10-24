# Trabalho atual (11/10/2026)

## ✅ Portal do Colaborador + Holerites — no ar na Tradição e no Castrioto (956415e)
Ver [[modulos/portal-colaborador]]. Fluxo: importar PDF da contabilidade → classificar → publicar → colaborador abre com código do WhatsApp → "Ciente" → `_ASSINADO.pdf` na pasta + dossiê pra processo.

### Pendências pra usar de verdade
- **Tradição**: Evolution `KONTRATAAI` precisa QR (ou apontar pra `RECURSOS`) — sem isso o portal abre sem código ("só senha").
- **Castrioto**: configurar Evolution + cadastrar **celulares** dos 30 (todos sem celular) + ativar módulo "Holerites (Portal do Colaborador)" se não aparecer no menu.
- Teste na Tradição: colaborador id 122 "ROBERTO BASTOS RUIVO" (CPF 390.266.078-30, `TESTE-PORTAL`) com holerite simulado 09/2026 — **excluir depois**.
- Outros clientes kontrata ainda NÃO atualizados — subir **um por vez** quando o Beto pedir.

### Dev local (não vai pra produção)
- `kontrata_dev`: colaborador 99 de teste (CPF 529.982.247-25, senha `Teste@2026x`), aceites 3 e 4; Evolution → `RECURSOS`; `.env` `FRONTEND_URL=http://10.6.1.171:3004`.

## Ainda em aberto
- 🚨 `/api/config/configurations` responde 200 sem login em todos os clientes.
- Atendente Virtual subiu junto, desligado/não testado em produção.
- Backup `/root/kontrata-repo-untracked-20261011` na VPS (idêntico ao commitado — pode apagar).
