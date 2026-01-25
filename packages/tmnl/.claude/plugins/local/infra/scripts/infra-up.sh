#!/bin/bash
set -euo pipefail

# Parse arguments (ralph-loop pattern)
SERVICE=""
BUILD=""
ALL=""
GROUP=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'EOF'
Usage: /infra:up [OPTIONS]

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
  /infra:up                        # Start core services
  /infra:up --service postgres     # Start only postgres
  /infra:up --group cluster        # Start cluster services
  /infra:up --all --build          # Build and start everything
EOF
      exit 0
      ;;
    --service)
      SERVICE="$2"
      shift 2
      ;;
    --group)
      GROUP="$2"
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
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Find docker directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(cd "$SCRIPT_DIR/../../../../../docker" 2>/dev/null && pwd)" || DOCKER_DIR=""

if [[ -z "$DOCKER_DIR" ]] || [[ ! -f "$DOCKER_DIR/docker-compose.yml" ]]; then
  # Fallback: search from current directory
  SEARCH_DIR="$(pwd)"
  while [[ "$SEARCH_DIR" != "/" ]]; do
    if [[ -f "$SEARCH_DIR/docker/docker-compose.yml" ]]; then
      DOCKER_DIR="$SEARCH_DIR/docker"
      break
    fi
    SEARCH_DIR="$(dirname "$SEARCH_DIR")"
  done
fi

if [[ ! -f "$DOCKER_DIR/docker-compose.yml" ]]; then
  echo "❌ Could not find docker-compose.yml" >&2
  exit 1
fi

cd "$DOCKER_DIR"

# Determine services to start
if [[ -n "$SERVICE" ]]; then
  SERVICES="$SERVICE"
elif [[ -n "$GROUP" ]]; then
  case $GROUP in
    core) SERVICES="postgres durable-streams electric" ;;
    cluster) SERVICES="search-cluster-coordinator search-cluster-sources ingestion-cluster" ;;
    collab) SERVICES="y-sweet nats" ;;
    access) SERVICES="ssh ngrok" ;;
    *) echo "❌ Unknown group: $GROUP" >&2; exit 1 ;;
  esac
elif [[ -n "$ALL" ]]; then
  SERVICES=""
else
  # Default to core services
  SERVICES="postgres durable-streams electric"
fi

# Execute docker compose
echo "🚀 Starting infrastructure..."
if [[ -n "$SERVICES" ]]; then
  docker compose up -d $BUILD $SERVICES
else
  docker compose up -d $BUILD
fi

# Show status
echo ""
echo "📊 Status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
