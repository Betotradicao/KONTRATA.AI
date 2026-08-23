#!/bin/bash
# Puxa o logotipo de cada cliente e grava no painel interno.
#
#   bash sincronizar-logos.sh
#
# DE ONDE VEM: cada sistema guarda o logo em `configurations.client_logo_url`,
# gravado na tela Configurações de REDE > Personalização. Não é um link: é a
# imagem inteira embutida (data:image/...;base64).
#
# POR QUE LER DIRETO DO BANCO: os Postgres dos clientes ficam nesta mesma VPS,
# então não precisa de rota pública nem expor nada na internet.
#
# 🪤 NÃO passar o logo por `psql -c "...$URL..."`: são até 250 KB numa linha de
# comando e o argumento é truncado/rejeitado em silêncio — o UPDATE "roda" mas
# não grava (foi o que aconteceu com Da Mata e Fratelli). Aqui o SQL vai por
# ARQUIVO, com o valor escapado, que aguenta qualquer tamanho.
set -u

BASE=/root/clientes-kontrata
ADMIN_CONTAINER=kontrata-admin-postgres
SQL=$(mktemp)
trap 'rm -f "$SQL"' EXIT

set -a; . /root/kontrata-admin/.env; set +a

echo "cliente          logo"
echo "---------------- ----------------------------------------"

for DIR in "$BASE"/*/; do
  SUB=$(basename "$DIR")
  ENVFILE="$DIR/.env"
  [ -f "$ENVFILE" ] || continue

  CUSER=$(grep -E '^POSTGRES_USER=' "$ENVFILE" | cut -d= -f2-)
  CDB=$(grep -E '^POSTGRES_DB=' "$ENVFILE" | cut -d= -f2-)
  CONT="kontrata-$SUB-postgres"

  docker inspect "$CONT" >/dev/null 2>&1 || { printf '%-16s (sem container)\n' "$SUB"; continue; }

  LOGO=$(docker exec "$CONT" psql -U "$CUSER" -d "$CDB" -t -A \
          -c "SELECT value FROM configurations WHERE key = 'client_logo_url' LIMIT 1" 2>/dev/null | tr -d '\r')

  if [ -z "$LOGO" ]; then
    printf '%-16s (sem logo em Personalizacao)\n' "$SUB"
    continue
  fi

  case "$LOGO" in
    data:*|http*) URL="$LOGO" ;;
    /*)           URL="https://$SUB.kontrataai.com.br$LOGO" ;;
    *)            URL="https://$SUB.kontrataai.com.br/$LOGO" ;;
  esac

  # Aspa simples dentro do valor viraria fim de string no SQL — dobrar resolve.
  ESCAPADO=$(printf '%s' "$URL" | sed "s/'/''/g")
  printf "UPDATE clientes SET logo_url = '%s' WHERE subdominio = '%s';\n" "$ESCAPADO" "$SUB" >> "$SQL"

  TAM=$(printf '%s' "$URL" | wc -c)
  case "$URL" in
    data:*) printf '%-16s imagem embutida  %s KB\n' "$SUB" "$((TAM / 1024))" ;;
    *)      printf '%-16s %s\n' "$SUB" "$(echo "$URL" | cut -c1-58)" ;;
  esac
done

if [ -s "$SQL" ]; then
  docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$ADMIN_CONTAINER" \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -f /dev/stdin < "$SQL"
  echo
  echo "Gravado. Conferindo o que ficou no banco:"
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$ADMIN_CONTAINER" \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -F' ' -c \
    "SELECT rpad(subdominio,14), CASE WHEN logo_url IS NULL THEN 'SEM LOGO'
        ELSE (length(logo_url)/1024)::text || ' KB' END
     FROM clientes ORDER BY subdominio"
fi
