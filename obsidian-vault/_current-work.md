# Trabalho atual

## ✅ Concluído e no ar: textos do site editáveis pelo painel

`/admin` → grupo **Configurar Site** → **Textos** e **Planos**.
As 11 seções do site editáveis. Campo vazio = texto do código.
Detalhes e armadilhas: [[2026-08-site-textos-editaveis]]

Testado em produção: gravou → apareceu em `/admin/api/publico/site` → limpou.

⚠️ **Publicar o site só com `packages/site/publicar.sh`.** Subir por scp na mão
dá tela branca (403 por permissão). Está explicado na nota.

## Também nesta sessão

- Vitrine de clientes na faixa roxa (6 logos, ordem definida no painel)
- Redes sociais editáveis, só as preenchidas vão pro site
- 🐛 Integrações apagava a chave secreta ao salvar em branco:
  [[2026-08-25-integracoes-segredo-apagado]]

## Commits locais, ainda SEM push

13 commits desde `1203da0`. O deploy foi por scp (site estático) e rebuild do
admin-api. Falta `git push` quando o usuário validar.

## Pendências conhecidas

- 🚨 **CRÍTICO, não autorizado:** `https://<cliente>.kontrataai.com.br/api/config/configurations`
  responde 200 SEM login, com todas as senhas. Aguardando o usuário liberar.
- Tabela comparativa do site está vazia (`CRITERIOS = []`) — falta o conteúdo.
- Mameva sem logo (o sistema dele está zerado).
- Asaas no Financeiro; provisionamento self-service do teste grátis
  (precisa de DNS curinga `*.kontrataai.com.br`, que não existe).
