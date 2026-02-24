#!/usr/bin/env bash
# Stop NATS and remove all volumes (JetStream data).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "Stopping NATS and removing volumes..."
docker compose down -v
echo "NATS stopped. All JetStream data removed."
