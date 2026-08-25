# Trabalho atual

## ✅ Concluído e no ar: textos do site editáveis pelo painel

`/admin` → grupo **Configurar Site** → **Textos** e **Planos**.
As 11 seções do site editáveis. Campo vazio = texto do código.
Detalhes e armadilhas: [[2026-08-site-textos-editaveis]]

Testado em produção: gravou → apareceu em `/admin/api/publico/site` → limpou.

⚠️ **Publicar o site só com `packages/site/publicar.sh`.** Subir por scp na mão
dá tela branca (403 por permissão). Está explicado na nota.

## Commits locais, ainda SEM push

`fd26f06`, `1d69c5b`, `1c3b474` — o deploy foi por scp (site estático) e
rebuild do admin-api. Falta `git push` quando o usuário validar.

## Pendências conhecidas

- 🚨 **CRÍTICO, não autorizado:** `https://<cliente>.kontrataai.com.br/api/config/configurations`
  responde 200 SEM login, com todas as senhas. Aguardando o usuário liberar.
- Tabela comparativa do site está vazia (`CRITERIOS = []`) — falta o conteúdo.
- Mameva sem logo (o sistema dele está zerado).
- Asaas no Financeiro; provisionamento self-service do teste grátis
  (precisa de DNS curinga `*.kontrataai.com.br`, que não existe).
