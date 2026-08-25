#!/bin/bash
# Publica o site em https://kontrataai.com.br
#
# O site e ESTATICO: nginx le direto de /var/www/kontrata-site, sem container.
#
# ⚠️ Os dois passos que parecem burocracia e nao sao:
#   1. limpar o destino — o Vite poe hash no nome do arquivo, entao build velho
#      nao e sobrescrito, so acumula (ja tinha 2 versoes de JS e CSS la);
#   2. chown/chmod — arquivo enviado por scp chega sem leitura pro www-data.
#      Resultado: 403 no JS, a pagina carrega so a casca e da TELA BRANCA.
#      Foi exatamente o que aconteceu em 25/08/2026.
set -euo pipefail

VPS=vps2-hostinger
DESTINO=/var/www/kontrata-site
AQUI="$(cd "$(dirname "$0")" && pwd)"

echo "==> build"
cd "$AQUI"
npx vite build

echo "==> limpando o destino"
ssh "$VPS" "rm -rf $DESTINO/assets && mkdir -p $DESTINO/assets"

echo "==> enviando"
scp -r "$AQUI"/dist/* "$VPS:$DESTINO/"

echo "==> permissoes"
ssh "$VPS" "chown -R www-data:www-data $DESTINO && chmod -R a+rX $DESTINO"

echo "==> conferindo"
ssh "$VPS" '
  JS=$(grep -o "/assets/index-[^\"]*\.js" '"$DESTINO"'/index.html | head -1)
  CSS=$(grep -o "/assets/index-[^\"]*\.css" '"$DESTINO"'/index.html | head -1)
  for u in / "$JS" "$CSS" /admin/api/publico/site; do
    C=$(curl -s -o /dev/null -w "%{http_code}" "https://kontrataai.com.br$u")
    printf "  %-42s %s\n" "$u" "$C"
    [ "$C" = "200" ] || FALHOU=1
  done
  [ -z "${FALHOU:-}" ] && echo "  OK" || { echo "  ⚠️  ALGO FORA DO AR"; exit 1; }
'
