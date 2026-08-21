# KM Residência em branco — cota da API de CEP estourada

**Data:** 2026-08-21 (diagnosticado no Tradição)
**Sintoma:** coluna "KM Residência" vazia pra alguns candidatos na triagem da vaga.

## Números reais no Tradição (638 currículos)
| Situação | Qtd |
|---|---|
| OK (KM aparece) | 547 |
| **CEP válido mas geocode falhou** | **70** |
| Sem CEP | 16 |
| CEP inválido (≠ 8 dígitos) | 5 |

Falhas crescendo: mai 1 → jun 9 → jul 35 → ago 25.
As duas lojas TÊM coords — não é problema de cadastro de loja.

## Causa-raiz 1 (70 casos): AwesomeAPI com cota estourada
Testado direto da VPS:
```bash
curl -s https://cep.awesomeapi.com.br/json/12228000
{"status":429,"code":"QuotaExceeded","message":"Quota exceeded..."}
```
**Todos** os CEPs voltam 429. O fallback por CEP está morto.

### O que transforma falha temporária em permanente
`GeocodeService.coordsViaPhoton` e `coordsViaCep` fazem:
```ts
} catch {
  memCache.set(chave, null);  // <-- cacheia a FALHA
  return null;
}
```
`memCache` não tem TTL. Um 429/timeout vira "esse endereço não existe" **pra
sempre**, até o backend reiniciar. E `geo_updated_at` só é gravado no sucesso,
então nem dá pra saber quantas vezes tentou.

⚠️ **Lição geral:** cache negativo sem TTL + `catch` que não distingue "API
recusou" de "endereço não existe" = bug que se auto-perpetua.

## Causa-raiz 2 (16 casos): CEP NÃO é obrigatório no currículo público
`CurriculoPublico.jsx` — o campo CEP não tem asterisco nem `required`. Só
**nome** e **data de nascimento** são obrigatórios (ver aviso na linha ~1705).
Quem acha que CEP é obrigatório está enganado. Os 5 "inválidos" também passam
sem validação de 8 dígitos.

## Correção testada (ainda NÃO implementada)
BrasilAPI substitui a AwesomeAPI, **mas só pelo nome da rua**:

```bash
curl -s https://brasilapi.com.br/api/cep/v2/12228000
# -> street: "Avenida João Rodolfo Castelli", city: "São José dos Campos"
```

🚨 **NÃO usar a coordenada da BrasilAPI**: 4 CEPs diferentes de SJC devolveram
o mesmíssimo `-45.88694` — é centroide de cidade. Usar isso faria todo mundo de
SJC ter a mesma distância.

Caminho certo, validado nos 4 endereços que falhavam:
**CEP → BrasilAPI (nome oficial da rua) → Photon/OSM (coordenada real)**

| Rua devolvida pela BrasilAPI | Photon achou |
|---|---|
| Avenida João Rodolfo Castelli | -23.2446459, -45.8336113 |
| Rua Nalva Paiva da Mata | -23.1697922, -45.8156389 |
| Rua Baependi | -23.1763246, -45.8513913 |
| Rua Joana D'Arc (Jacareí) | -23.299518, -45.9263228 |

Coordenadas distintas e corretas — ao contrário do centroide.

### Checklist da correção
1. Trocar `coordsViaCep` (AwesomeAPI) por BrasilAPI devolvendo **rua**, não coords
2. Alimentar o Photon com a rua oficial em vez da digitada pelo candidato
3. Não cachear falha de rede/429 (só cachear "não encontrado" de verdade)
4. Backfill dos 70 existentes
5. ~~Tornar CEP obrigatório no currículo público~~ — **DECIDIDO EM 21/08/2026:
   NÃO fazer.** O usuário optou por manter opcional. Motivo: são só 16 casos e
   exigir CEP cria atrito no funil de candidatura. Não reabrir sem ele pedir.

## Tags
#bug #geocode #recrutamento #api-externa #cache
