#!/bin/bash
set -e

# ─────────────────────────────────────────
#  Ranglar
# ─────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✔ $1${NC}"; }
info() { echo -e "${BLUE}▶ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✘ $1${NC}"; exit 1; }
sep()  { echo -e "${CYAN}──────────────────────────────────────────────${NC}"; }

# ─────────────────────────────────────────
#  Root tekshirish
# ─────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  fail "sudo bilan ishga tushiring: sudo bash deploy-aapanel.sh"
fi

clear
echo -e "${BOLD}${CYAN}"
echo "   aaPanel + Davomat Tizimi — O'rnatish"
echo -e "${NC}"
sep

# ─────────────────────────────────────────
#  Sozlamalar
# ─────────────────────────────────────────
DOMAIN="hr.muhamadyorg.uz"
WEB_ROOT="/www/wwwroot/${DOMAIN}"
APP_DIR="/www/server/davomat-tizimi"
REPO_URL="https://github.com/muhamadyorg/davomat-tizimi.git"
API_PORT=3001
DB_NAME="davomat_db"
DB_USER="davomat"

echo ""
read -p "$(echo -e ${YELLOW}PostgreSQL parol [bo\'sh qoldirsa avtomatik yaratiladi]: ${NC})" DB_PASS
DB_PASS=$(echo "$DB_PASS" | xargs)
if [ -z "$DB_PASS" ]; then
  DB_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)
  warn "Avtomatik DB parol: ${BOLD}$DB_PASS${NC}  (eslab qoling!)"
fi

SESSION_SECRET=$(openssl rand -base64 32)

echo ""
info "O'rnatish boshlandi..."
sep

# ─────────────────────────────────────────
#  1. Node.js 20
# ─────────────────────────────────────────
sep
info "[1/7] Node.js 20 tekshirilmoqda..."
if ! command -v node &>/dev/null || [[ "$(node -v 2>/dev/null | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]]; then
  info "    Node.js 20 o'rnatilmoqda..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
  ok "Node.js $(node -v) o'rnatildi"
else
  ok "Node.js $(node -v) allaqachon mavjud"
fi

if ! command -v pnpm &>/dev/null; then
  npm install -g pnpm --silent
  ok "pnpm o'rnatildi"
else
  ok "pnpm allaqachon mavjud"
fi

if ! command -v pm2 &>/dev/null; then
  npm install -g pm2 --silent
  ok "PM2 o'rnatildi"
else
  ok "PM2 allaqachon mavjud"
fi

# ─────────────────────────────────────────
#  2. PostgreSQL
# ─────────────────────────────────────────
sep
info "[2/7] PostgreSQL tekshirilmoqda..."
if ! command -v psql &>/dev/null; then
  info "    PostgreSQL o'rnatilmoqda..."
  apt-get install -y -qq postgresql postgresql-contrib
  systemctl enable postgresql --quiet
  systemctl start postgresql
  ok "PostgreSQL o'rnatildi"
else
  ok "PostgreSQL allaqachon mavjud"
  systemctl start postgresql 2>/dev/null || true
fi

# DB foydalanuvchi va baza
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" >/dev/null

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null

ok "Database tayyor: ${DB_NAME}"

# ─────────────────────────────────────────
#  3. Kodni yuklab olish
# ─────────────────────────────────────────
sep
info "[3/7] Kod yuklanmoqda..."
if [ -d "$APP_DIR/.git" ]; then
  warn "Allaqachon mavjud — yangilanmoqda..."
  cd "$APP_DIR"
  git pull origin main --quiet
else
  mkdir -p /www/server
  git clone "$REPO_URL" "$APP_DIR" --quiet
  cd "$APP_DIR"
fi
ok "Kod yuklandi: $APP_DIR"

# ─────────────────────────────────────────
#  4. .env fayli
# ─────────────────────────────────────────
sep
info "[4/7] Sozlamalar yozilmoqda..."
cat > "$APP_DIR/.env" << EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=${API_PORT}
EOF
ok ".env fayli yaratildi"

# ─────────────────────────────────────────
#  5. Paketlar + Build
# ─────────────────────────────────────────
sep
info "[5/7] Paketlar o'rnatilmoqda (1-2 daqiqa)..."
cd "$APP_DIR"
pnpm install --frozen-lockfile --silent
ok "Paketlar o'rnatildi"

info "    Backend build qilinmoqda..."
pnpm --filter @workspace/api-server run build --silent
ok "    Backend tayyor"

info "    Frontend build qilinmoqda..."
BASE_PATH="/" pnpm --filter @workspace/davomat run build --silent
ok "    Frontend tayyor"

# ─────────────────────────────────────────
#  6. Database migratsiyasi + seed
# ─────────────────────────────────────────
sep
info "[6/7] Database tayyorlanmoqda..."
cd "$APP_DIR/lib/db"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" \
  npx drizzle-kit push --config=drizzle.config.ts --force >/dev/null 2>&1
ok "Jadvallar yaratildi"

# PM2 ecosystem fayli
cat > "$APP_DIR/ecosystem.config.cjs" << EOF
module.exports = {
  apps: [
    {
      name: 'davomat-api',
      script: 'artifacts/api-server/dist/index.mjs',
      cwd: '${APP_DIR}',
      env: {
        NODE_ENV: 'production',
        PORT: ${API_PORT},
        DATABASE_URL: 'postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}',
        SESSION_SECRET: '${SESSION_SECRET}'
      },
      exp_backoff_restart_delay: 100,
      max_restarts: 10
    }
  ]
};
EOF

pm2 delete davomat-api 2>/dev/null || true
pm2 start "$APP_DIR/ecosystem.config.cjs" >/dev/null 2>&1

info "    API server tayyor bo'lishini kutilmoqda..."
for i in $(seq 1 20); do
  sleep 1
  if curl -sf "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
    ok "    API server ishlayapti"
    break
  fi
  [ "$i" -eq 20 ] && warn "    Server 20s ichida ishlamadi"
done

SEED_RESULT=$(curl -s -X POST "http://localhost:${API_PORT}/api/seed" 2>/dev/null || echo "")
if echo "$SEED_RESULT" | grep -qi "seed\|success\|already"; then
  ok "    Boshlang'ich ma'lumotlar kiritildi"
else
  warn "    Seed: $SEED_RESULT"
fi

pm2 save >/dev/null 2>&1
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1
systemctl enable pm2-root >/dev/null 2>&1 || true
ok "PM2 sozlandi (doimiy)"

# ─────────────────────────────────────────
#  7. Frontend fayllarni aaPanel web root ga ko'chirish
# ─────────────────────────────────────────
sep
info "[7/7] Frontend fayllar aaPanel papkasiga ko'chirilmoqda..."
mkdir -p "$WEB_ROOT"

# Eski fayllarni tozalash (user.ini ni saqlab)
find "$WEB_ROOT" -mindepth 1 -not -name 'user.ini' -delete 2>/dev/null || true

# Yangi build fayllarni ko'chirish
cp -r "$APP_DIR/artifacts/davomat/dist/public/." "$WEB_ROOT/"

ok "Frontend fayllar ko'chirildi: $WEB_ROOT"

# ─────────────────────────────────────────
#  aaPanel uchun nginx config snippet
# ─────────────────────────────────────────
sep
info "aaPanel nginx konfiguratsiyasi yaratilmoqda..."

cat > /tmp/davomat_nginx_snippet.conf << 'NGINXEOF'
# === Davomat Tizimi — aaPanel nginx snippet ===
# aaPanel → Website → hr.muhamadyorg.uz → Config → bu qatorlarni qo'shing

# API so'rovlarini backend ga yo'naltirish
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 90;
}

# SPA uchun — barcha yo'llar index.html ga
location / {
    try_files $uri $uri/ /index.html;
}
NGINXEOF

ok "nginx snippet: /tmp/davomat_nginx_snippet.conf"

# ─────────────────────────────────────────
#  Yakuniy xulosa
# ─────────────────────────────────────────
sep
echo ""
echo -e "${BOLD}${GREEN}  ✔ O'RNATISH YAKUNLANDI!${NC}"
echo ""
echo -e "${BOLD}  Kirish:${NC}  superadmin / superadmin123"
echo ""
echo -e "${BOLD}${YELLOW}  Endi aaPanel da qilish kerak (1 ta qadam):${NC}"
echo ""
echo -e "  1. aaPanel → ${CYAN}Website${NC} → ${CYAN}hr.muhamadyorg.uz${NC} → ${CYAN}Config${NC} ni oching"
echo -e "     (yoki ${CYAN}Nginx Config${NC} / ${CYAN}Site Config${NC})"
echo ""
echo -e "  2. server { ... } ichida 'location /' bo'limini topib,"
echo -e "     quyidagi konfiguratsiyaga almashtiring:"
echo ""
echo -e "${CYAN}─────────────────────────────────────────${NC}"
cat /tmp/davomat_nginx_snippet.conf
echo -e "${CYAN}─────────────────────────────────────────${NC}"
echo ""
echo -e "  3. Nginx ni qayta ishga tushiring:"
echo -e "     ${YELLOW}nginx -t && systemctl reload nginx${NC}"
echo ""
echo -e "${BOLD}  So'ng brauzerda oching:${NC}  https://hr.muhamadyorg.uz"
echo ""
echo -e "${BOLD}  Foydali buyruqlar:${NC}"
echo -e "  ${YELLOW}pm2 status${NC}                  — holat"
echo -e "  ${YELLOW}pm2 logs davomat-api${NC}        — loglar"
echo -e "  ${YELLOW}pm2 restart davomat-api${NC}     — qayta ishga tushirish"
echo ""
sep
