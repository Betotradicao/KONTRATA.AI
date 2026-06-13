---
tags: [rh, recrutamento, geocoding, feature, arquitetura]
data: 2026-06-12
modulo: RH / Recrutamento
---

# Feature: coluna "KM Residência" em Vagas (distância candidato → loja)

Na lista de candidatos de uma vaga (RhVagas), coluna **📍 KM Residência** entre Nome e WhatsApp, mostrando a distância **em linha reta** da casa do candidato até a **loja daquela vaga**.

## Decisões técnicas (WHY)
- **Geocoding street-first via Photon/OSM** (`https://photon.komoot.io/api/?q=RUA, CIDADE, ESTADO, Brasil`): fonte PRIMÁRIA, grátis, sem chave. Filtra o resultado pela **cidade** (`countrycode=BR` + `properties.city` bate) pra não pegar rua de mesmo nome em outra cidade.
- **AwesomeAPI por CEP é FALLBACK** (`https://cep.awesomeapi.com.br/json/{cep}`), só quando a rua não existe no OSM. ⚠️ **AwesomeAPI erra coordenada em CEPs isolados** mesmo acertando os vizinhos — caso real: CEP 12248-628 caiu 12km errado (deveria ser 1,3km), enquanto o CEP vizinho 12248-610 da MESMA rua estava certo. Por isso a rua via OSM virou primária.
- **BrasilAPI NÃO serve** pra coords — `location.coordinates` vem vazio. **Google** ficou de fora (exige chave + faturamento), mas é o upgrade natural se precisar de precisão a nível de número da casa.
- **Distância = linha reta (haversine)**, não rota de carro — escolha do usuário (grátis, instantâneo, sem API de rotas). Subestima um pouco vs trajeto real, mas serve pra ranquear perto×longe.
- **Cache em 2 níveis** (ver `services/geocode.service.ts`):
  - memória por processo (`memCache`), guarda até negativos pra não martelar CEP inválido;
  - banco: colunas `latitude/longitude/geo_cep/geo_updated_at` em `curriculos` e `rh_empresas` (`geo_cep` = cep que gerou as coords → re-geocoda se mudar).
- **Warm em background**: `/rh/vagas` calcula distância só com coords já salvas (rápido, sem chamada externa no hot path) e dispara `GeocodeService.warmInBackground()` pro que falta. Aparece no próximo refresh ("self-heal"). Evita travar a tela com N chamadas síncronas.
- Loja da vaga: join `rh_empresas emp ON emp.cod_loja = v.cod_loja` (ver [[2026-06-12-colaborador-loja-empresa-id-cod-loja|vínculo loja via cod_loja]]).
- Formato: `formatarDistancia()` arredonda metros a 50 → `"850 m"`, `"14 km 700 m"`.

## Arquivos
- `migrations/1785410000000-AddGeoCoordsCurriculoEmpresa.ts`
- `services/geocode.service.ts` (NOVO)
- `controllers/rh.controller.ts` → `listarVagas`
- `entities/Curriculo.ts`, `entities/RhEmpresa.ts`
- `pages/RhVagas.jsx` (coluna + célula; colSpan da linha expandida 16→17)

## Pegadinhas
- Geocoda pela **rua** (Photon), não pelo número da casa → precisão a nível de rua (suficiente pra CEP-a-CEP). Dois CEPs na mesma rua dão a mesma coord.
- ~1 em 49 ruas não está no OSM → cai no fallback AwesomeAPI ou mostra "—".
- Selecionado **manual** (não veio do form público) não tem endereço no snapshot → "—".
- Em produção, na 1ª carga da tela de Vagas as distâncias aparecem em branco até o warm rodar (segundos). Pra preencher na hora, rodar backfill (Photon street-first → fallback AwesomeAPI) em `curriculos`+`rh_empresas`.
- **Ao trocar a estratégia de geocoding**, os registros antigos têm `geo_cep` preenchido e NÃO re-geocodam sozinhos (warm só pega o que falta). Tem que rodar backfill forçado pra recalcular tudo.
