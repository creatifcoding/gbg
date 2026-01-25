#!/bin/bash
set -euo pipefail

# Parse arguments
SERVICE=""
FORMAT="table"
RESOURCES=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'EOF'
Usage: /infra:status [OPTIONS]

Show status and health of Docker containers.

OPTIONS:
  --service <name>   Check specific service
  --json             Output as JSON (for programmatic use)
  --resources        Include resource usage (CPU/MEM)
  -h, --help         Show this help

EXAMPLES:
  /infra:status                      # All containers (table)
  /infra:status --json               # Machine-readable output
  /infra:status --json --resources   # Include CPU/MEM stats
  /infra:status --service postgres   # Just postgres
EOF
      exit 0
      ;;
    --service)
      SERVICE="$2"
      shift 2
      ;;
    --json)
      FORMAT="json"
      shift
      ;;
    --resources)
      RESOURCES="true"
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

# Collect container data
collect_status() {
  local svc_filter="${1:-}"

  if [[ -n "$svc_filter" ]]; then
    docker compose ps --format json "$svc_filter" 2>/dev/null || echo "[]"
  else
    docker compose ps --format json 2>/dev/null || echo "[]"
  fi
}

# Collect resource stats
collect_resources() {
  docker stats --no-stream --format '{"name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","net":"{{.NetIO}}"}' 2>/dev/null | jq -s '.' || echo "[]"
}

# Get network connection count
get_network_connections() {
  docker network inspect tmnl 2>/dev/null | jq '.[0].Containers | length' || echo "0"
}

if [[ "$FORMAT" == "json" ]]; then
  # JSON output for programmatic consumption
  STATUS_DATA=$(collect_status "$SERVICE")

  if [[ -n "$RESOURCES" ]]; then
    RESOURCE_DATA=$(collect_resources)
    NET_CONNS=$(get_network_connections)

    # Merge status with resources
    jq -n \
      --argjson status "$STATUS_DATA" \
      --argjson resources "$RESOURCE_DATA" \
      --arg connections "$NET_CONNS" \
      '{
        containers: $status,
        resources: $resources,
        network_connections: ($connections | tonumber),
        collected_at: now | todate
      }'
  else
    jq -n \
      --argjson status "$STATUS_DATA" \
      '{
        containers: $status,
        collected_at: now | todate
      }'
  fi
else
  # Table output (human-readable fallback)
  echo "📊 Infrastructure Status"
  echo "========================"
  echo ""

  if [[ -n "$SERVICE" ]]; then
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}\t{{.Ports}}" "$SERVICE"
  else
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}\t{{.Ports}}"
  fi

  if [[ -n "$RESOURCES" ]]; then
    echo ""
    echo "📈 Resource Usage"
    echo "-----------------"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
  fi
fi
