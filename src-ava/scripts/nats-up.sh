#!/usr/bin/env bash
# Start NATS + provision all JetStream resources for AVA fusion pipeline.
# Idempotent — safe to re-run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "=== AVA NATS Infrastructure ==="
echo ""

# 1. Start NATS via docker compose
echo "[1/4] Starting NATS server..."
docker compose up -d --wait
echo "  NATS is healthy."
echo ""

# 2. Provision JetStream streams
echo "[2/4] Provisioning JetStream streams..."
bun run "$SCRIPT_DIR/provision-jetstream.ts"
echo ""

# 3. Provision KV buckets
echo "[3/4] Provisioning KV buckets..."
bun run "$SCRIPT_DIR/provision-kv.ts"
echo ""

# 4. Provision Object Store
echo "[4/4] Provisioning Object Store..."
bun run "$SCRIPT_DIR/provision-objectstore.ts"
echo ""

echo "=== NATS ready. ==="
echo "  Client:     nats://localhost:4222 (token: ava-dev-token)"
echo "  Monitoring:  http://localhost:8222"
echo "  Streams:     7 (SENSOR_KINETIC, SENSOR_RF, SENSOR_CYBER, SENSOR_OSINT, SENSOR_GEO, FUSION_RESULTS, ALARMS)"
echo "  KV Buckets:  4 (ava-config, ava-state, ava-metrics, ava-schemas)"
echo "  Object Store: 1 (ava-blobs)"
