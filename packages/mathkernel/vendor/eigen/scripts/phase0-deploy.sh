#!/usr/bin/env bash
# TMNL Phase 0 Foundation Deployment
# Deploys NATS + PostgreSQL to k3d cluster

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         TMNL Phase 0 Foundation Deployment                     ║"
echo "║         NATS + PostgreSQL + JetStream + Extensions             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."
command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl not found"; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "❌ helm not found"; exit 1; }
kubectl cluster-info >/dev/null 2>&1 || { echo "❌ No k8s cluster accessible"; exit 1; }

echo "✅ Prerequisites met"
echo ""

# Deploy NATS
echo "🚀 Deploying NATS cluster..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

kubectl create namespace nats 2>/dev/null || echo "  → Namespace 'nats' already exists"

helm repo add nats https://nats-io.github.io/k8s/helm/charts/ 2>/dev/null || true
helm repo update nats

helm upgrade --install nats nats/nats \
  -f nix/modules/nats/values.yaml \
  -n nats \
  --wait \
  --timeout 5m

echo "✅ NATS deployed"
echo ""

# Deploy PostgreSQL
echo "🚀 Deploying PostgreSQL..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

kubectl create namespace data 2>/dev/null || echo "  → Namespace 'data' already exists"

# Create ConfigMap with init script
kubectl create configmap postgres-init \
  -n data \
  --from-file=init-extensions.sql=nix/modules/postgres/init-extensions.sql \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f nix/modules/postgres/statefulset.yaml

echo "⏳ Waiting for PostgreSQL to be ready (max 5 minutes)..."
kubectl wait --for=condition=ready pod -l app=postgres -n data --timeout=300s || {
  echo "⚠️  Timeout waiting for PostgreSQL. Check: kubectl get pods -n data"
  exit 1
}

echo "✅ PostgreSQL deployed"
echo ""

# Verification
echo "🔍 Verifying deployment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📊 NATS Pods:"
kubectl get pods -n nats

echo ""
echo "📊 PostgreSQL Pods:"
kubectl get pods -n data

echo ""
echo "🎉 Phase 0 Foundation Deployed Successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next steps:"
echo "  1. Test NATS:        nats-test"
echo "  2. Test PostgreSQL:  postgres-test"
echo "  3. NATS shell:       nats-shell"
echo "  4. PostgreSQL shell: postgres-shell"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
