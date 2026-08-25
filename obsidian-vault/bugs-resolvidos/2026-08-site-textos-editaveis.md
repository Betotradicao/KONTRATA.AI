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

Seções já expostas: hero, números, dor, solução, como funciona, origem,
chamada final, rodapé.

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

## Deploy (é diferente do resto)

O site é **estático**, servido direto pelo nginx — não tem container:
1. `npx vite build` em `packages/site`
2. `scp -r dist/* vps2-hostinger:/var/www/kontrata-site/`

O `/root/kontrata-repo` da VPS tem working copy suja e `packages/admin-api/`
untracked, então `git pull` aborta ali. Pra mexer no admin-api: `scp` do
arquivo + `docker compose build --no-cache api` em `/root/kontrata-admin`.

## Tags
#feature #site #white-label #jsonb #admin-api #kontrataai
