#!/bin/bash
set -euo pipefail

# Parse arguments
SERVICE=""
FOLLOW=""
TAIL="100"

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'EOF'
Usage: /infra:logs <service> [OPTIONS]

View logs for a specific service.

ARGUMENTS:
  <service>          Service name (required)

OPTIONS:
  --follow, -f       Follow log output (live tail)
  --tail <n>         Show last N lines (default: 100)
  -h, --help         Show this help

EXAMPLES:
  /infra:logs postgres               # Last 100 lines
  /infra:logs postgres --tail 50     # Last 50 lines
  /infra:logs postgres --follow      # Follow live
  /infra:logs postgres -f            # Follow (short)
EOF
      exit 0
      ;;
    --follow|-f)
      FOLLOW="--follow"
      shift
      ;;
    --tail)
      TAIL="$2"
      shift 2
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
  echo "Usage: /infra:logs <service> [--follow] [--tail N]" >&2
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

echo "📋 Logs for $SERVICE (last $TAIL lines)"
echo "========================================"
echo ""

docker compose logs --tail "$TAIL" $FOLLOW "$SERVICE"
