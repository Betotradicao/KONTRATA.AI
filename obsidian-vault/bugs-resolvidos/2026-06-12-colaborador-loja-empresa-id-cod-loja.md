---
tags: [rh, mapeamento, postgres, loja]
data: 2026-06-12
modulo: RH
---

# Vínculo colaborador → loja é via `empresa_id = rh_empresas.cod_loja`

## Sintoma
Relatório ASO no WhatsApp mostrava **todo mundo como "Sem loja"**.

## Causa-raiz (convenção não-óbvia)
Para descobrir a **loja de um colaborador** (`rh_colaboradores`), o join correto é:

```sql
LEFT JOIN rh_empresas e ON e.cod_loja = c.empresa_id
-- nome da loja:
COALESCE(e.apelido, e.nome_fantasia, 'Loja ' || e.cod_loja::text, 'Sem loja')
```

### Pegadinhas que custam tempo:
- `rh_colaboradores.empresa_id` é **INT** e guarda o **`cod_loja`** (NÃO o PK da empresa).
- `rh_empresas.id` é **UUID** → juntar `e.id = c.empresa_id` dá `operator does not exist: uuid = integer`.
- A tabela `companies` (com `company_id`) é **tenant/auth**, NÃO é loja: seus campos `apelido/nome_fantasia/cod_loja` ficam nulos → resulta em "Sem loja" pra todos. O `rh-aso.controller.ts` usa esse join errado (`companies/company_id`) — se for mexer no Controle de ASO, provavelmente tem o mesmo bug latente.
- O serviço **Vagas em Aberto** já fazia certo: junta por `cod_loja` (`rh_empresas e ON e.cod_loja = v.cod_loja`). Usar ele como referência.

## Fonte de verdade
- Campos de loja (apelido, nome_fantasia, cod_loja) vivem em **`rh_empresas`**.
- Colaboradores sem `empresa_id` caem legitimamente em "Sem loja".

## Onde foi aplicado
`packages/backend/src/services/aso-whats.service.ts` → `getRelatorio()`.
