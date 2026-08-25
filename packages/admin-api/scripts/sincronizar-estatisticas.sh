#!/bin/bash
# Copia os números do Banco de Currículos de cada cliente para o painel.
#
#   bash sincronizar-estatisticas.sh
#
# São os dois números dos cards da tela Banco de Currículos:
#   TOTAL      -> COUNT(*) de curriculos
#   CONTRATADO -> COUNT(*) onde status = 'contratado'
#
# POR QUE COPIAR e não consultar ao vivo: os dados moram no banco de CADA
# cliente. Consultar na hora exigiria o painel guardar a senha dos nove bancos,
# ou subir código novo em todos eles. Uma cópia por dia dá o mesmo número na
# prática, sem abrir nada e sem deploy.
#
# Descobre os clientes pelas pastas em /root/clientes-kontrata — cliente novo
# entra sozinho, sem lista pra manter em lugar nenhum.
set -u

BASE=/root/clientes-kontrata
ADMIN=kontrata-admin-postgres
SQL=$(mktemp)
trap 'rm -f "$SQL"' EXIT

set -a; . /root/kontrata-admin/.env; set +a

TOT_CV=0; TOT_CT=0
printf '%-14s %12s %12s\n' cliente curriculos contratados
printf '%-14s %12s %12s\n' -------------- ------------ ------------

for DIR in "$BASE"/*/; do
  SUB=$(basename "$DIR")
  [ -f "$DIR/.env" ] || continue
  CU=$(grep -E '^POSTGRES_USER=' "$DIR/.env" | cut -d= -f2-)
  CD=$(grep -E '^POSTGRES_DB=' "$DIR/.env" | cut -d= -f2-)
  CT="kontrata-$SUB-postgres"
  docker inspect "$CT" >/dev/null 2>&1 || { printf '%-14s %12s\n' "$SUB" '(sem container)'; continue; }

  N=$(docker exec "$CT" psql -U "$CU" -d "$CD" -t -A \
      -c "SELECT COUNT(*) FROM curriculos" 2>/dev/null | tr -d '\r')
  K=$(docker exec "$CT" psql -U "$CU" -d "$CD" -t -A \
      -c "SELECT COUNT(*) FROM curriculos WHERE status = 'contratado'" 2>/dev/null | tr -d '\r')

  # Banco fora do ar devolve vazio. Pular é melhor que gravar zero: zero
  # apagaria o número bom da última sincronização.
  case "$N" in ''|*[!0-9]*) printf '%-14s %12s\n' "$SUB" '(nao respondeu)'; continue ;; esac
  K=${K:-0}

  printf "UPDATE clientes SET total_curriculos = %s, total_contratados = %s, stats_em = now() WHERE subdominio = '%s';\n" \
    "$N" "$K" "$SUB" >> "$SQL"

  printf '%-14s %12s %12s\n' "$SUB" "$N" "$K"
  TOT_CV=$((TOT_CV + N)); TOT_CT=$((TOT_CT + K))
done

printf '%-14s %12s %12s\n' -------------- ------------ ------------
printf '%-14s %12s %12s\n' TOTAL "$TOT_CV" "$TOT_CT"

if [ -s "$SQL" ]; then
  docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$ADMIN" \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -f /dev/stdin < "$SQL"
  echo "Gravado no painel em $(date '+%d/%m/%Y %H:%M')."
else
  echo "Nada a gravar."
fi
