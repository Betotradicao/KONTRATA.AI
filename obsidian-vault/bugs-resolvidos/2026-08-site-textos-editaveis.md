# Site comercial com textos editáveis pelo painel

**Data:** 2026-08-25
**Onde:** `packages/site` (site + painel `/admin`) e `packages/admin-api`

O conteúdo de kontrataai.com.br saiu do código e passou a viver no banco.
Padrão copiado do **Pegue e Monte** (`/d/pegue-e-monte-site/server/schema.sql`),
que resolve isso com uma linha só:

```sql
create table config (
  id int primary key default 1 check (id = 1),
  dados jsonb not null default '{}'::jsonb
);
```

Aqui virou `site_config`, idêntico. Uma linha, tudo em jsonb.

## 🔑 A regra que vale pro site inteiro

**O texto do código é o padrão. O banco só SOBRESCREVE o que estiver
preenchido.** Não é detalhe de implementação, é o que faz o desenho funcionar:

- API fora do ar / tabela vazia → o site aparece inteiro, com o texto original.
  Nunca existe estado "site em branco".
- Quem edita não precisa preencher tudo pra trocar uma frase.
- **Apagar o campo no painel é o jeito de voltar ao original** — não precisa de
  botão "restaurar padrão".

Implementado em `packages/site/src/textos.jsx`: `useTextos(secao)` devolve
`t(chave, padrao)` e `lista(chave, padraoArray)`. Só conta como sobrescrita
string com conteúdo de verdade (`trim() !== ''`).

O `TextosProvider` renderiza os filhos na PRIMEIRA pintura, sem esperar o
fetch. Segurar a página transformaria lentidão da API em tela branca.

## Por que grava uma seção por vez

`PUT /api/site-config/:secao` mescla com `jsonb_set(dados, ARRAY[$1], ...)`.
Se cada tela mandasse o objeto inteiro, salvar o hero apagaria o resto assim
que duas abas ficassem abertas ao mesmo tempo.

É **upsert**, não UPDATE: com `UPDATE ... WHERE id = 1` numa base sem a linha 1,
zero linhas seriam afetadas e a tela diria "salvo" sem ter salvado nada.

## Pra expor um texto novo: UMA linha

Acrescente a chave na lista `SECOES` de
`packages/site/src/admin/abas/SiteTextos.jsx` e use `t('chave', 'padrão')` na
seção. **Sem migration por frase** — foi o ponto todo de usar jsonb.

Seções expostas: menu do topo, hero, números, dor, solução, como funciona,
comparativo, origem, chamada final, FAQ e rodapé — o site inteiro.

**Listas com mais de uma coluna** (a tabela do Comparativo) usam `|` como
separador, uma linha por item: `Critério | RH Genérico | Kontrataai`. Linha
torta é ignorada em vez de quebrar a seção.

**Pares** (as perguntas do FAQ) viram `p1`/`r1` … `pN`/`rN`, com mais vagas do
que a lista padrão pra dar pra acrescentar sem mexer no código. O par só
aparece com os dois campos preenchidos — apagar a pergunta some com o item
inteiro, em vez de deixar um título vazio abrindo uma resposta órfã.

## O que ficou de fora de propósito

- **Ícones e numeração** (o `01`..`04` de Como Funciona, os ícones dos cards da
  Solução) continuam no código. Trocar texto não pode desalinhar o número
  gigante do card com o passo que ele numera.
- **Título de Origem**: o padrão tem quebras de linha feitas à mão pro celular.
  Se o painel mandar título próprio não dá pra adivinhar onde quebrar — aí vale
  o mesmo texto nas duas larguras e o navegador quebra sozinho.

## Planos mudou de lugar

Saiu do menu principal e entrou no grupo **Configurar Site**, junto com Textos.
É conteúdo do site tanto quanto o resto — não faz sentido editar preço num
canto e a frase acima do preço em outro.

## 🚨 Deploy do site: use `packages/site/publicar.sh`

O site é **estático**, servido direto pelo nginx de `/var/www/kontrata-site` —
não tem container. Publicar na mão deu **tela branca** em 25/08/2026, por dois
motivos que não aparecem em nenhum log de build:

**1. `scp` entrega o arquivo sem leitura pro `www-data`.** nginx responde 403 no
JS e no CSS, o HTML carrega sozinho e o `<div id="root">` fica vazio. A tela
fica branca **sem nenhum erro de JS** — parece bug de código, é permissão.
Diagnóstico em 5 segundos: `tail /var/log/nginx/error.log` → *"Permission
denied"*. Sempre `chown -R www-data:www-data` + `chmod -R a+rX` depois de subir.

**2. O hash do Vite faz o build velho acumular.** `index-ABC.js` não é
sobrescrito por `index-XYZ.js`; os dois ficam lá. Some `assets/` antes de
copiar.

O script faz os dois e ainda confere os códigos HTTP no fim — inclusive do JS e
do CSS que o `index.html` recém-publicado referencia, que é a checagem que pega
esse caso (o `/` responde 200 mesmo com a página quebrada).

### admin-api
O `/root/kontrata-repo` da VPS tem working copy suja e `packages/admin-api/`
untracked, então `git pull` aborta ali. Pra mexer no admin-api: `scp` do
arquivo pra `/root/kontrata-repo/packages/admin-api/src/` + `docker compose
build --no-cache api` em `/root/kontrata-admin` (é de lá que vem o build
context).

## Tags
#feature #site #white-label #jsonb #admin-api #kontrataai
