# Salvar campo secreto em branco APAGAVA a chave

**Data:** 2026-08-25
**Onde:** painel interno — `/admin` → Integrações (`packages/admin-api`, `packages/site/src/admin/abas/Integracoes.jsx`)

## O bug

A tela dizia, no lugar certo e com todas as letras:
`•••••••• (deixe em branco para manter)`

E o `PUT /api/integracoes/:chave` **gravava o vazio por cima**. Quem clicasse
em Salvar sem redigitar perdia a chave da Evolution — e o botão respondia
**"Salvo!"**. Nenhum erro, nenhum aviso.

Combinação que torna esse tipo de bug caro: a tela promete uma coisa, o backend
faz outra, e o feedback de sucesso confirma a promessa. Só se descobre quando o
disparo para de funcionar, dias depois, longe da causa.

**Conserto:** campo `secreto` com valor vazio E chave já preenchida no banco =
não grava nada, devolve `{ok:true, mantido:true}`.

## Olhinho pra ver o segredo (só master)

"Guardei e nunca mais vejo" tem um efeito colateral previsível: a pessoa anota
a chave num papel, num bloco de notas, num WhatsApp pra si mesma. Isso é **pior**
que deixar quem já administra o painel conferir o que ele mesmo digitou.

`GET /api/integracoes/:chave/revelar` — 403 pra quem não é master.

## Botão de disparo de teste

"Salvei os três campos" e "o disparo funciona" são coisas diferentes. Instância
errada, chave vencida e URL apontando pro `/manager` **salvam igualzinho** e só
aparecem na hora de mandar. `POST /api/integracoes/testar-whatsapp`.

Mesma armadilha do Atendente Virtual: a URL que a pessoa tem na mão pra copiar é
a do painel visual da Evolution, terminada em `/manager` — que é a interface,
não a API. Aqui também é tirada sozinha. Ver [[2026-08-25-atendente-virtual-whatsapp]].

## 🪤 Erro de API não vai cru pra tela

A Evolution responde erro como objeto aninhado. Devolvido cru, a pessoa vê

```json
{"jid":"5512999999999@s.whatsapp.net","exists":false}
```

e não tem o que fazer com isso. `explicarErro()` mapeia cada caso pra uma frase
que aponta a causa: número sem WhatsApp, chave recusada (401/403), instância
não encontrada (404).

Vale como regra geral no painel: **erro de serviço externo se traduz antes de
chegar na tela.**

## Tags
#bug #painel-interno #integracoes #whatsapp #evolution #seguranca
