---
tags: [migracao, recrutamento, curriculo, novacentral, prevencao-radar]
data: 2026-06-11
---

# Migrar recrutamento (currículos + triagem) do prevencao-radar → kontrata.ai

Cliente que ainda **tria currículo no sistema antigo** (prevencao-radar) e quer migrar pro kontrata. Feito no **NovaCentral** em 11/06/2026 (333 currículos).

## Achados que tornam viável
- Os dois rodam na **mesma VPS** (vps2-hostinger). Containers: `prevencao-<cliente>-postgres` (db `postgres_<cliente>`) e `kontrata-<cliente>-postgres` (db `kontrata_<cliente>`).
- A tabela **`curriculos` tem colunas IDÊNTICAS** nos dois (kontrata nasceu do prevencao). E `curriculos` **não tem FK de saída** → dá pra substituir à vontade (as tabelas que referenciam — rh_disc_resultados, rh_recrutador_entrevistas — costumam estar vazias; conferir).
- Os **ids das vagas COINCIDEM** entre os dois (kontrata foi seedado do prevencao). Por isso `curriculos.vagas_interesse_ids` (ids de vaga) continua válido após espelhar.

## Os dois modelos de triagem
- **prevencao**: status NO currículo (`curriculos.status`: novo/aprovado/reprovado/contratado/em_analise) + `vagas_interesse_ids` ligando candidato→vaga. `rh_vagas` só tem `selecionados`.
- **kontrata**: tela **Banco de Currículos** lê de `curriculos.status` (aprovado=Selecionado, em_analise=Vagas Futuras). Tela **Vagas** lê dos **arrays JSONB** da vaga (`selecionados`/`recusados`/`vagas_futuras`) — `listarVagas` deriva o status_local de cada candidato desses arrays; `interessados` = curriculos com `vagas_interesse_ids @> [v.id]`.

## Receita da migração (espelho fiel, com backup)
1. **Backup**: `CREATE TABLE curriculos_bkp_espelho AS SELECT * FROM curriculos;` (idem rh_vagas).
2. **Espelhar currículos**: `DELETE FROM curriculos;` no kontrata, depois
   `docker exec prevencao-... pg_dump --data-only --table=public.curriculos | docker exec -i kontrata-... psql` (schema idêntico → COPY direto; pg_dump já ajusta a sequence via setval).
3. **Régua de cargos** nos currículos espelhados: normalizar pros nomes do **cadastro ATIVO do kontrata daquele cliente** (cada cliente varia! ver [[2026-06-feature-cargos-tipos-fonte-oficial]]). Órfãos → `experiencia_texto`.
4. **Reconstruir os arrays de triagem das vagas** a partir do status (os ids de vaga coincidem):
   ```sql
   UPDATE rh_vagas v SET
     selecionados = (SELECT jsonb_agg(jsonb_build_object('curriculo_id',c.id,'nome',c.nome,'whatsapp',c.whatsapp,'email',c.email,'cidade',c.cidade,'created_at',c.created_at,'adicionado_em',now(),'contratado',(c.status='contratado')))
        FROM curriculos c WHERE c.vagas_interesse_ids @> jsonb_build_array(v.id) AND c.status IN ('aprovado','contratado')),
     recusados = (... c.status='reprovado' ...),
     vagas_futuras = (... c.status='em_analise' ...);
   ```
   (usar `COALESCE(..., '[]'::jsonb)`; o containment `@> jsonb_build_array(v.id)` é o mesmo padrão do listarVagas).

## Resultado NovaCentral
Banco: TOTAL 333, NOVO 262, SELECIONADO 45, CONTRATADO 5, VAGAS FUTURAS 4, RECUSADO 17 — idêntico ao prevencao.
Vagas: Selecionados 11, Contratados 2, Recusados 3, Vagas Futuras 3 — idêntico.

## Cuidado importante (lição)
A tela **Banco** e a tela **Vagas** contam DIFERENTE (Banco = status global do currículo; Vagas = por-vaga via arrays, só candidatos linkados a vaga). Por isso os números das duas telas não são iguais entre si — e isso é normal. Para "ficar igual ao prevencao" tem que bater CADA tela com a tela correspondente do prevencao.

## Backups deixados no banco (NovaCentral kontrata)
`curriculos_bkp_espelho`, `rh_vagas_bkp_espelho`, `rh_vagas_arrays_bkp`, `curriculos_backup_cargos` (da régua anterior). Remover quando o cliente confirmar tudo certo.
