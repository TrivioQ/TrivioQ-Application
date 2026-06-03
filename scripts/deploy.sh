#!/usr/bin/env bash
# =============================================================================
# TrivioQ — Docker Deployment Helper Script
# =============================================================================
# Target: AutomationServer @ 192.168.0.101
#
# Usage:
#   ./scripts/deploy.sh <command> [service]
#
# Commands:
#   deploy      First-time full build + start (validates env first)
#   redeploy    Rebuild changed images + restart services
#   rebuild     Force full --no-cache rebuild of all images
#   start       Start all services (no build)
#   stop        Stop all services (keeps volumes/data)
#   restart     Restart all services (or a specific one)
#   status      Show service health and port mapping
#   logs        Tail logs for all services (or a specific one)
#   migrate     Run Prisma migrations manually
#   backup      Dump PostgreSQL to a timestamped SQL file
#   shell       Open a shell inside a running container
#   teardown    ⚠️  Stop and DELETE all volumes (destroys database data)
#   help        Print this help message
#
# Examples:
#   ./scripts/deploy.sh deploy
#   ./scripts/deploy.sh logs api
#   ./scripts/deploy.sh restart api
#   ./scripts/deploy.sh shell api
#   ./scripts/deploy.sh backup
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}${BOLD}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}${BOLD}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}${BOLD}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}${BOLD}[ERROR]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.docker.example"
BACKUP_DIR="${PROJECT_ROOT}/backups"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

check_docker() {
  command -v docker &>/dev/null || die "Docker is not installed or not on PATH."
  docker compose version &>/dev/null || die "Docker Compose plugin (v2) is required. Run: sudo apt install docker-compose-plugin"
}

check_env() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    warn "Root .env not found. Copying from .env.docker.example ..."
    cp "${ENV_EXAMPLE}" "${ENV_FILE}"
    die "Please fill in ${ENV_FILE} (at minimum POSTGRES_PASSWORD) then re-run."
  fi

  # Check POSTGRES_PASSWORD is not empty
  # shellcheck disable=SC1090
  source <(grep -E '^POSTGRES_PASSWORD=' "${ENV_FILE}" | head -1)
  if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    die "POSTGRES_PASSWORD is not set in ${ENV_FILE}. Please add a strong password."
  fi

  # Warn about missing per-app env files
  for app in api web admin; do
    local app_env="${PROJECT_ROOT}/apps/${app}/.env"
    if [[ ! -f "${app_env}" ]]; then
      warn "apps/${app}/.env is missing — copy from .env.docker.example and fill in values."
    fi
  done
}

check_firebase_sa() {
  # shellcheck disable=SC1090
  local sa_path
  sa_path=$(grep -E '^FIREBASE_SERVICE_ACCOUNT_PATH=' "${ENV_FILE}" 2>/dev/null \
    | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  sa_path="${sa_path:-./apps/api/firebase-service-account.json}"

  # Resolve relative paths from project root
  if [[ "${sa_path}" != /* ]]; then
    sa_path="${PROJECT_ROOT}/${sa_path#./}"
  fi

  if [[ ! -f "${sa_path}" ]]; then
    warn "Firebase service account JSON not found at: ${sa_path}"
    warn "Copy it there before starting the API, or the API container will fail to mount it."
  else
    success "Firebase service account found at: ${sa_path}"
  fi
}

cd_to_project() {
  cd "${PROJECT_ROOT}"
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

cmd_help() {
  grep -A1 '# Commands:' "$0" | head -20 || true
  sed -n '/^# Commands:/,/^# =====/p' "$0" | grep -E '^\s+[a-z]' | sed 's/^#//'
  echo ""
  echo -e "${BOLD}Usage:${RESET} ./scripts/deploy.sh <command> [service]"
  echo ""
  echo -e "${BOLD}Commands:${RESET}"
  echo "  deploy      First-time full build + start"
  echo "  redeploy    Rebuild changed images + restart"
  echo "  rebuild     Force full --no-cache rebuild"
  echo "  start       Start all services (no build)"
  echo "  stop        Stop all services (keeps data)"
  echo "  restart     Restart all services (or a specific one)"
  echo "  status      Show service health"
  echo "  logs        Tail logs (all services or a specific one)"
  echo "  migrate     Run Prisma migrations manually"
  echo "  backup      Dump PostgreSQL to a SQL file"
  echo "  shell       Open a shell inside a container"
  echo "  teardown    ⚠️  Stop and DELETE all volumes"
  echo "  help        Print this message"
}

cmd_deploy() {
  info "Starting first-time deployment ..."
  check_docker
  check_env
  check_firebase_sa
  cd_to_project

  info "Building all Docker images ..."
  docker compose -f "${COMPOSE_FILE}" build

  info "Starting all services in detached mode ..."
  docker compose -f "${COMPOSE_FILE}" up -d

  info "Waiting for services to become healthy (up to 120s) ..."
  sleep 10

  cmd_status
  echo ""
  success "Deployment complete! Run '${BOLD}./scripts/deploy.sh logs${RESET}' to tail logs."
}

cmd_redeploy() {
  local service="${1:-}"
  info "Redeploying${service:+ $service} ..."
  check_docker
  cd_to_project

  if [[ -n "${service}" ]]; then
    info "Rebuilding image for: ${service}"
    docker compose -f "${COMPOSE_FILE}" build "${service}"
    info "Recreating container: ${service}"
    docker compose -f "${COMPOSE_FILE}" up -d --no-deps "${service}"
  else
    info "Rebuilding all changed images ..."
    docker compose -f "${COMPOSE_FILE}" build
    info "Restarting all services ..."
    docker compose -f "${COMPOSE_FILE}" up -d
  fi

  success "Redeploy complete."
}

cmd_rebuild() {
  info "Forcing full --no-cache rebuild of all images ..."
  check_docker
  cd_to_project
  docker compose -f "${COMPOSE_FILE}" build --no-cache
  docker compose -f "${COMPOSE_FILE}" up -d
  success "Full rebuild and restart complete."
}

cmd_start() {
  info "Starting all services ..."
  check_docker
  cd_to_project
  docker compose -f "${COMPOSE_FILE}" up -d
  success "Services started."
  cmd_status
}

cmd_stop() {
  info "Stopping all services (data volumes preserved) ..."
  check_docker
  cd_to_project
  docker compose -f "${COMPOSE_FILE}" down
  success "All services stopped."
}

cmd_restart() {
  local service="${1:-}"
  check_docker
  cd_to_project
  if [[ -n "${service}" ]]; then
    info "Restarting service: ${service}"
    docker compose -f "${COMPOSE_FILE}" restart "${service}"
  else
    info "Restarting all services ..."
    docker compose -f "${COMPOSE_FILE}" restart
  fi
  success "Restart complete."
}

cmd_status() {
  check_docker
  cd_to_project
  echo ""
  echo -e "${BOLD}=== Service Status ===${RESET}"
  docker compose -f "${COMPOSE_FILE}" ps
  echo ""
  echo -e "${BOLD}=== Port Map ===${RESET}"
  echo "  PostgreSQL  → http://192.168.0.101:5432"
  echo "  Redis       → http://192.168.0.101:6379"
  echo "  API         → http://192.168.0.101:3013"
  echo "  Web App     → http://192.168.0.101:3011"
  echo "  Admin       → http://192.168.0.101:3012"
  echo ""
}

cmd_logs() {
  local service="${1:-}"
  check_docker
  cd_to_project
  if [[ -n "${service}" ]]; then
    info "Tailing logs for: ${service} (Ctrl+C to exit)"
    docker compose -f "${COMPOSE_FILE}" logs -f "${service}"
  else
    info "Tailing logs for all services (Ctrl+C to exit)"
    docker compose -f "${COMPOSE_FILE}" logs -f
  fi
}

cmd_migrate() {
  info "Running Prisma migrations ..."
  check_docker
  check_env
  cd_to_project
  docker compose -f "${COMPOSE_FILE}" run --rm migrate
  success "Migrations applied."
}

cmd_backup() {
  info "Creating PostgreSQL backup ..."
  check_docker
  cd_to_project
  mkdir -p "${BACKUP_DIR}"

  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_file="${BACKUP_DIR}/trivioq_${timestamp}.sql"

  # shellcheck disable=SC1090
  source <(grep -E '^POSTGRES_(USER|DB)=' "${ENV_FILE}" 2>/dev/null || true)
  local pg_user="${POSTGRES_USER:-trivioq}"
  local pg_db="${POSTGRES_DB:-trivioq}"

  docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    pg_dump -U "${pg_user}" "${pg_db}" > "${backup_file}"

  local size
  size=$(du -sh "${backup_file}" | cut -f1)
  success "Backup saved: ${backup_file} (${size})"
  info "To restore: docker compose exec -T postgres psql -U ${pg_user} ${pg_db} < ${backup_file}"
}

cmd_shell() {
  local service="${1:-api}"
  check_docker
  cd_to_project
  info "Opening shell in container: ${service}"
  docker compose -f "${COMPOSE_FILE}" exec "${service}" sh
}

cmd_teardown() {
  warn "⚠️  This will STOP all services and DELETE all volumes (database data will be lost)."
  echo -ne "${RED}${BOLD}Type 'yes' to confirm: ${RESET}"
  read -r confirm
  if [[ "${confirm}" != "yes" ]]; then
    info "Teardown cancelled."
    exit 0
  fi
  check_docker
  cd_to_project
  docker compose -f "${COMPOSE_FILE}" down -v
  success "All services and volumes removed."
}

# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

COMMAND="${1:-help}"
SERVICE="${2:-}"

case "${COMMAND}" in
  deploy)   cmd_deploy ;;
  redeploy) cmd_redeploy "${SERVICE}" ;;
  rebuild)  cmd_rebuild ;;
  start)    cmd_start ;;
  stop)     cmd_stop ;;
  restart)  cmd_restart "${SERVICE}" ;;
  status)   cmd_status ;;
  logs)     cmd_logs "${SERVICE}" ;;
  migrate)  cmd_migrate ;;
  backup)   cmd_backup ;;
  shell)    cmd_shell "${SERVICE}" ;;
  teardown) cmd_teardown ;;
  help|--help|-h) cmd_help ;;
  *)
    error "Unknown command: ${COMMAND}"
    echo ""
    cmd_help
    exit 1
    ;;
esac
