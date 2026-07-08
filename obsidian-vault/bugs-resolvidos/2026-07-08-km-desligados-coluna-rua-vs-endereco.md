---
tags: [bug, rh, geocode, km, indicadores]
data: 2026-07-08
modulo: RH / Indicadores
---

# KM da Loja dos desligados vinha sempre "—" (coluna `rua` vs `endereco`)

## Sintoma
Na tela **Indicadores RH → Colaboradores → Desligamentos (Ranking)**, a coluna
**"Km da Loja"** aparecia "—" para **todos** os desligados, mesmo com CEP preenchido.
Recarregar não resolvia (o self-heal nunca completava).

## Causa-raiz
`GeocodeService.warmInBackground` (geocode.service.ts) geocoda 3 tabelas com o
**mesmo SELECT** hardcoded:
```sql
SELECT <chave> AS chave, cep, rua, cidade, estado FROM <tabela> ...
```
Mas a coluna de logradouro **difere por tabela**:
- `curriculos` → `rua` ✓
- `rh_empresas` → `rua` ✓
- `rh_colaboradores` → **`endereco`** (NÃO existe `rua`) ✗

Resultado: no lote de colaborador o SELECT estourava (`column "rua" does not exist`).
O `try { ... } catch { continue; }` **engolia o erro em silêncio** → o lote inteiro
era pulado → colaborador **nunca geocodado** → `latitude/longitude` ficavam null →
`kmDesligados` cai no `else` e devolve `km_residencia: null` → "—".
Nem o fallback por CEP (`coordsViaCep`) era tentado, porque o erro era na query, não no geocode.

## Fix
Aliasar a coluna certa por lote (em `warmInBackground`):
```js
{ tipo: 'colaborador', tabela: 'rh_colaboradores', chaveCol: 'id', ruaCol: 'endereco', ... }
// SELECT <chave> AS chave, cep, <ruaCol> AS rua, cidade, estado FROM <tabela>
```

## Lições
- **`catch {}` silencioso mascara bug de schema.** Um erro de "coluna não existe" ficou
  invisível por commits. Ao escrever SQL dinâmico sobre várias tabelas, os nomes de coluna
  têm que ser **parametrizados por tabela**, nunca assumidos iguais.
- **Convenção de endereço não é uniforme no schema:** `rh_colaboradores` usa `endereco`,
  enquanto `curriculos`/`rh_empresas` usam `rua`. Ver [[modulos/rh]].
- Pós-deploy o KM é **self-heal**: a 1ª chamada `/rh/colaboradores/km` dispara o geocode
  em background (Photon/OSM + fallback AwesomeAPI por CEP); aparece nos refreshes seguintes.
  O front já refaz o fetch após 5s, mas geocodar N pessoas leva tempo → alguns só aparecem
  em recargas posteriores. Depende de `rh_empresas` (loja) e do colaborador terem CEP.
