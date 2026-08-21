# Frontend kontrata sempre "unhealthy" — é FALSO POSITIVO

**Data:** 2026-08-20
**Onde:** todos os `kontrata-<cliente>-frontend` da VPS 46

## Sintoma
Depois de qualquer deploy de frontend, `docker ps` mostra:

```
kontrata-tradicao-frontend   Up 2 minutes (unhealthy)
```

Dá o susto de "quebrei o deploy" — **mas o site funciona normalmente**.

## Causa-raiz
O healthcheck da imagem testa a porta errada:

```
wget --quiet --tries=1 --spider http://localhost:3004 || exit 1
```

O nginx **dentro** do container escuta na **80** (por isso `80/tcp` aparece em
PORTS). A 3004 só existe como alvo do mapeamento do host (`7903->3004`), não
como porta em escuta interna. Resultado: `Connection refused` eterno.

## Como confirmar em 10 segundos que é isso e não um deploy quebrado
Todos os clientes kontrata estão assim, inclusive os que ninguém tocou há dias:

```bash
ssh vps2-hostinger 'docker ps --filter name=kontrata'
```

Se pontocerto/guibox/damata/puma/mameva/cidade/fratelli também estão
`unhealthy` há dias → é este bug, siga a vida.

Os `prevencao-*-frontend` (imagem antiga, outro Dockerfile) ficam `healthy` —
por isso o contraste chama atenção.

## Prova real de que o deploy deu certo
Ignore o healthcheck. Confira o bundle servido:

```bash
ssh vps2-hostinger 'curl -s https://<cliente>.kontrataai.com.br/'
# pega o /assets/index-XXXX.js e:
ssh vps2-hostinger 'curl -s https://<cliente>.kontrataai.com.br/assets/index-XXXX.js | grep -c <palavra-nova>'
```

## Correção definitiva (pendente)
Trocar o healthcheck pra porta 80 no `InstaladorVPS/Dockerfile.frontend`.
Não foi feito ainda porque exige rebuild de **todos** os clientes — e a regra é
[[../../MEMORY|um cliente por vez, com validação]].

## Tags
#bug #deploy #docker #kontrata #falso-positivo
