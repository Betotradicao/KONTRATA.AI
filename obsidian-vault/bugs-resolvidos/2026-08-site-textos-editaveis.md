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

## Prévia ao vivo (padrão Pegue e Monte)

Formulário à esquerda, o site à direita mudando a cada tecla. A prévia é um
**`<iframe>` do próprio site** em `?preview=1`, recebendo o rascunho por
`postMessage`.

**Por que iframe e não re-renderizar as seções dentro do painel:** o site tem
cabeçalho `fixed`, animação disparada por rolagem (`IntersectionObserver`) e
largura de tela cheia. Dentro de uma `<div>` do painel nada disso se comporta
igual — e **prévia que mente é pior que prévia nenhuma**.

Detalhe que custa um bug se esquecer: o painel precisa esperar o iframe avisar
que carregou. A primeira leva de rascunho sai antes de existir alguém
escutando, e a prévia abriria com o texto do banco em vez do que está na tela.
Por isso a prévia manda `{pronto:true}` ao montar e o painel reenvia.

O modo prévia fica atrás de `?preview=1` pra o site de verdade não ficar
escutando `message` de origem nenhuma. E o Google Analytics ignora
`?preview=1` e `/admin` — senão a gente inflaria o número de acessos medindo o
próprio trabalho.

## 🔑 A regra que vale pro site inteiro

**O texto do código é o padrão. O banco só SOBRESCREVE o que estiver
preenchido.** Não é detalhe de implementação, é o que faz o desenho funcionar:

- API fora do ar / tabela vazia → o site aparece inteiro, com o texto original.
  Nunca existe estado "site em branco".
- Quem edita não precisa preencher tudo pra trocar uma frase.
- **Apagar o campo no painel é o jeito de voltar ao original** — não precisa de
  botão "restaurar padrão".

Implementado em `packages/site/src/textos.jsx`: `useTextos(secao)` devolve
`t(chave)`, `lista(chave)` e `ehPadrao(chave)`. Só conta como sobrescrita
string com conteúdo de verdade (`trim() !== ''`).

⚠️ **`conteudoPadrao.js` é FONTE ÚNICA do texto.** O padrão já esteve embutido
em cada `t('chave', 'texto…')` da seção — e aí o painel precisaria repetir tudo
pra pré-preencher os campos. Duas cópias que desandam na primeira edição, com o
painel mostrando uma frase e o site outra. Se for acrescentar texto, é lá.

`ehPadrao()` existe pros títulos que vêm quebrados à mão pro celular (Origem,
Comparativo, FAQ): a quebra manual só vale enquanto ninguém editou o título.
Editado, não dá pra adivinhar onde quebrar — aí vale o mesmo texto nas duas
larguras e o navegador quebra sozinho.

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

## Vitrine de clientes (faixa roxa, ao lado dos números)

`clientes.no_site` decide quem aparece — escolha **por cliente**, com
interruptor no cadastro. Não é "todo mundo que está ativo": nem todo cliente
quer virar peça de propaganda, e descobrir isso depois de publicar é caro.

⚠️ **O logo não viaja no JSON da lista.** Está guardado como data URI de até
250 KB (o Da Mata tem 243 KB) — quatro deles na mesma resposta fariam a home
baixar quase 1 MB antes de desenhar qualquer coisa. `GET
/api/publico/clientes` devolve só `{id, nome}`, e
`/api/publico/clientes/:id/logo` decodifica o base64 de volta pra imagem, com
`Cache-Control: max-age=86400`. O navegador baixa em paralelo e uma vez só.

Esse endpoint também respeita o `no_site`: cliente não marcado dá 404, senão
bastaria adivinhar um id pra puxar o logo de qualquer um.

### 🪤 `useRef` + IntersectionObserver em coisa que só existe depois do fetch

Os logos vinham no HTML e **nunca apareciam** — `opacity-0` pra sempre, sem
erro nenhum no console. O hook de "entrou na tela" recebia um `useRef` e rodava
o efeito na montagem, quando a faixa de logos ainda não existia (a lista só
chega da API depois). Achava `ref.current === null`, desistia — e como **a
identidade do objeto ref nunca muda**, o efeito nunca rodava de novo.

Conserto: **ref de callback**. O React chama a função quando o elemento nasce,
o `useState` guarda o nó e o efeito reage a isso.

```jsx
const [elemento, setElemento] = useState(null);
useEffect(() => { if (!elemento) return; /* observa */ }, [elemento]);
return [setElemento, entrou];   // <div ref={setElemento}>
```

Vale pra qualquer animação de entrada em lista carregada por fetch. Se o
elemento não existe no primeiro render, `useRef` não serve.

## O que ficou de fora de propósito

- **Ícones e numeração** (o `01`..`04` de Como Funciona, os ícones dos cards da
  Solução) continuam no código — viraram `NUMEROS` e `ICONES`, listas só com
  isso. Trocar texto não pode desalinhar o número gigante do card com o passo
  que ele numera.

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
