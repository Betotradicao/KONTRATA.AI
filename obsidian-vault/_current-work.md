# Trabalho atual

## ✅ Concluído e no ar: textos do site editáveis pelo painel

`/admin` → grupo **Configurar Site** → **Textos** e **Planos**.
8 seções editáveis. Campo vazio = texto do código.
Detalhes e armadilhas: [[2026-08-site-textos-editaveis]]

Testado em produção: gravou → apareceu em `/admin/api/publico/site` → limpou.

## Commit local, ainda SEM push

`fd26f06` — o deploy foi feito por scp (site estático + rebuild do admin-api).
Falta `git push` quando o usuário validar.

## Pendências conhecidas

- 🚨 **CRÍTICO, não autorizado:** `https://<cliente>.kontrataai.com.br/api/config/configurations`
  responde 200 SEM login, com todas as senhas. Aguardando o usuário liberar.
- Tabela comparativa do site está vazia (`CRITERIOS = []`) — falta o conteúdo.
- Mameva sem logo (o sistema dele está zerado).
- Asaas no Financeiro; provisionamento self-service do teste grátis
  (precisa de DNS curinga `*.kontrataai.com.br`, que não existe).
