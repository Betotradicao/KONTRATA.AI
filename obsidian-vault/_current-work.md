# Trabalho atual (11/10/2026)

## ✅ Portal do Colaborador + Holerites — commitado, push feito, DEPLOY na Tradição (8c75720)
Ver [[modulos/portal-colaborador]]. Migrations rodaram na Tradição (3 novas + 2 do Atendente Virtual), `/portal` responde 200.
Backup dos 7 arquivos soltos do Atendente que travavam o pull: `/root/kontrata-repo-untracked-20261011` (eram idênticos aos commitados — pode apagar).

### Próximo: Beto testar na Tradição
1. Config. de REDE → APIs → Evolution: instância `KONTRATAAI` ainda `connecting` (QR) — ou apontar pra `RECURSOS` (…6060590) que está `open`.
2. Cadastrar celular nos colaboradores que vão receber.
3. Financeiro RH → HOLERITES → importar PDF da contabilidade → classificar → publicar.
4. Se HOLERITES não aparecer no menu: Config. de REDE → Módulos → ativar "Holerites (Portal do Colaborador)".
Depois validar: propagar pros outros clientes **um por vez** (Castrioto precisa celulares + Evolution antes).

### Dev local (não vai pra produção)
- Colaborador de teste id 99 "ROBERTO BASTOS RUIVO" CPF 529.982.247-25 celular 12988426869 em `kontrata_dev`; aceite 3.
- `configurations` de dev apontam Evolution → `RECURSOS`; `.env` tem `FRONTEND_URL=http://10.6.1.171:3004`.

## Ainda em aberto
- WhatsApp Tradição: instância `KONTRATAAI` precisa QR. Ver [[tradicao]].
- 🚨 `/api/config/configurations` responde 200 sem login em todos os clientes.
- Atendente Virtual subiu junto, desligado/não testado em produção.
