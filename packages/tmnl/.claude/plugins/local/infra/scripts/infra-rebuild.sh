#!/bin/bash
set -euo pipefail

# Parse arguments
SERVICE=""
NO_CACHE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'EOF'
Usage: /infra:rebuild <service> [OPTIONS]

Rebuild and restart a specific service container.

ARGUMENTS:
  <service>          Service name (required)

OPTIONS:
  --no-cache         Build without cache (clean rebuild)
  -h, --help         Show this help

PROCESS:
  1. Stops the service
  2. Removes the container
  3. Rebuilds the image
  4. Starts the service
  5. Shows status

EXAMPLES:
  /infra:rebuild search-cluster-coordinator           # Rebuild with cache
  /infra:rebuild search-cluster-coordinator --no-cache # Clean rebuild
  /infra:rebuild durable-streams                      # Rebuild durable-streams
EOF
      exit 0
      ;;
    --no-cache)
      NO_CACHE="--no-cache"
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      if [[ -z "$SERVICE" ]]; then
        SERVICE="$1"
      else
        echo "Unexpected argument: $1" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$SERVICE" ]]; then
  echo "❌ Service name required" >&2
  echo "Usage: /infra:rebuild <service> [--no-cache]" >&2
  exit 1
fi

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

echo "🔄 Rebuilding $SERVICE..."
echo ""

echo "1️⃣  Stopping $SERVICE..."
docker compose stop "$SERVICE" || true

echo "2️⃣  Removing container..."
docker compose rm -f "$SERVICE" || true

echo "3️⃣  Rebuilding image..."
docker compose build $NO_CACHE "$SERVICE"

echo "4️⃣  Starting $SERVICE..."
docker compose up -d "$SERVICE"

echo ""
echo "📊 Status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}\t{{.Ports}}" "$SERVICE"

echo ""
echo "✅ Rebuild complete"
