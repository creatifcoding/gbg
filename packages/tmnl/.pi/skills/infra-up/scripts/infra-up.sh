#!/usr/bin/env bash
set -euo pipefail

SERVICE=""
GROUP=""
BUILD=""
ALL=""

usage() {
  cat << 'EOF'
Usage: infra-up.sh [OPTIONS]

Start Docker containers for TMNL infrastructure.

OPTIONS:
  --service <name>   Start specific service
  --group <name>     Start service group (core, cluster, collab, access)
  --build            Build images before starting
  --all              Start all services (default: core only)
  -h, --help         Show this help

SERVICE GROUPS:
  core     postgres, durable-streams, electric
  cluster  search-cluster-coordinator, search-cluster-sources, ingestion-cluster
  collab   y-sweet, nats
  access   ssh, ngrok

EXAMPLES:
  ./infra-up.sh                          # Start core services
  ./infra-up.sh --service postgres       # Start only postgres
  ./infra-up.sh --group cluster          # Start cluster services
  ./infra-up.sh --all --build            # Build and start everything
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --service)
      SERVICE="${2:-}"
      shift 2
      ;;
    --group)
      GROUP="${2:-}"
      shift 2
      ;;
    --build)
      BUILD="--build"
      shift
      ;;
    --all)
      ALL="true"
      shift
      ;;
    *)
      echo "❌ Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker is not installed or not on PATH" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "❌ 'docker compose' is unavailable. Install Docker Compose v2 plugin." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR=""

# Candidate 1: canonical repo-relative path from skill script
CANDIDATE_1="$(cd "$SCRIPT_DIR/../../../../docker" 2>/dev/null && pwd || true)"
if [[ -n "$CANDIDATE_1" && -f "$CANDIDATE_1/docker-compose.yml" ]]; then
  DOCKER_DIR="$CANDIDATE_1"
fi

# Candidate 2: search upward from current working directory
if [[ -z "$DOCKER_DIR" ]]; then
  SEARCH_DIR="$(pwd)"
  while [[ "$SEARCH_DIR" != "/" ]]; do
    if [[ -f "$SEARCH_DIR/docker/docker-compose.yml" ]]; then
      DOCKER_DIR="$SEARCH_DIR/docker"
      break
    fi
    SEARCH_DIR="$(dirname "$SEARCH_DIR")"
  done
fi

if [[ -z "$DOCKER_DIR" || ! -f "$DOCKER_DIR/docker-compose.yml" ]]; then
  echo "❌ Could not find docker/docker-compose.yml" >&2
  exit 1
fi

if [[ -n "$SERVICE" ]]; then
  SERVICES="$SERVICE"
elif [[ -n "$GROUP" ]]; then
  case "$GROUP" in
    core) SERVICES="postgres durable-streams electric" ;;
    cluster) SERVICES="search-cluster-coordinator search-cluster-sources ingestion-cluster" ;;
    collab) SERVICES="y-sweet nats" ;;
    access) SERVICES="ssh ngrok" ;;
    *)
      echo "❌ Unknown group: $GROUP" >&2
      exit 1
      ;;
  esac
elif [[ -n "$ALL" ]]; then
  SERVICES=""
else
  SERVICES="postgres durable-streams electric"
fi

cd "$DOCKER_DIR"

echo "🚀 Starting infrastructure from: $DOCKER_DIR"
if [[ -n "$SERVICES" ]]; then
  # shellcheck disable=SC2086
  docker compose up -d $BUILD $SERVICES
else
  # shellcheck disable=SC2086
  docker compose up -d $BUILD
fi

echo ""
echo "📊 Status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
