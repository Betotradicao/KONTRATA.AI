# Documentação Padronizada não replicava no colaborador novo (2 bugs)

**Data:** 06/08/2026 · **Módulo:** [[../modulos/rh|RH]] · **Cliente que reportou:** [[../clientes/tradicao|Tradição]]

## Sintoma
Colaboradores novos apareciam na tela **Colaboradores → Documentação** com
*"Nenhuma pasta criada ainda"*, mesmo com as 9 pastas padrão configuradas em
**Configurações RH → Documentação Padronizada**.

## Causa-raiz 1 — a Ficha de Admissão nunca replicava o template
Existem **DOIS** caminhos que criam colaborador, e só um replicava:

| Caminho | Controller | Replicava? |
|---|---|---|
| Cadastro Geral (manual) | `rh.controller.ts` → `createColaborador` | ✅ sim (inline) |
| Ficha de Admissão → "virar colaborador" | `rh-fichas-admissao.controller.ts` → `criarColaborador` | ❌ **não** |

Dá pra identificar a origem pela **matrícula**: quem veio da ficha tem `FICHA-<id>`
(gerada no próprio INSERT). Foi assim que o bug foi confirmado — os colaboradores
sem pasta eram todos `FICHA-*`.

**Fix:** código extraído pra `services/doc-template.service.ts` →
`replicarTemplateNoColaborador(colaboradorId)`, chamado pelos **dois** caminhos.
Ficar inline no controller é o que permitiu a divergência existir.

## Causa-raiz 2 — `ON CONFLICT` sem constraint + catch engolindo (o pior)
O bloco inline usava:

```sql
INSERT INTO rh_documento_subpastas (pasta_id, nome, ordem, obrigatorio)
VALUES ($1,$2,$3,$4) ON CONFLICT (pasta_id, nome) DO NOTHING
```

⚠️ **`rh_documento_subpastas` NÃO tem UNIQUE em (pasta_id, nome).** O Postgres
estoura `there is no unique or exclusion constraint matching the ON CONFLICT
specification` → o erro caía num `catch` que só fazia `console.warn` → **nenhuma
subpasta obrigatória era criada, nem pelo Cadastro Geral**. As 9 pastas apareciam
(essas têm UNIQUE), as 10 subpastas de DOCS CONTRATAÇÃO não — e ninguém percebia,
porque a criação do colaborador retornava 201 normalmente.

**Fix:** anti-duplicata por `WHERE NOT EXISTS (... UPPER(nome) = UPPER($n))`, o
mesmo padrão que o `sincronizarTudo` do `RhDocTemplateController` já usava — **é
exatamente por isso que o botão "🔄 Sincronizar tudo nos colaboradores" sempre
funcionou e a criação automática não.** Deixou de ser `ON CONFLICT` de propósito:
criar a UNIQUE por migration correria o risco de falhar em produção se já houver
duplicata histórica.

Também separado o `try` por subpasta — antes uma subpasta ruim matava as demais
da mesma pasta.

## Lições
- **`ON CONFLICT (a,b)` exige UNIQUE/EXCLUSION em (a,b).** Sem ela não é no-op:
  é exceção em runtime.
- **`catch` + `console.warn` em caminho de escrita esconde bug por meses.** O
  sintoma só aparece muito depois, numa tela que ninguém liga ao cadastro.
- **Duas rotas de criação da mesma entidade = divergência garantida.** Se um
  efeito colateral precisa valer sempre, ele vira service compartilhado.

## Remediação dos que já estão sem pasta
Botão **🔄 Sincronizar tudo nos colaboradores** (Configurações RH → Documentação
Padronizada). Idempotente, cria só o que falta, e **só nos colaboradores `ativo`**.

## Arquivos
- `packages/backend/src/services/doc-template.service.ts` (novo)
- `packages/backend/src/controllers/rh.controller.ts`
- `packages/backend/src/controllers/rh-fichas-admissao.controller.ts`

## 🏷️ Tags
#bug #rh #documentacao #postgres #causa-raiz
