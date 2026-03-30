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

ok()    { echo -e "${GREEN}  ✔ $1${NC}"; }
skip()  { echo -e "${CYAN}  ↩ $1 (allaqachon mavjud — o'tkazildi)${NC}"; }
info()  { echo -e "${BLUE}  ▶ $1${NC}"; }
warn()  { echo -e "${YELLOW}  ⚠ $1${NC}"; }
fail()  { echo -e "${RED}  ✘ $1${NC}"; exit 1; }
step()  { echo -e "\n${BOLD}${CYAN}[$1/$TOTAL] $2${NC}"; echo -e "${CYAN}  ──────────────────────────────────────${NC}"; }

TOTAL=7

# ─────────────────────────────────────────
#  Root tekshirish
# ─────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  fail "sudo bilan ishga tushiring: sudo bash deploy-aapanel.sh"
fi

clear
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   aaPanel + Davomat Tizimi o'rnatish     ║"
echo "  ║   hr.muhamadyorg.uz                      ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ─────────────────────────────────────────
#  Asosiy sozlamalar
# ─────────────────────────────────────────
DOMAIN="hr.muhamadyorg.uz"
WEB_ROOT="/www/wwwroot/${DOMAIN}"
APP_DIR="/www/server/davomat-tizimi"
REPO_URL="https://github.com/muhamadyorg/davomat-tizimi.git"
API_PORT=3001
DB_NAME="davomat_db"
DB_USER="davomat"
ENV_FILE="$APP_DIR/.env"
STATE_FILE="$APP_DIR/.deploy_state"

# ─────────────────────────────────────────
#  .env mavjudligini tekshirish
#  Agar mavjud bo'lsa — eski parollarni O'QIYMIZ
#  Agar yo'q bo'lsa — yangi parol so'raymiz
# ─────────────────────────────────────────
echo ""
if [ -f "$ENV_FILE" ]; then
  echo -e "${GREEN}  ✔ Mavjud o'rnatish topildi — sozlamalar saqlanadi${NC}"
  # Eski .env dan o'qiymiz
  DB_PASS=$(grep "^DATABASE_URL=" "$ENV_FILE" | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')
  SESSION_SECRET=$(grep "^SESSION_SECRET=" "$ENV_FILE" | cut -d'=' -f2-)
  EXISTING_INSTALL=true
  echo -e "  ${CYAN}DB parol va session secret eski .env dan olinmoqda...${NC}"
else
  echo -e "${YELLOW}  Yangi o'rnatish — bir necha savol:${NC}"
  echo ""
  read -p "  PostgreSQL parol [bo'sh = avtomatik]: " DB_PASS
  DB_PASS=$(echo "$DB_PASS" | xargs)
  if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)
    echo -e "  ${YELLOW}Avtomatik parol: ${BOLD}$DB_PASS${NC}"
    echo -e "  ${YELLOW}(Bu parolni eslab qoling!)${NC}"
  fi
  SESSION_SECRET=$(openssl rand -base64 40 | tr -dc 'a-zA-Z0-9' | head -c 48)
  EXISTING_INSTALL=false
fi

echo ""
echo -e "${CYAN}  Boshlayapmiz...${NC}"

# ═══════════════════════════════════════════
#  1. Node.js, pnpm, PM2
# ═══════════════════════════════════════════
step 1 "Node.js, pnpm, PM2 tekshirilmoqda"

NODE_VERSION=$(node -v 2>/dev/null | cut -d'.' -f1 | tr -d 'v' || echo "0")
if [[ "$NODE_VERSION" -lt 20 ]]; then
  info "Node.js 20 o'rnatilmoqda..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null 2>&1
  ok "Node.js $(node -v) o'rnatildi"
else
  skip "Node.js $(node -v)"
fi

if ! command -v pnpm &>/dev/null; then
  info "pnpm o'rnatilmoqda..."
  npm install -g pnpm --silent
  ok "pnpm o'rnatildi"
else
  skip "pnpm $(pnpm -v)"
fi

if ! command -v pm2 &>/dev/null; then
  info "PM2 o'rnatilmoqda..."
  npm install -g pm2 --silent
  ok "PM2 o'rnatildi"
else
  skip "PM2 $(pm2 -v 2>/dev/null | head -1)"
fi

# ═══════════════════════════════════════════
#  2. PostgreSQL
# ═══════════════════════════════════════════
step 2 "PostgreSQL tekshirilmoqda"

if ! command -v psql &>/dev/null; then
  info "PostgreSQL o'rnatilmoqda..."
  apt-get install -y -qq postgresql postgresql-contrib >/dev/null 2>&1
  systemctl enable postgresql --quiet
  ok "PostgreSQL o'rnatildi"
else
  skip "PostgreSQL $(psql --version | awk '{print $3}')"
fi

# PostgreSQL ishlamasini ta'minlash
systemctl start postgresql 2>/dev/null || true
sleep 1

# DB foydalanuvchi
if sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename='${DB_USER}'" 2>/dev/null | grep -q 1; then
  skip "DB foydalanuvchi '${DB_USER}'"
else
  info "DB foydalanuvchi yaratilmoqda..."
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" >/dev/null
  ok "DB foydalanuvchi yaratildi: ${DB_USER}"
fi

# Baza
if sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1; then
  skip "Baza '${DB_NAME}'"
else
  info "Baza yaratilmoqda..."
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null
  ok "Baza yaratildi: ${DB_NAME}"
fi

# ═══════════════════════════════════════════
#  3. Kodni yuklab olish / yangilash
# ═══════════════════════════════════════════
step 3 "Kod tekshirilmoqda"

mkdir -p /www/server

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "")
  info "Yangi o'zgarishlar tekshirilmoqda..."
  git fetch origin main --quiet 2>/dev/null || true
  REMOTE_HASH=$(git rev-parse origin/main 2>/dev/null || echo "")

  if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    skip "Kod (o'zgarish yo'q — $LOCAL_HASH)"
    CODE_CHANGED=false
  else
    git pull origin main --quiet
    ok "Kod yangilandi: $LOCAL_HASH → $REMOTE_HASH"
    CODE_CHANGED=true
  fi
else
  info "Kod yuklanmoqda..."
  git clone "$REPO_URL" "$APP_DIR" --quiet
  cd "$APP_DIR"
  ok "Kod yuklandi: $APP_DIR"
  CODE_CHANGED=true
fi

# ═══════════════════════════════════════════
#  4. .env fayli
# ═══════════════════════════════════════════
step 4 ".env fayli tekshirilmoqda"

if [ -f "$ENV_FILE" ] && [ "$EXISTING_INSTALL" = true ]; then
  skip ".env fayli (mavjud, o'zgartirilmaydi)"
else
  cat > "$ENV_FILE" << EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=${API_PORT}
EOF
  ok ".env fayli yaratildi"
fi

# ═══════════════════════════════════════════
#  5. Paketlar va Build
# ═══════════════════════════════════════════
step 5 "Paketlar va build"

cd "$APP_DIR"
LAST_BUILD_HASH=$(cat "$STATE_FILE" 2>/dev/null || echo "")
CURRENT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "new")

if [ "$LAST_BUILD_HASH" = "$CURRENT_HASH" ] && \
   [ -f "$APP_DIR/artifacts/api-server/dist/index.mjs" ] && \
   [ -d "$APP_DIR/artifacts/davomat/dist/public" ]; then
  skip "Build (o'zgarish yo'q — avvalgi build ishlatiladi)"
  BUILD_DONE=false
else
  info "Paketlar o'rnatilmoqda (1-2 daqiqa)..."
  pnpm install --frozen-lockfile --silent
  ok "Paketlar o'rnatildi"

  info "Backend build qilinmoqda..."
  pnpm --filter @workspace/api-server run build --silent
  ok "Backend build tayyor"

  info "Frontend build qilinmoqda..."
  BASE_PATH="/" pnpm --filter @workspace/davomat run build --silent
  ok "Frontend build tayyor"

  echo "$CURRENT_HASH" > "$STATE_FILE"
  BUILD_DONE=true
fi

# ═══════════════════════════════════════════
#  6. Database migratsiyasi + PM2
# ═══════════════════════════════════════════
step 6 "Database va server"

# .env dan DATABASE_URL o'qish
export DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d'=' -f2-)
export SESSION_SECRET=$(grep "^SESSION_SECRET=" "$ENV_FILE" | cut -d'=' -f2-)
export PORT=$API_PORT
export NODE_ENV=production

# DB migratsiyasi (har safar tekshiriladi — xavfsiz)
info "Database jadvallari tekshirilmoqda..."
cd "$APP_DIR/lib/db"
DATABASE_URL="$DATABASE_URL" \
  npx drizzle-kit push --config=drizzle.config.ts --force >/dev/null 2>&1
ok "Database jadvallari tayyor"

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
        DATABASE_URL: '$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d'=' -f2-)',
        SESSION_SECRET: '$(grep "^SESSION_SECRET=" "$ENV_FILE" | cut -d'=' -f2-)'
      },
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 3000
    }
  ]
};
EOF

# PM2: ishlamoqdami?
PM2_RUNNING=$(pm2 list 2>/dev/null | grep "davomat-api" | grep "online" || echo "")
if [ -n "$PM2_RUNNING" ] && [ "$BUILD_DONE" = false ]; then
  skip "PM2 davomat-api (ishlayapti, o'zgarish yo'q)"
elif [ -n "$PM2_RUNNING" ]; then
  info "API server qayta ishga tushirilmoqda (yangi build)..."
  pm2 restart davomat-api >/dev/null 2>&1
  ok "API server qayta ishga tushdi"
else
  info "API server birinchi marta ishga tushirilmoqda..."
  pm2 delete davomat-api 2>/dev/null || true
  pm2 start "$APP_DIR/ecosystem.config.cjs" >/dev/null 2>&1
  ok "API server ishga tushdi"
fi

# Server tayyor bo'lishini kutish
info "API server tayyor bo'lishini kutilmoqda..."
SERVER_OK=false
for i in $(seq 1 25); do
  sleep 1
  if curl -sf "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
    SERVER_OK=true
    ok "API server ishlayapti (port: ${API_PORT})"
    break
  fi
  printf "."
done
echo ""

if [ "$SERVER_OK" = false ]; then
  warn "Server 25s ichida javob bermadi. Loglarni tekshiring: pm2 logs davomat-api"
fi

# Seed (faqat yangi o'rnatishda)
if [ "$EXISTING_INSTALL" = false ] && [ "$SERVER_OK" = true ]; then
  info "Boshlang'ich ma'lumotlar kiritilmoqda..."
  SEED_RESULT=$(curl -s -X POST "http://localhost:${API_PORT}/api/seed" 2>/dev/null || echo "")
  if echo "$SEED_RESULT" | grep -qi "seed\|success\|already"; then
    ok "superadmin va admin yaratildi"
  else
    warn "Seed natijasi: ${SEED_RESULT:-javob yo'q}"
  fi
else
  skip "Seed (mavjud o'rnatish — ma'lumotlar saqlanadi)"
fi

# PM2 startup sozlash
pm2 save >/dev/null 2>&1
pm2 startup systemd -u root --hp /root 2>/dev/null | grep "systemctl" | bash 2>/dev/null || true
pm2 save >/dev/null 2>&1
systemctl enable pm2-root 2>/dev/null || true
ok "PM2 doimiy ishga tushish sozlandi"

# ═══════════════════════════════════════════
#  7. Frontend fayllar → aaPanel web root
# ═══════════════════════════════════════════
step 7 "Frontend fayllar → $WEB_ROOT"

mkdir -p "$WEB_ROOT"

if [ "$BUILD_DONE" = true ]; then
  info "Frontend fayllar yangilanmoqda..."
  find "$WEB_ROOT" -mindepth 1 -not -name 'user.ini' -delete 2>/dev/null || true
  cp -r "$APP_DIR/artifacts/davomat/dist/public/." "$WEB_ROOT/"
  ok "Frontend fayllar ko'chirildi"
else
  skip "Frontend fayllar (o'zgarish yo'q)"
fi

# ─────────────────────────────────────────
#  Nginx snippet (har safar ko'rsatiladi)
# ─────────────────────────────────────────
NGINX_CONF="/tmp/davomat_nginx.conf"
cat > "$NGINX_CONF" << 'NGINXEOF'
    # Davomat API — proxy
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

    # SPA — barcha yo'llar index.html ga
    location / {
        try_files $uri $uri/ /index.html;
    }
NGINXEOF

# ─────────────────────────────────────────
#  Yakuniy xulosa
# ─────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║        O'RNATISH MUVAFFAQIYATLI YAKUNLANDI   ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

if [ "$SERVER_OK" = true ]; then
  echo -e "  ${GREEN}● API server ishlayapti${NC}  (port $API_PORT)"
else
  echo -e "  ${RED}● API server ishlamayapti${NC} — ${YELLOW}pm2 logs davomat-api${NC}"
fi

echo ""
echo -e "${BOLD}  Kirish ma'lumotlari:${NC}"
echo -e "  Login:  ${CYAN}superadmin${NC}   Parol: ${CYAN}superadmin123${NC}"
echo -e "  Login:  ${CYAN}admin${NC}        Parol: ${CYAN}admin123${NC}"
echo ""
echo -e "${BOLD}${YELLOW}  ❗ aaPanel da BITTA qadam qoldi:${NC}"
echo ""
echo -e "  1. aaPanel → ${CYAN}Website${NC} → ${CYAN}${DOMAIN}${NC} → ${CYAN}Config${NC}"
echo -e "     (yoki 'Nginx Config' → 'Config' tugmasi)"
echo ""
echo -e "  2. Ichidagi ${YELLOW}location /${NC} ni topib, hammasi bilan almashtiring:"
echo ""
echo -e "${CYAN}  ─────────────────────────────────────────────────${NC}"
cat "$NGINX_CONF"
echo -e "${CYAN}  ─────────────────────────────────────────────────${NC}"
echo ""
echo -e "  3. ${GREEN}Save${NC} bosing → ${GREEN}Reload${NC}"
echo ""
echo -e "  So'ng: ${BOLD}https://${DOMAIN}${NC}"
echo ""
echo -e "${BOLD}  Foydali buyruqlar:${NC}"
echo -e "  ${YELLOW}pm2 status${NC}                — holat ko'rish"
echo -e "  ${YELLOW}pm2 logs davomat-api${NC}      — xatoliklarni ko'rish"
echo -e "  ${YELLOW}pm2 restart davomat-api${NC}   — qayta ishga tushirish"
echo -e "  ${YELLOW}bash deploy-aapanel.sh${NC}    — yangilash (xavfsiz, qaytadan ishga tushsa bo'ladi)"
echo ""
