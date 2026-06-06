-- Migra triagens antigas (curriculos.status global) pros 3 arrays JSONB
-- locais da vaga (selecionados, recusados, vagas_futuras).
-- Pra cada interessado da vaga $VAGA_ID que NAO esta em nenhum array local
-- e tem status global de triagem (aprovado/em_analise/recusado/contratado),
-- copia ele pro array correspondente preservando os dados.
-- Idempotente: rodar de novo nao duplica (filtro NOT EXISTS).

BEGIN;

-- 1) status global "em_analise" -> array local vagas_futuras
UPDATE rh_vagas v
SET vagas_futuras = COALESCE(v.vagas_futuras, '[]'::jsonb) || COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'curriculo_id', c.id,
    'nome', c.nome,
    'whatsapp', c.whatsapp,
    'email', c.email,
    'cidade', c.cidade,
    'created_at', c.created_at,
    'adicionado_em', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ))
  FROM curriculos c
  WHERE c.vagas_interesse_ids @> jsonb_build_array(v.id)
    AND c.status = 'em_analise'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.selecionados,'[]'::jsonb)) s WHERE (s->>'curriculo_id')::int = c.id)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.recusados,'[]'::jsonb))   r WHERE (r->>'curriculo_id')::int = c.id)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.vagas_futuras,'[]'::jsonb)) f WHERE (f->>'curriculo_id')::int = c.id)
), '[]'::jsonb)
WHERE v.id = :vaga_id;

-- 2) status global "aprovado" ou "selecionado" -> array local selecionados
UPDATE rh_vagas v
SET selecionados = COALESCE(v.selecionados, '[]'::jsonb) || COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'curriculo_id', c.id,
    'nome', c.nome,
    'whatsapp', c.whatsapp,
    'email', c.email,
    'cidade', c.cidade,
    'created_at', c.created_at,
    'adicionado_em', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'contratado', false
  ))
  FROM curriculos c
  WHERE c.vagas_interesse_ids @> jsonb_build_array(v.id)
    AND c.status IN ('aprovado','selecionado')
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.selecionados,'[]'::jsonb)) s WHERE (s->>'curriculo_id')::int = c.id)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.recusados,'[]'::jsonb))   r WHERE (r->>'curriculo_id')::int = c.id)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.vagas_futuras,'[]'::jsonb)) f WHERE (f->>'curriculo_id')::int = c.id)
), '[]'::jsonb)
WHERE v.id = :vaga_id;

-- 3) status global "recusado" ou "reprovado" -> array local recusados
UPDATE rh_vagas v
SET recusados = COALESCE(v.recusados, '[]'::jsonb) || COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'curriculo_id', c.id,
    'nome', c.nome,
    'whatsapp', c.whatsapp,
    'email', c.email,
    'cidade', c.cidade,
    'created_at', c.created_at,
    'adicionado_em', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ))
  FROM curriculos c
  WHERE c.vagas_interesse_ids @> jsonb_build_array(v.id)
    AND c.status IN ('recusado','reprovado')
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.selecionados,'[]'::jsonb)) s WHERE (s->>'curriculo_id')::int = c.id)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.recusados,'[]'::jsonb))   r WHERE (r->>'curriculo_id')::int = c.id)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.vagas_futuras,'[]'::jsonb)) f WHERE (f->>'curriculo_id')::int = c.id)
), '[]'::jsonb)
WHERE v.id = :vaga_id;

COMMIT;
