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
  fail "Iltimos sudo bilan ishga tushiring: sudo bash deploy.sh"
fi

clear
echo -e "${BOLD}${CYAN}"
echo "  ██████╗  █████╗ ██╗   ██╗ ██████╗ ███╗   ███╗ █████╗ ████████╗"
echo "  ██╔══██╗██╔══██╗██║   ██║██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝"
echo "  ██║  ██║███████║██║   ██║██║   ██║██╔████╔██║███████║   ██║   "
echo "  ██║  ██║██╔══██║╚██╗ ██╔╝██║   ██║██║╚██╔╝██║██╔══██║   ██║   "
echo "  ██████╔╝██║  ██║ ╚████╔╝ ╚██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   "
echo "  ╚═════╝ ╚═╝  ╚═╝  ╚═══╝   ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   "
echo -e "${NC}"
echo -e "${BOLD}         Davomat Tizimi — VPS O'rnatish Skripti${NC}"
sep

# ─────────────────────────────────────────
#  Foydalanuvchi ma'lumotlarini so'rash
# ─────────────────────────────────────────
echo ""
echo -e "${BOLD}Bir necha savol beramiz, so'ng hammasini avtomatik qilamiz.${NC}"
echo ""

read -p "$(echo -e ${YELLOW}Domeningiz nomi [masalan: davomat.uz, bo\'lmasa Enter bosing]: ${NC})" DOMAIN
DOMAIN=$(echo "$DOMAIN" | xargs)

read -p "$(echo -e ${YELLOW}PostgreSQL parol [bo\'sh qoldirsa avtomatik yaratiladi]: ${NC})" DB_PASS
DB_PASS=$(echo "$DB_PASS" | xargs)
if [ -z "$DB_PASS" ]; then
  DB_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)
  warn "Avtomatik DB parol: $DB_PASS (eslab qoling!)"
fi

SESSION_SECRET=$(openssl rand -base64 32)

REPO_URL="https://github.com/muhamadyorg/davomat-tizimi.git"
APP_DIR="/opt/davomat-tizimi"
DB_NAME="davomat_db"
DB_USER="davomat"
API_PORT=3001

sep
echo ""
info "O'rnatish boshlandi..."
echo ""

# ─────────────────────────────────────────
#  1. Tizimni yangilash
# ─────────────────────────────────────────
sep
info "[1/9] Tizim yangilanmoqda..."
apt-get update -qq
apt-get install -y -qq curl wget git openssl software-properties-common build-essential
ok "Tizim yangilandi"

# ─────────────────────────────────────────
#  2. Node.js 20 o'rnatish
# ─────────────────────────────────────────
sep
info "[2/9] Node.js 20 o'rnatilmoqda..."
if ! command -v node &>/dev/null || [[ "$(node -v 2>/dev/null | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]]; then
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
#  3. PostgreSQL o'rnatish
# ─────────────────────────────────────────
sep
info "[3/9] PostgreSQL o'rnatilmoqda..."
if ! command -v psql &>/dev/null; then
  apt-get install -y -qq postgresql postgresql-contrib
  systemctl enable postgresql --quiet
  systemctl start postgresql
  ok "PostgreSQL o'rnatildi"
else
  ok "PostgreSQL allaqachon mavjud"
  systemctl start postgresql 2>/dev/null || true
fi

# DB foydalanuvchi va baza yaratish
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" >/dev/null

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null

ok "PostgreSQL baza tayyorlandi: $DB_NAME"

# ─────────────────────────────────────────
#  4. Nginx o'rnatish
# ─────────────────────────────────────────
sep
info "[4/9] Nginx o'rnatilmoqda..."
if ! command -v nginx &>/dev/null; then
  apt-get install -y -qq nginx
  ok "Nginx o'rnatildi"
else
  ok "Nginx allaqachon mavjud"
fi

# ─────────────────────────────────────────
#  5. Kodni klonlash
# ─────────────────────────────────────────
sep
info "[5/9] Kod GitHub'dan yuklanmoqda..."
if [ -d "$APP_DIR" ]; then
  warn "$APP_DIR allaqachon mavjud — yangilanmoqda..."
  cd "$APP_DIR"
  git pull origin main --quiet
else
  git clone "$REPO_URL" "$APP_DIR" --quiet
  cd "$APP_DIR"
fi
ok "Kod yuklandi: $APP_DIR"

# ─────────────────────────────────────────
#  6. .env fayl yaratish
# ─────────────────────────────────────────
sep
info "[6/9] .env fayli yaratilmoqda..."
cat > "$APP_DIR/.env" << EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=${API_PORT}
EOF
ok ".env fayli yaratildi"

# ─────────────────────────────────────────
#  7. Paketlarni o'rnatish va build
# ─────────────────────────────────────────
sep
info "[7/9] Paketlar o'rnatilmoqda (1-2 daqiqa kutiladi)..."
cd "$APP_DIR"
pnpm install --frozen-lockfile --silent
ok "Paketlar o'rnatildi"

info "    Backend build qilinmoqda..."
pnpm --filter @workspace/api-server run build --silent
ok "    Backend build tayyor"

info "    Frontend build qilinmoqda..."
BASE_PATH="/" pnpm --filter @workspace/davomat run build --silent
ok "    Frontend build tayyor"

# ─────────────────────────────────────────
#  8. Database migratsiyasi va seed
# ─────────────────────────────────────────
sep
info "[8/9] Database jadvallari yaratilmoqda..."
cd "$APP_DIR/lib/db"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" \
  npx drizzle-kit push --config=drizzle.config.ts --force >/dev/null 2>&1
ok "Database jadvallari tayyor"

# PM2 bilan API server ishga tushirish
info "    API server vaqtincha ishga tushirilmoqda (seed uchun)..."
cd "$APP_DIR"
pm2 delete davomat-api 2>/dev/null || true
pm2 start artifacts/api-server/dist/index.mjs \
  --name davomat-api \
  --env production \
  --update-env \
  -- \
  2>/dev/null
pm2 set davomat-api:DATABASE_URL "postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" 2>/dev/null || true

# .env orqali ishga tushirish uchun ecosystem fayli yaratish
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

# Serverning ishga tushishini kutish
info "    Server tayyor bo'lishini kutilmoqda..."
for i in $(seq 1 15); do
  sleep 1
  if curl -sf "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
    ok "    API server ishga tushdi"
    break
  fi
  if [ "$i" -eq 15 ]; then
    warn "    Server 15 soniyada ishlamadi, seed o'tkazib yuborildi. Keyinroq qo'lda: curl -X POST http://localhost:${API_PORT}/api/seed"
  fi
done

# Seed qilish
SEED_RESULT=$(curl -s -X POST "http://localhost:${API_PORT}/api/seed" 2>/dev/null || echo "failed")
if echo "$SEED_RESULT" | grep -qi "seed\|success\|already"; then
  ok "    Boshlang'ich ma'lumotlar kiritildi (superadmin/admin)"
else
  warn "    Seed natijasi: $SEED_RESULT"
fi

pm2 save >/dev/null
ok "Database tayyorlandi"

# ─────────────────────────────────────────
#  9. Nginx sozlash
# ─────────────────────────────────────────
sep
info "[9/9] Nginx sozlanmoqda..."

if [ -n "$DOMAIN" ]; then
  SERVER_NAME="$DOMAIN www.$DOMAIN"
else
  SERVER_NAME="_"
fi

cat > /etc/nginx/sites-available/davomat << EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    # Frontend statik fayllar
    root ${APP_DIR}/artifacts/davomat/dist/public;
    index index.html;

    # Barcha sahifalar uchun (SPA)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90;
    }

    # Katta fayllar uchun
    client_max_body_size 10M;

    # Kesh sozlamalari (statik fayllar)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Eski konfiguratsiyani o'chirish
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
ln -sf /etc/nginx/sites-available/davomat /etc/nginx/sites-enabled/davomat

nginx -t >/dev/null 2>&1 && systemctl restart nginx
ok "Nginx sozlandi"

# ─────────────────────────────────────────
#  SSL sertifikat (domen bo'lsa)
# ─────────────────────────────────────────
if [ -n "$DOMAIN" ]; then
  sep
  info "SSL sertifikat o'rnatilmoqda (Let's Encrypt)..."
  if ! command -v certbot &>/dev/null; then
    apt-get install -y -qq certbot python3-certbot-nginx
  fi
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect >/dev/null 2>&1; then
    ok "SSL sertifikat o'rnatildi — https://${DOMAIN}"
  else
    warn "SSL avtomatik o'rnatilmadi. Qo'lda: certbot --nginx -d ${DOMAIN}"
  fi
fi

# ─────────────────────────────────────────
#  PM2 startup (qayta ishlaganda avtomatik)
# ─────────────────────────────────────────
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1
systemctl enable pm2-root >/dev/null 2>&1 || true

# ─────────────────────────────────────────
#  Yakuniy xulosа
# ─────────────────────────────────────────
sep
echo ""
echo -e "${BOLD}${GREEN}  ✔ O'RNATISH MUVAFFAQIYATLI YAKUNLANDI!${NC}"
echo ""
echo -e "${BOLD}  Kirish ma'lumotlari:${NC}"
echo -e "  ${CYAN}Login:${NC}    superadmin"
echo -e "  ${CYAN}Parol:${NC}    superadmin123"
echo ""
if [ -n "$DOMAIN" ]; then
  echo -e "  ${CYAN}Sayt manzili:${NC}  https://${DOMAIN}"
else
  VPS_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
  echo -e "  ${CYAN}Sayt manzili:${NC}  http://${VPS_IP}"
fi
echo ""
echo -e "${BOLD}  Foydali buyruqlar:${NC}"
echo -e "  ${YELLOW}pm2 status${NC}           — server holati"
echo -e "  ${YELLOW}pm2 logs davomat-api${NC} — server loglari"
echo -e "  ${YELLOW}pm2 restart davomat-api${NC} — serverni qayta ishga tushirish"
echo ""
echo -e "${BOLD}  Yangilanish kerak bo'lsa:${NC}"
echo -e "  ${YELLOW}cd /opt/davomat-tizimi && git pull && pnpm install && pnpm --filter @workspace/api-server run build && BASE_PATH=/ pnpm --filter @workspace/davomat run build && pm2 restart davomat-api${NC}"
echo ""
sep
