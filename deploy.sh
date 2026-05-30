#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# GritIQ — Hetzner VPS Deployment Script
# Run this on your VPS after cloning the repo.
# Usage: ./deploy.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[GritIQ]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── 1. Check prerequisites ────────────────────────────────────────────────────
info "Checking prerequisites..."

command -v docker       >/dev/null 2>&1 || error "Docker not found. Install: https://docs.docker.com/engine/install/ubuntu/"
command -v docker compose >/dev/null 2>&1 || \
  docker compose version  >/dev/null 2>&1 || \
  error "Docker Compose v2 not found. Run: apt install docker-compose-plugin"

# ── 2. Ensure .env exists ─────────────────────────────────────────────────────
if [ ! -f .env ]; then
  warn ".env not found — copying from .env.example"
  cp .env.example .env
  warn "Edit .env now and re-run this script."
  warn "  nano .env"
  exit 1
fi

# ── 3. Ensure Caddyfile has been configured ───────────────────────────────────
if grep -q "yourdomain.com" Caddyfile; then
  warn "Caddyfile still has placeholder domain 'yourdomain.com'."
  warn "Edit Caddyfile and replace with your real domain, then re-run."
  warn "  nano Caddyfile"
  exit 1
fi

# ── 4. Pull latest code ───────────────────────────────────────────────────────
info "Pulling latest code from GitHub..."
git pull origin main

# ── 5. Build and start containers ─────────────────────────────────────────────
info "Building Docker image (this takes ~2 minutes on first run)..."
docker compose build --no-cache app

info "Starting containers..."
docker compose up -d

# ── 6. Wait for health check ──────────────────────────────────────────────────
info "Waiting for app to become healthy..."
RETRIES=20
until docker compose exec -T app wget -qO- http://localhost:5000/api/health >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -eq 0 ]; then
    error "App did not become healthy in time. Check logs: docker compose logs app"
  fi
  sleep 3
done

info "App is healthy."
info "Caddy is serving HTTPS. Check: docker compose logs caddy"
info ""
info "Useful commands:"
info "  docker compose logs -f app       # App logs"
info "  docker compose logs -f caddy     # Caddy / TLS logs"
info "  docker compose restart app       # Restart app only"
info "  docker compose down              # Stop everything"
info "  docker compose exec app sh       # Shell into container"
