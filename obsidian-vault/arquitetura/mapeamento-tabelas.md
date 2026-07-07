# Mapeamento de Tabelas (v1 / v2)

**Regra principal:** NUNCA usar nomes de colunas/tabelas Oracle hardcoded no código. O sistema é multi-cliente e cada ERP pode ter nomes diferentes.

## 🎯 Por que existe
Sistema atende clientes com ERPs diferentes ([[oracle-intersolid|Intersolid]], Zanthus, SAP, [[../clientes/nunes|RP INFO]]...). Cada um com nomes de coluna diferentes. O mapeamento resolve na hora da query.

## 🏗️ Arquitetura (3 camadas)

```
1. TABLE_CATALOG (Frontend)           → Define campos na UI
2. erp_templates (PostgreSQL)         → Templates por ERP
3. database_connections (PostgreSQL)  → Mapeamento ativo em runtime
```

## 📐 Versões

### v1 (Clássico)
Organizado por **tipo de dados**:
```json
{
  "produtos": { "codigo_table": "TAB_PRODUTO" },
  "vendas": { ... }
}
```

### v2 (Por Módulos de Negócio - Hierárquico)
Organizado por **módulo/submódulo**:
```json
{
  "version": 2,
  "tabelas": { ... },
  "modulos": {
    "prevencao": {
      "submodulos": {
        "bipagens": ["TAB_PRODUTO", "TAB_PRODUTO_PDV"],
        ...
      }
    }
  }
}
```

## 🧩 Módulos v2

**Prevenção no Radar:**
- Bipagens, PDV, Facial, Rupturas, Etiquetas, Quebras

**Gestão no Radar:**
- [[../modulos/gestao-inteligente|Gestão Inteligente]], Estoque e Margem, [[../modulos/compra-venda|Compra e Venda]], Pedidos, Ruptura Indústria

## 🛠️ Como usar no código

```typescript
// ✅ CORRETO
const schema = await MappingService.getSchema();
const tabela = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
const colCampo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'cod_produto');

// ❌ ERRADO
const query = `SELECT p.COD_PRODUTO FROM INTERSOLID.TAB_PRODUTO p`;
```

## ✅ Checklist ao mexer em query Oracle
- [ ] Campos usam `getColumnFromTable`?
- [ ] Tabelas usam `getRealTableName`?
- [ ] Schema usa `getSchema`?
- [ ] NÃO tem `getColumnFromTable` com 3º parâmetro (fallback — proibido)?
- [ ] Campos existem no `TABLE_CATALOG` (ConfiguracoesTabelas.jsx)?
- [ ] Template INTERSOLID atualizado no banco?

## 📋 Copiar mapeamento pra cliente NOVO (mesmo ERP) — receita
Cliente novo Intersolid nasce com `database_connections.mappings` **vazio** (maplen=0) → queries dão `ORA-00904 invalid identifier`. Como o mapeamento é **por ERP** (Intersolid = igual pra todos), copia de um cliente que funciona:
```bash
# 1. dump do cliente OK (ex Tradição 46, id do database_connections):
docker exec <pg-ok> psql -U postgres -d <db-ok> -t -A -c "SELECT mappings FROM database_connections WHERE id=<ID>" > /root/map.json
# 2. transferir o arquivo pro VPS/cliente novo
# 3. carregar no cliente novo (docker cp + pg_read_file):
docker cp map.json <pg-novo>:/tmp/m.json
docker exec <pg-novo> sh -c 'printf "%s" "$(cat /tmp/m.json)" > /tmp/m2.json'   # tira newline final
docker exec <pg-novo> psql -U postgres -d <db-novo> -c "UPDATE database_connections SET mappings=pg_read_file('/tmp/m2.json'), updated_at=now() WHERE id=<ID-NOVO>;"
# 4. restart backend do cliente novo -> "[MappingService] Mapeamentos carregados do banco"
```
⚠️ PowerShell embola SQL com aspas/parênteses → sempre por **script .sh** scp'd (SQL dentro do arquivo). **Caso real 01/07:** Tradição(46,id14)→supertradicao(31,id1), 21438 chars, resultou em `✅ 4950 vendas encontradas`.

## 🏷️ Tags
#arquitetura #mapeamento #oracle
