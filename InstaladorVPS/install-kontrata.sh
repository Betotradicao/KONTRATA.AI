#!/bin/bash
set -e

# Envolver em main() pra funcionar com curl | bash (le script inteiro antes de executar)
main() {

# ============================================
# AUTO-INSTALADOR KONTRATA.AI MULTI-TENANT
# Versao 1.0 — Maio/2026
#
# Sistema: Kontrata.ai (RH-only, baseado no Radar 360)
# Multi-tenant: varios clientes na mesma VPS com containers isolados
# Whitelabel: cliente pode usar dominio proprio
# Compatibilidade: roda lado-a-lado com o Radar na mesma VPS sem conflito
#   - Pasta clientes: /root/clientes-kontrata/ (Radar usa /root/clientes/)
#   - Containers: kontrata-<cliente>-* (Radar usa prevencao-<cliente>-*)
#   - Repo: /root/kontrata-repo (Radar usa /root/prevencao-radar-repo)
#   - Registry: /root/clientes-kontrata/kontrata-clientes.json
# ============================================

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   AUTO-INSTALADOR KONTRATA.AI MULTI-TENANT                ║"
echo "║   Sistema de gestao de RH para supermercados               ║"
echo "║   Versao 1.0 (Maio 2026)                                   ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "❌ Este script precisa ser executado como root!"
    echo "   Use: sudo bash install-kontrata.sh"
    exit 1
fi

# ============================================
# DEPENDENCIAS (instala apenas se ainda nao tem)
# ============================================

echo "📦 Verificando dependencias..."

if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "   ✓ Docker ja instalado"
fi

if ! command -v nginx &> /dev/null; then
    echo "📦 Instalando Nginx..."
    apt-get update
    apt-get install -y nginx
else
    echo "   ✓ Nginx ja instalado"
fi

if ! command -v certbot &> /dev/null; then
    echo "📦 Instalando Certbot..."
    apt-get install -y certbot python3-certbot-nginx
else
    echo "   ✓ Certbot ja instalado"
fi

if ! command -v git &> /dev/null; then
    apt-get install -y git
fi

if ! command -v jq &> /dev/null; then
    apt-get install -y jq
fi

echo "✅ Dependencias OK"
echo ""

# ============================================
# DETECCAO AUTOMATICA DE IP (sem hardcode)
# ============================================

HOST_IP=$(hostname -I | awk '{print $1}')
if [ -z "$HOST_IP" ]; then
    HOST_IP=$(curl -s ifconfig.me || echo "")
fi
if [ -z "$HOST_IP" ]; then
    echo "❌ Nao foi possivel detectar IP da VPS"
    exit 1
fi
echo "🌐 IP da VPS detectado: $HOST_IP"
echo ""

DOMAIN_BASE="kontrataai.com.br"

# ============================================
# CONFIGURACAO DO DOMINIO
# ============================================

CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-$2}"
OPCAO_DOMINIO=""
DOMINIO_BASE=""

if [ -z "$CUSTOM_DOMAIN" ] && [ -z "$1" ]; then
    echo ""
    echo "🌐 Configuracao do Dominio"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Como vai ser a URL desse cliente?"
    echo "  1) Padrao Kontrata.ai          →  <cliente>.${DOMAIN_BASE}"
    echo "  2) Subdominio do meu dominio   →  <cliente>.<seu_dominio> (revendedor)"
    echo "  3) Dominio unico personalizado →  <dominio_completo>"
    echo ""
    read -p "Escolha [1]: " OPCAO_DOMINIO </dev/tty
    OPCAO_DOMINIO="${OPCAO_DOMINIO:-1}"
    case "$OPCAO_DOMINIO" in
        2)
            while true; do
                read -p "Digite seu dominio base (ex: meurh.com.br): " DOMINIO_BASE </dev/tty
                if [[ "$DOMINIO_BASE" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$ ]]; then
                    break
                else
                    echo "❌ Dominio invalido. Use letras minusculas, numeros, hifens e pontos."
                fi
            done
            ;;
        3)
            while true; do
                read -p "Digite o dominio completo (ex: rh.minhaempresa.com.br): " CUSTOM_DOMAIN </dev/tty
                if [[ "$CUSTOM_DOMAIN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$ ]]; then
                    break
                else
                    echo "❌ Dominio invalido."
                fi
            done
            ;;
        *) OPCAO_DOMINIO=1 ;;
    esac
fi

# ============================================
# CONFIGURACAO DO CLIENTE (nome)
# ============================================

if [ -n "$1" ]; then
    CLIENT_NAME="$1"
    echo "🏪 Nome do cliente: $CLIENT_NAME"
else
    echo ""
    echo "🏪 Configuracao do Novo Cliente"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    case "$OPCAO_DOMINIO" in
        2) echo "URL final: <nome>.${DOMINIO_BASE}" ;;
        3) echo "URL final: ${CUSTOM_DOMAIN}" ;;
        *) echo "URL final: <nome>.${DOMAIN_BASE}" ;;
    esac
    echo ""
    echo "O nome do cliente sera usado pra:"
    echo "  - Banco de dados: kontrata_[nome]"
    echo "  - Bucket MinIO: kontrata-[nome]"
    echo "  - Containers Docker: kontrata-[nome]-*"
    echo "  - Pasta na VPS: /root/clientes-kontrata/[nome]"
    echo ""

    while true; do
        read -p "📝 Nome do cliente (apenas letras minusculas e numeros): " CLIENT_NAME </dev/tty
        if [[ ! "$CLIENT_NAME" =~ ^[a-z0-9]+$ ]]; then
            echo "❌ Nome invalido! Use apenas letras minusculas e numeros."
            continue
        fi
        break
    done
fi

if [[ ! "$CLIENT_NAME" =~ ^[a-z0-9]+$ ]]; then
    echo "❌ Nome invalido!"
    exit 1
fi

# Monta CUSTOM_DOMAIN final
if [ -z "$CUSTOM_DOMAIN" ] && [ "$OPCAO_DOMINIO" = "2" ] && [ -n "$DOMINIO_BASE" ]; then
    CUSTOM_DOMAIN="${CLIENT_NAME}.${DOMINIO_BASE}"
fi

DEFAULT_SUBDOMAIN="${CLIENT_NAME}.${DOMAIN_BASE}"
if [ -n "$CUSTOM_DOMAIN" ]; then
    CLIENT_SUBDOMAIN="$CUSTOM_DOMAIN"
else
    CLIENT_SUBDOMAIN="$DEFAULT_SUBDOMAIN"
fi

# INSTANCE_ID unico por dominio
if [ -n "$CUSTOM_DOMAIN" ]; then
    if [ -n "$DOMINIO_BASE" ]; then
        DOMINIO_SLUG=$(echo "$DOMINIO_BASE" | cut -d'.' -f1)
    else
        DOMINIO_SLUG=$(echo "$CUSTOM_DOMAIN" | rev | cut -d'.' -f3 | rev)
    fi
    DOMINIO_SLUG=$(echo "$DOMINIO_SLUG" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')
    INSTANCE_ID="${CLIENT_NAME}-${DOMINIO_SLUG}"
    INSTANCE_ID_DB="${CLIENT_NAME}_${DOMINIO_SLUG}"
else
    INSTANCE_ID="$CLIENT_NAME"
    INSTANCE_ID_DB="$CLIENT_NAME"
fi

CLIENT_DIR="/root/clientes-kontrata/$INSTANCE_ID"

if [ -d "$CLIENT_DIR" ] && [ -z "$1" ]; then
    echo ""
    echo "⚠️  Ja existe instalacao em $CLIENT_DIR"
    read -p "REINSTALAR? Isso apaga TODOS os dados desse cliente! (s/n) [n]: " REINSTALL </dev/tty
    if [[ "$REINSTALL" != "s" && "$REINSTALL" != "S" ]]; then
        echo "❌ Instalacao cancelada"
        exit 1
    fi
fi

POSTGRES_DB_NAME="kontrata_${INSTANCE_ID_DB}"
MINIO_BUCKET_NAME="kontrata-${INSTANCE_ID}"
CONTAINER_PREFIX="kontrata-${INSTANCE_ID}"

echo ""
echo "📋 Configuracao gerada:"
echo "   URL: https://$CLIENT_SUBDOMAIN"
echo "   Identificador: $INSTANCE_ID"
echo "   Banco PostgreSQL: $POSTGRES_DB_NAME"
echo "   Bucket MinIO: $MINIO_BUCKET_NAME"
echo "   Prefixo containers: $CONTAINER_PREFIX"
echo "   Diretorio: $CLIENT_DIR"
echo ""

if [ -z "$1" ]; then
    read -p "Confirma? (s/n): " CONFIRM </dev/tty
    if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
        echo "❌ Instalacao cancelada"
        exit 1
    fi
fi

# ============================================
# REMOVER INSTALACAO ANTERIOR (se for reinstall)
# ============================================

if [ -d "$CLIENT_DIR" ]; then
    echo "🧹 Removendo instalacao anterior..."
    cd "$CLIENT_DIR" 2>/dev/null || true
    docker compose -f docker-compose.yml down -v 2>/dev/null || true
    rm -rf "$CLIENT_DIR"
fi

mkdir -p "$CLIENT_DIR"
cd "$CLIENT_DIR"

# ============================================
# CLONAR/ATUALIZAR REPO KONTRATA
# ============================================

REPO_DIR="/root/kontrata-repo"
REPO_URL="https://github.com/Betotradicao/kontrata.ai.git"
REPO_BRANCH="KONTRATAAI"

if [ -d "$REPO_DIR" ]; then
    echo "📥 Atualizando repositorio Kontrata..."
    cd "$REPO_DIR"
    git fetch origin
    git reset --hard origin/${REPO_BRANCH}
    git pull origin ${REPO_BRANCH}
    cd "$CLIENT_DIR"
else
    echo "📥 Clonando repositorio Kontrata..."
    git clone -b ${REPO_BRANCH} "$REPO_URL" "$REPO_DIR"
fi

echo "✅ Repositorio Kontrata atualizado"
echo ""

# ============================================
# GERAR PORTAS DINAMICAS (nao conflita com Radar)
# ============================================

echo "🔢 Gerando portas unicas..."

find_available_port() {
    local BASE_PORT=$1
    local PORT=$BASE_PORT
    while netstat -tuln 2>/dev/null | grep -q ":$PORT " || ss -tuln 2>/dev/null | grep -q ":$PORT "; do
        PORT=$((PORT + 10))
        if [ $PORT -gt 65535 ]; then
            echo "❌ Sem porta disponivel"
            exit 1
        fi
    done
    echo $PORT
}

# Faixas separadas do Radar pra evitar colisao:
#   Frontend Kontrata: 7000-7999  (Radar usa 3000-3999)
#   Backend Kontrata:  8000-8999  (Radar usa 4000-4999)
#   Postgres Kontrata: 6400-6999  (Radar usa 5400-5999)
#   MinIO Kontrata:    8400-8999  (Radar usa 9000-9999)
CLIENT_HASH=$(echo -n "$INSTANCE_ID" | md5sum | cut -c1-4)
CLIENT_NUM=$((16#$CLIENT_HASH % 900 + 100))

FRONTEND_PORT=$((7000 + CLIENT_NUM))
BACKEND_PORT=$((8000 + CLIENT_NUM))
POSTGRES_PORT=$((6400 + CLIENT_NUM))
MINIO_API_PORT=$((8400 + CLIENT_NUM))
MINIO_CONSOLE_PORT=$((8700 + CLIENT_NUM))

FRONTEND_PORT=$(find_available_port $FRONTEND_PORT)
BACKEND_PORT=$(find_available_port $BACKEND_PORT)
POSTGRES_PORT=$(find_available_port $POSTGRES_PORT)
MINIO_API_PORT=$(find_available_port $MINIO_API_PORT)
MINIO_CONSOLE_PORT=$(find_available_port $MINIO_CONSOLE_PORT)

echo "   Frontend: $FRONTEND_PORT"
echo "   Backend: $BACKEND_PORT"
echo "   PostgreSQL: $POSTGRES_PORT"
echo "   MinIO API: $MINIO_API_PORT"
echo "   MinIO Console: $MINIO_CONSOLE_PORT"
echo ""

# ============================================
# GERAR CREDENCIAIS
# ============================================

echo "🔐 Gerando credenciais..."

generate_password() {
    openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32
}

POSTGRES_USER="postgres"
POSTGRES_PASSWORD=$(generate_password)
JWT_SECRET=$(generate_password)
API_TOKEN=$(generate_password)
MINIO_ROOT_USER="minioadmin"
MINIO_ROOT_PASSWORD=$(generate_password)

echo "✅ Credenciais geradas"
echo ""

# ============================================
# CRIAR .env
# ============================================

echo "📝 Criando .env..."

cat > .env << EOF
# Kontrata.ai — Cliente: $CLIENT_NAME
# Gerado em: $(date)
# Instalador v1.0

CLIENT_NAME=$CLIENT_NAME
CLIENT_SUBDOMAIN=$CLIENT_SUBDOMAIN

FRONTEND_PORT=$FRONTEND_PORT
BACKEND_PORT=$BACKEND_PORT
POSTGRES_PORT=$POSTGRES_PORT

POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB_NAME
DB_HOST=${CONTAINER_PREFIX}-postgres
DB_PORT=5432
DB_USER=$POSTGRES_USER
DB_PASSWORD=$POSTGRES_PASSWORD
DB_NAME=$POSTGRES_DB_NAME

MINIO_API_PORT=$MINIO_API_PORT
MINIO_CONSOLE_PORT=$MINIO_CONSOLE_PORT
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_ACCESS_KEY=$MINIO_ROOT_USER
MINIO_SECRET_KEY=$MINIO_ROOT_PASSWORD
MINIO_BUCKET_NAME=$MINIO_BUCKET_NAME
MINIO_PUBLIC_ENDPOINT=$CLIENT_SUBDOMAIN
MINIO_PUBLIC_PORT=443
MINIO_PUBLIC_USE_SSL=true
MINIO_PUBLIC_PATH=/storage

JWT_SECRET=$JWT_SECRET
API_TOKEN=$API_TOKEN

VITE_API_URL=https://$CLIENT_SUBDOMAIN/api
VITE_CLIENT_NAME=Kontrata.ai
# Zoom default 80% pros clientes novos (telas ficam mais confortaveis em
# monitores comuns). User pode ajustar manual com Ctrl+/Ctrl-.
VITE_DEFAULT_ZOOM=0.8

HOST_IP=$HOST_IP
NODE_ENV=production
FRONTEND_URL=https://$CLIENT_SUBDOMAIN

EMAIL_USER=
EMAIL_PASS=
EOF

echo "✅ .env criado"
echo ""

# ============================================
# CRIAR docker-compose.yml
# ============================================

echo "📦 Criando docker-compose.yml..."

cat > docker-compose.yml << EOF
# Project name explicito = evita colisao com Radar quando cliente tem
# mesmo nome em ambos os sistemas (ex: tradicao no Radar e na Kontrata).
name: kontrata-${INSTANCE_ID}

services:
  postgres:
    image: pgvector/pgvector:pg15
    container_name: ${CONTAINER_PREFIX}-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB}
      TZ: America/Sao_Paulo
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "\${POSTGRES_PORT}:5432"
    networks:
      - kontrata-${INSTANCE_ID}_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: ${CONTAINER_PREFIX}-minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: \${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: \${MINIO_ROOT_PASSWORD}
      TZ: America/Sao_Paulo
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    ports:
      - "\${MINIO_API_PORT}:9000"
      - "\${MINIO_CONSOLE_PORT}:9001"
    networks:
      - kontrata-${INSTANCE_ID}_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  backend:
    build:
      context: /root/kontrata-repo/packages/backend
      dockerfile: /root/kontrata-repo/InstaladorVPS/Dockerfile.backend
    # Tag de imagem com prefixo kontrata- pra nao sobrescrever a imagem
    # do Radar quando o cliente tem o mesmo nome nos dois sistemas
    image: ${CONTAINER_PREFIX}-backend:latest
    container_name: ${CONTAINER_PREFIX}-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3010
      DB_HOST: ${CONTAINER_PREFIX}-postgres
      DB_PORT: 5432
      DB_USER: \${POSTGRES_USER}
      DB_PASSWORD: \${POSTGRES_PASSWORD}
      DB_NAME: \${POSTGRES_DB}
      DATABASE_URL: postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@${CONTAINER_PREFIX}-postgres:5432/\${POSTGRES_DB}
      HOST_IP: \${HOST_IP}
      JWT_SECRET: \${JWT_SECRET}
      API_TOKEN: \${API_TOKEN}
      MINIO_ENDPOINT: ${CONTAINER_PREFIX}-minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: \${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: \${MINIO_SECRET_KEY}
      MINIO_BUCKET_NAME: \${MINIO_BUCKET_NAME}
      MINIO_PUBLIC_ENDPOINT: \${MINIO_PUBLIC_ENDPOINT}
      MINIO_PUBLIC_PORT: \${MINIO_PUBLIC_PORT}
      MINIO_PUBLIC_USE_SSL: \${MINIO_PUBLIC_USE_SSL}
      MINIO_PUBLIC_PATH: \${MINIO_PUBLIC_PATH}
      EMAIL_USER: \${EMAIL_USER}
      EMAIL_PASS: \${EMAIL_PASS}
      FRONTEND_URL: \${FRONTEND_URL}
      TZ: America/Sao_Paulo
    ports:
      - "\${BACKEND_PORT}:3010"
    volumes:
      - backend_uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - kontrata-${INSTANCE_ID}_network

  frontend:
    build:
      context: /root/kontrata-repo/packages/frontend
      dockerfile: /root/kontrata-repo/InstaladorVPS/Dockerfile.frontend
      args:
        VITE_API_URL: \${VITE_API_URL}
        VITE_CLIENT_NAME: \${VITE_CLIENT_NAME}
        VITE_DEFAULT_ZOOM: \${VITE_DEFAULT_ZOOM}
    image: ${CONTAINER_PREFIX}-frontend:latest
    container_name: ${CONTAINER_PREFIX}-frontend
    restart: unless-stopped
    environment:
      TZ: America/Sao_Paulo
    ports:
      - "\${FRONTEND_PORT}:3004"
    depends_on:
      - backend
    networks:
      - kontrata-${INSTANCE_ID}_network

networks:
  kontrata-${INSTANCE_ID}_network:
    name: kontrata-${INSTANCE_ID}_network
    driver: bridge

volumes:
  postgres_data:
    name: ${CONTAINER_PREFIX}_postgres_data
  minio_data:
    name: ${CONTAINER_PREFIX}_minio_data
  backend_uploads:
    name: ${CONTAINER_PREFIX}_backend_uploads
EOF

echo "✅ docker-compose.yml criado"
echo ""

# ============================================
# NGINX REVERSE PROXY
# ============================================

echo "🌐 Configurando Nginx para $CLIENT_SUBDOMAIN..."

NGINX_NAME="kontrata-${INSTANCE_ID}"
cat > /etc/nginx/sites-available/$NGINX_NAME << EOF
# Kontrata.ai — cliente: $INSTANCE_ID
# Subdominio: $CLIENT_SUBDOMAIN

server {
    listen 80;
    server_name $CLIENT_SUBDOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
    }

    location /api {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        client_max_body_size 100M;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/uploads/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 1d;
        add_header Cache-Control "public";
    }

    location /storage/ {
        proxy_pass http://127.0.0.1:$MINIO_API_PORT/$MINIO_BUCKET_NAME/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -sf /etc/nginx/sites-available/$NGINX_NAME /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

echo "✅ Nginx configurado"
echo ""

# ============================================
# SSL — Certbot
# ============================================

echo "🔒 Configurando SSL (Let's Encrypt)..."
echo "⚠️  DNS de $CLIENT_SUBDOMAIN precisa apontar pra $HOST_IP"
echo ""

if [ -z "$1" ]; then
    read -p "DNS ja configurado? (s/n): " DNS_OK </dev/tty
else
    DNS_OK="s"
fi

if [[ "$DNS_OK" == "s" || "$DNS_OK" == "S" ]]; then
    certbot --nginx -d $CLIENT_SUBDOMAIN --non-interactive --agree-tos --register-unsafely-without-email 2>&1 || {
        echo "⚠️  Certbot falhou. Configure depois: certbot --nginx -d $CLIENT_SUBDOMAIN"
    }
    systemctl enable certbot.timer 2>/dev/null || true
    echo "✅ SSL configurado"
else
    echo "⚠️  SSL nao configurado. Configure depois: certbot --nginx -d $CLIENT_SUBDOMAIN"
fi
echo ""

# ============================================
# SUBIR CONTAINERS
# ============================================

echo "🚀 Subindo containers..."
cd "$CLIENT_DIR"
docker compose up -d --build

echo ""
echo "⏳ Aguardando containers..."
sleep 10

# Esperar postgres ficar pronto
PG_TRIES=0
PG_MAX=60
while [ $PG_TRIES -lt $PG_MAX ]; do
    if docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME -c "SELECT 1" > /dev/null 2>&1; then
        echo "✅ PostgreSQL pronto"
        break
    fi
    sleep 2
    PG_TRIES=$((PG_TRIES + 2))
done

# Esperar backend
echo "⏳ Aguardando backend..."
MAX_TRIES=120
TRY=0
while [ $TRY -lt $MAX_TRIES ]; do
    if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
        echo "✅ Backend pronto"
        break
    fi
    if [ $((TRY % 20)) -eq 0 ] && [ $TRY -gt 0 ]; then
        echo "   (${TRY}s / ${MAX_TRIES}s)"
    fi
    sleep 2
    TRY=$((TRY + 2))
done

if [ $TRY -ge $MAX_TRIES ]; then
    echo "⚠️  Backend demorou — pode estar rodando migrations. Cheque: docker logs ${CONTAINER_PREFIX}-backend"
fi

# ============================================
# GARANTIR USUARIO MASTER (ROBERTO)
# Fallback explicito: roda script de seed dentro do backend caso o
# auto-seed do startup nao tenha rodado (migration falhou, race condition, etc).
# Idempotente: nao cria duplicado se ja existe.
# ============================================

echo ""
echo "🔑 Garantindo usuario master (ROBERTO / Beto3107@@##)..."
sleep 5
SEED_TRIES=0
while [ $SEED_TRIES -lt 5 ]; do
    if docker exec ${CONTAINER_PREFIX}-backend node -e "
        require('./dist/scripts/seed-master-user').seedMasterUser()
            .then(() => process.exit(0))
            .catch(e => { console.error(e.message); process.exit(1); });
    " 2>&1 | tee /tmp/seed-output-$$.log; then
        echo "✅ Usuario master garantido"
        rm -f /tmp/seed-output-$$.log
        break
    fi
    SEED_TRIES=$((SEED_TRIES + 1))
    echo "   tentativa $SEED_TRIES/5 falhou, aguardando 5s..."
    sleep 5
done

if [ $SEED_TRIES -ge 5 ]; then
    echo "⚠️  Nao foi possivel rodar o seed master automaticamente."
    echo "   Rode manualmente: docker exec ${CONTAINER_PREFIX}-backend node dist/scripts/seed-master-user.js"
fi
echo ""

# ============================================
# REGISTRAR NO clientes.json
# ============================================

REGISTRY_DIR="/root/clientes-kontrata"
REGISTRY_FILE="$REGISTRY_DIR/kontrata-clientes.json"
mkdir -p "$REGISTRY_DIR"

if [ ! -f "$REGISTRY_FILE" ]; then
    echo "[]" > "$REGISTRY_FILE"
fi

# Adiciona o cliente (substitui se ja existe)
TMP=$(mktemp)
jq --arg id "$INSTANCE_ID" \
   --arg name "$CLIENT_NAME" \
   --arg sub "$CLIENT_SUBDOMAIN" \
   --arg db "$POSTGRES_DB_NAME" \
   --arg bucket "$MINIO_BUCKET_NAME" \
   --arg fport "$FRONTEND_PORT" \
   --arg bport "$BACKEND_PORT" \
   --arg pport "$POSTGRES_PORT" \
   --arg created "$(date -Iseconds)" \
   'map(select(.instance_id != $id)) + [{
      instance_id: $id,
      client_name: $name,
      subdomain: $sub,
      database: $db,
      bucket: $bucket,
      frontend_port: ($fport|tonumber),
      backend_port: ($bport|tonumber),
      postgres_port: ($pport|tonumber),
      created_at: $created
   }]' "$REGISTRY_FILE" > "$TMP" && mv "$TMP" "$REGISTRY_FILE"

echo "✅ Cliente registrado em $REGISTRY_FILE"
echo ""

# ============================================
# RESUMO FINAL
# ============================================

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   ✅ INSTALACAO CONCLUIDA — $INSTANCE_ID"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 URL:               https://$CLIENT_SUBDOMAIN"
echo "🔧 Identificador:     $INSTANCE_ID"
echo "📂 Diretorio:         $CLIENT_DIR"
echo ""
echo "🔑 Credenciais MASTER (login inicial):"
echo "   Usuario:           ROBERTO"
echo "   Senha:             Beto3107@@##"
echo ""
echo "🗄️  Banco PostgreSQL:"
echo "   Database:          $POSTGRES_DB_NAME"
echo "   Usuario:           $POSTGRES_USER"
echo "   Senha:             $POSTGRES_PASSWORD"
echo "   Porta externa:     $POSTGRES_PORT"
echo ""
echo "📦 MinIO:"
echo "   Bucket:            $MINIO_BUCKET_NAME"
echo "   Usuario admin:     $MINIO_ROOT_USER"
echo "   Senha admin:       $MINIO_ROOT_PASSWORD"
echo "   Console:           http://$HOST_IP:$MINIO_CONSOLE_PORT"
echo ""
echo "🐳 Containers:"
echo "   ${CONTAINER_PREFIX}-postgres"
echo "   ${CONTAINER_PREFIX}-minio"
echo "   ${CONTAINER_PREFIX}-backend"
echo "   ${CONTAINER_PREFIX}-frontend"
echo ""
echo "📋 Comandos uteis:"
echo "   Ver logs:          docker logs ${CONTAINER_PREFIX}-backend -f"
echo "   Reiniciar:         cd $CLIENT_DIR && docker compose restart"
echo "   Parar:             cd $CLIENT_DIR && docker compose stop"
echo "   Backup banco:      docker exec ${CONTAINER_PREFIX}-postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB_NAME > backup.sql"
echo ""
echo "🔗 Acesse agora:      https://$CLIENT_SUBDOMAIN"
echo ""

}  # fim main()

main "$@"
