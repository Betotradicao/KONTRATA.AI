# Painel interno do Kontrata — kontrataai.com.br/admin

**Data:** 2026-08-23
**Código:** `packages/admin-api` (backend) + `packages/site/src/admin` (telas)

Gestão da PRÓPRIA Kontrata: clientes, prospecção, financeiro, treinamentos,
integrações, planos e usuários. Não confundir com `packages/backend`, que é o
RH multi-tenant dos clientes.

## Onde roda na VPS 46
- Stack: `/root/kontrata-admin` (docker-compose com `api` + `postgres`)
- Containers: `kontrata-admin-api` (porta 3020) e `kontrata-admin-postgres` (5442)
- Segredos: `/root/kontrata-admin/.env`, **gerados na VPS** com `openssl rand`
- nginx: `/admin/api/` → `127.0.0.1:3020/api/` (bloco ANTES do `location /`,
  senão o `try_files` engole e devolve o index.html)

Deploy do backend: `cd /root/kontrata-admin && docker compose up -d --build api`
Deploy das telas: build do `packages/site` → tar do `dist` → `/var/www/kontrata-site`

## 🔐 Dois tokens, MESMO segredo — a trava que não pode sumir
O token da equipe e o token da área de treinamento são assinados com a mesma
chave. Sem a checagem abaixo em `auth.js`, **o token que vai pra qualquer
cliente abriria o painel interno inteiro**:
```js
if (dados.escopo === 'treinamento') return res.status(403)...
```

## Regras de senha
- Contas nascem com senha temporária + `precisa_trocar_senha = true`
- `scripts/criar-usuario.js` gera a senha; `scripts/definir-senha.js` aceita uma
  via **variável de ambiente** (nunca por argumento: apareceria no `ps` e no
  histórico do shell)
- Usuário **master** (`usuarios.master`) é quem cria/remove os outros
- Login é por **usuário**, não e-mail. `lower(usuario)` no índice único

## 🪤 Armadilhas que já custaram tempo
1. **`query()` devolve `{rows}`, não array.** `const [x] = await query(...)`
   deixa `x` undefined e a rota responde 404 em silêncio. Mordeu na rota
   `/financeiro/marcar`. Sempre `const { rows } = await query(...)`.
2. **Logo do cliente é `data:image;base64`, não link.** Vem de
   `configurations.client_logo_url` (tela Configurações de REDE >
   Personalização). Grudar domínio na frente gera lixo.
3. **Não passar base64 por `psql -c "...$VALOR..."`** — 243 KB numa linha de
   comando é truncado sem erro: o UPDATE "roda" e não grava. Usar arquivo/stdin.
   Ver `scripts/sincronizar-logos.sh`.
4. **Datas: montar por pedaços**, nunca `new Date('2026-08-23')` — é lido como
   UTC e volta um dia no nosso fuso.

## Decisões de modelagem (e o porquê)
| Decisão | Motivo |
|---|---|
| Ativos e prospecção na MESMA tabela (`situacao`) | prospect que fecha vira cliente sem perder histórico |
| "Atrasado" é **calculado**, não gravado | status gravado exigiria rotina diária; o dia que ela falhar a tela mente |
| "Dias restantes de teste" calculado | número gravado envelhece sozinho |
| Preço do plano **copiado** pra ficha do cliente | reajuste na tabela não pode alterar contrato de quem já é cliente |
| Desconto em **R$** (era %) | pedido do usuário em 23/08 |
| Mês anterior à `data_inicio` fica vazio na grade | "A vencer" em janeiro pra quem entrou em julho sugere dívida inexistente |

## Integração com o site (sem deploy)
- `GET /api/publico/planos` → seção de preços de kontrataai.com.br
- `GET /api/publico/treinamentos` → vídeos de /treinamento
- `POST /api/publico/treinamento/login` → usuário/senha do cliente

Ambas as telas do site têm **lista de reserva** no código: se a API cair, a
página não aparece vazia na frente de um cliente.

## Sincronizar logos dos clientes
```bash
bash /root/kontrata-admin/sincronizar-logos.sh
```
Lê o `client_logo_url` do banco de cada cliente (todos na mesma VPS) e grava em
`clientes.logo_url`. Rodar quando alguém subir logo novo.

## ⚠️ Cuidado com a lixeira da lista de clientes
Em 23/08 o usuário apagou 4 clientes tentando "tirar de ativos". O certo é
Editar → mudar situação. Confirmado pelo log do nginx (4 DELETE do navegador
dele). Vale considerar trocar o excluir por um "arquivar".

## Tags
#painel-interno #kontrata #admin #asaas #seguranca
