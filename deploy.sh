#!/bin/bash
# ─────────────────────────────────────────────────────
#  Davomat Tizimi — Update & Fix Script
#  Ishlatish: bash deploy.sh
# ─────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
err()  { echo -e "${RED}[XATO]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[....] $1${NC}"; }
warn() { echo -e "${YELLOW}[!!!!] $1${NC}"; }

APP_DIR="/www/server/davomat-tizimi"
WEB_DIR="/www/wwwroot/hr.muhamadyorg.uz"
PM2_NAME="davomat-api"
API_PORT="3001"
ECOSYSTEM="$APP_DIR/ecosystem.config.cjs"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Davomat Tizimi — Update & Fix        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Papka ─────────────────────────────
info "1/7 Papka tekshirilmoqda..."
[ -d "$APP_DIR" ] || err "Papka topilmadi: $APP_DIR"
cd "$APP_DIR"
ok "Papka: $APP_DIR"

# ── 2. DATABASE_URL topish ────────────────
info "2/7 Database ulanishi aniqlanmoqda..."

# .env fayldan o'qish
[ -f "$APP_DIR/.env" ] && export $(grep -v '^#' "$APP_DIR/.env" | xargs) 2>/dev/null || true

# Ecosystem fayldan o'qish
if [ -z "$DATABASE_URL" ] && [ -f "$ECOSYSTEM" ]; then
  DB_TMP=$(grep -oP "DATABASE_URL:\s*'\K[^']+" "$ECOSYSTEM" 2>/dev/null || true)
  [ -n "$DB_TMP" ] && export DATABASE_URL="$DB_TMP"
fi

# PM2 dan o'qish
if [ -z "$DATABASE_URL" ]; then
  DB_TMP=$(pm2 env "$PM2_NAME" 2>/dev/null | grep -oP "DATABASE_URL.*'\K[^']+" || true)
  [ -n "$DB_TMP" ] && export DATABASE_URL="$DB_TMP"
fi

# Postgres user bilan avto-topish
if [ -z "$DATABASE_URL" ]; then
  warn "DATABASE_URL topilmadi — postgres user bilan avto-tanlanmoqda..."
  DB_NAME=$(sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname NOT IN ('postgres','template0','template1') ORDER BY datname LIMIT 1;" 2>/dev/null || echo "")
  if [ -n "$DB_NAME" ]; then
    export DATABASE_URL="postgresql://postgres@localhost:5432/$DB_NAME"
    warn "Topildi: $DATABASE_URL"
  fi
fi

# Ulanishni sinash
if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
  ok "Database ulandi"
elif sudo -u postgres psql -c "SELECT 1;" >/dev/null 2>&1; then
  # sudo -u postgres bilan ishlaydi — DATABASE_URL ni tuzatamiz
  DB_NAME=$(sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname NOT IN ('postgres','template0','template1') ORDER BY datname LIMIT 1;" 2>/dev/null || echo "davomat_db")
  export DATABASE_URL="postgresql://postgres@localhost:5432/$DB_NAME"
  ok "Database postgres user bilan ulandi"
else
  echo ""
  warn "Database ulanmadi! Quyidagi ma'lumotlarni kiriting:"
  read -p "PostgreSQL foydalanuvchi nomi [postgres]: " DB_USER
  DB_USER="${DB_USER:-postgres}"
  read -s -p "PostgreSQL paroli: " DB_PASS
  echo ""
  read -p "Database nomi [davomat_db]: " DB_NAME
  DB_NAME="${DB_NAME:-davomat_db}"
  if [ -z "$DB_PASS" ]; then
    export DATABASE_URL="postgresql://${DB_USER}@localhost:5432/${DB_NAME}"
  else
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
  fi
  psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1 || err "Database ulanmadi: $DATABASE_URL"
  ok "Database ulandi"
fi

# SESSION_SECRET
if [ -z "$SESSION_SECRET" ]; then
  export SESSION_SECRET=$(openssl rand -base64 32)
fi

# .env ni yangilash/yaratish
cat > "$APP_DIR/.env" << ENVEOF
DATABASE_URL=${DATABASE_URL}
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=${API_PORT}
ENVEOF
ok ".env yangilandi"

# ecosystem.config.cjs ni yaratish/yangilash (PM2 env saqlanadi)
cat > "$ECOSYSTEM" << ECOEOF
module.exports = {
  apps: [{
    name: '${PM2_NAME}',
    script: 'artifacts/api-server/dist/index.mjs',
    cwd: '${APP_DIR}',
    env: {
      NODE_ENV: 'production',
      PORT: ${API_PORT},
      DATABASE_URL: '${DATABASE_URL}',
      SESSION_SECRET: '${SESSION_SECRET}'
    },
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    watch: false
  }]
};
ECOEOF
ok "ecosystem.config.cjs yangilandi"

# ── 3. Git pull ───────────────────────────
info "3/7 GitHub dan so'nggi kod olinmoqda..."
git fetch origin 2>/dev/null
git reset --hard origin/main 2>/dev/null
ok "Kod yangilandi → $(git log --oneline -1)"

# ── 4. Dependencies ───────────────────────
info "4/7 Paketlar o'rnatilmoqda..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
ok "Paketlar tayyor"

# ── 5. Build ──────────────────────────────
info "5/7 Build qilinmoqda..."

info "    API server..."
DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/api-server run build
ok "    API server build tayyor"

info "    Frontend..."
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/davomat run build
ok "    Frontend build tayyor"

if [ -d "$WEB_DIR" ]; then
  cp -r "$APP_DIR/artifacts/davomat/dist/public/." "$WEB_DIR/"
  ok "    Frontend ko'chirildi → $WEB_DIR"
fi

# ── 6. PM2 restart ────────────────────────
info "6/7 API server ishga tushirilmoqda..."

# Avvalgi processni to'xtatish (nom yoki id bo'lishi mumkin)
pm2 delete "$PM2_NAME" 2>/dev/null || true
pm2 delete 6 2>/dev/null || true  # Eski id
sleep 1

# Ecosystem fayl bilan ishga tushirish
pm2 start "$ECOSYSTEM"
pm2 save >/dev/null 2>&1 || true
ok "PM2 ishga tushdi: $PM2_NAME (port $API_PORT)"

# ── 7. DB tekshirish va seed ──────────────
info "7/7 Foydalanuvchilar tekshirilmoqda..."
sleep 3  # API ga tayyorlanish vaqti

ADMIN_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM users WHERE role IN ('admin','superadmin');" 2>/dev/null || echo "0")
ADMIN_COUNT=$(echo "$ADMIN_COUNT" | tr -d ' ')

if [ "$ADMIN_COUNT" -eq 0 ]; then
  warn "Admin topilmadi — seed ishga tushirilmoqda..."
  SEED_RES=$(curl -sf -X POST "http://localhost:$API_PORT/api/seed" 2>/dev/null || echo "")
  if [ -n "$SEED_RES" ]; then
    ok "Seed bajarildi"
  else
    warn "Seed API orqali kelmadi — to'g'ridan DB ga yozilmoqda..."
    HASH=$(node -e "const b=require('bcryptjs'); console.log(b.hashSync('superadmin123',10));" 2>/dev/null || \
           node -e "import('bcryptjs').then(b=>console.log(b.default.hashSync('superadmin123',10)))" 2>/dev/null || echo "")
    if [ -n "$HASH" ]; then
      psql "$DATABASE_URL" -c "INSERT INTO users (username, password, \"firstName\", \"lastName\", role, \"isActive\") VALUES ('superadmin', '$HASH', 'Super', 'Admin', 'superadmin', true) ON CONFLICT (username) DO NOTHING;" 2>/dev/null || true
      ok "superadmin yaratildi"
    fi
  fi
fi

# ── Natija ────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✓ Muvaffaqiyatli yangilandi!           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# API tekshirish (401 = ishlayapti, faqat login kerak)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$API_PORT/api/auth/me" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
  ok "API ishlayapti: http://localhost:$API_PORT (HTTP $HTTP_CODE)"
else
  warn "API javob bermadi (HTTP $HTTP_CODE). Loglar:"
  pm2 logs "$PM2_NAME" --lines 15 --nostream 2>/dev/null || true
fi

echo ""
echo -e "  ${CYAN}Login ma'lumotlari:${NC}"
psql "$DATABASE_URL" -c "SELECT id, username, role, \"isActive\" FROM users WHERE role IN ('admin','superadmin') ORDER BY id;" 2>/dev/null || true

echo ""
echo -e "  ${YELLOW}Standart parol:${NC} superadmin123 / admin123"
echo ""
pm2 list
echo ""
