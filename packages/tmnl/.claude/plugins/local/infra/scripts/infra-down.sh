#!/bin/bash
set -euo pipefail

# Parse arguments
SERVICE=""
GROUP=""
VOLUMES=""
ALL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'EOF'
Usage: /infra:down [OPTIONS]

Stop Docker containers for TMNL infrastructure.

OPTIONS:
  --service <name>   Stop specific service
  --group <name>     Stop service group (core, cluster, collab, access)
  --volumes          Also remove volumes (⚠️ DATA LOSS!)
  --all              Stop all services
  -h, --help         Show this help

SERVICE GROUPS:
  core     postgres, durable-streams, electric
  cluster  search-cluster-coordinator, search-cluster-sources, ingestion-cluster
  collab   y-sweet, nats
  access   ssh, ngrok

EXAMPLES:
  /infra:down                        # Stop core services
  /infra:down --service postgres     # Stop only postgres
  /infra:down --all                  # Stop everything
  /infra:down --all --volumes        # Stop and remove all data
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
    --volumes)
      VOLUMES="-v"
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

# Determine services to stop
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

# Warning for volumes
if [[ -n "$VOLUMES" ]]; then
  echo "⚠️  WARNING: Removing volumes will delete all data!"
  echo ""
fi

# Execute docker compose
echo "🛑 Stopping infrastructure..."
if [[ -n "$SERVICES" ]]; then
  docker compose stop $SERVICES
  docker compose rm -f $SERVICES
else
  docker compose down $VOLUMES
fi

echo ""
echo "✅ Done"
