# Trabalho atual

_Nada em andamento._ Sessão de 20-21/08/2026 concluída e commitada.

## Decisões que ficaram em aberto (retomar quando o usuário pedir)

1. **`trust proxy` no backend** — hoje o rate limit conta todos os usuários como
   um IP só (o do nginx). 10 tentativas de login erradas travam o login da
   empresa inteira por 15 min. Correção = `app.set('trust proxy', 1)` antes dos
   limiters em `packages/backend/src/index.ts`. Confirmar quantos proxies há na
   frente antes (o `1` precisa bater com a realidade).

2. **Geocode do KM Residência** — a API de CEP está com cota estourada (429);
   70 candidatos do Tradição sem KM e crescendo. Correção testada e documentada
   em [[bugs-resolvidos/2026-08-21-km-residencia-em-branco]]. Usuário optou por
   deixar como está em 21/08/2026.

3. **Healthcheck dos frontends kontrata** — todos marcam `unhealthy` por apontar
   pra porta errada. Falso positivo, ver
   [[bugs-resolvidos/2026-08-20-healthcheck-frontend-kontrata]]. Corrigir exige
   rebuild de todos os clientes.
