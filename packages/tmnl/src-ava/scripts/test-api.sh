#!/bin/bash
# AVA API Test Script
# Tests both REST and gRPC endpoints
#
# Prerequisites:
#   - Server running: cargo run --package ava-api --bin ava-server
#   - curl (for REST)
#   - grpcurl (for gRPC): go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest
#
# Usage:
#   ./scripts/test-api.sh

set -e

REST_BASE="http://localhost:3000/api/v1"
GRPC_ADDR="localhost:50051"

echo "=========================================="
echo "AVA API Test Suite"
echo "=========================================="
echo ""

# Check if server is running
if ! curl -s "$REST_BASE/views" > /dev/null 2>&1; then
    echo "ERROR: Server not running. Start it with:"
    echo "  cd src-ava && nix develop --command cargo run --package ava-api --bin ava-server"
    exit 1
fi

echo "✓ Server is running"
echo ""

# ==========================================
# REST API Tests
# ==========================================

echo "=========================================="
echo "REST API Tests"
echo "=========================================="
echo ""

# Test: List views (should be empty)
echo "1. GET /views (list all views)"
curl -s "$REST_BASE/views" | jq .
echo ""

# Test: Register a view
echo "2. POST /views (register a view)"
VIEW_RESPONSE=$(curl -s -X POST "$REST_BASE/views" \
    -H "Content-Type: application/json" \
    -d '{
        "id": "test-view-001",
        "name": "Test View",
        "description": "A test view for validation",
        "assemblage_id": "test-assemblage",
        "channels": [
            {
                "id": "state",
                "role": "STATE",
                "source_connection": "memory://test",
                "materialization": "CACHED"
            }
        ],
        "overwrite_existing": false
    }')
echo "$VIEW_RESPONSE" | jq .
VIEW_ID=$(echo "$VIEW_RESPONSE" | jq -r '.view_id')
echo ""

# Test: List views (should have one)
echo "3. GET /views (verify view was created)"
curl -s "$REST_BASE/views" | jq .
echo ""

# Test: Get spec
echo "4. GET /views/$VIEW_ID/spec (get view spec)"
curl -s "$REST_BASE/views/$VIEW_ID/spec" | jq .
echo ""

# Test: Get status
echo "5. GET /views/$VIEW_ID/status (get view status)"
curl -s "$REST_BASE/views/$VIEW_ID/status" | jq .
echo ""

# Test: Invalidate
echo "6. POST /views/$VIEW_ID/invalidate (invalidate view)"
curl -s -X POST "$REST_BASE/views/$VIEW_ID/invalidate" \
    -H "Content-Type: application/json" \
    -d '{"reason": "Testing invalidation"}' | jq .
echo ""

# Test: 404 for non-existent view
echo "7. GET /views/non-existent/spec (should return 404)"
curl -s -w "\nHTTP Status: %{http_code}\n" "$REST_BASE/views/non-existent/spec" | head -10
echo ""

# Test: Conflict on duplicate registration
echo "8. POST /views (attempt duplicate - should return 409)"
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$REST_BASE/views" \
    -H "Content-Type: application/json" \
    -d '{
        "id": "test-view-001",
        "name": "Test View Duplicate",
        "assemblage_id": "test",
        "channels": [],
        "overwrite_existing": false
    }' | head -10
echo ""

# ==========================================
# gRPC API Tests (if grpcurl available)
# ==========================================

if command -v grpcurl &> /dev/null; then
    echo "=========================================="
    echo "gRPC API Tests"
    echo "=========================================="
    echo ""

    # List services
    echo "1. List gRPC services"
    grpcurl -plaintext $GRPC_ADDR list || echo "(reflection may not be enabled)"
    echo ""

    # Note: Full gRPC testing requires reflection or proto files
    echo "Note: For full gRPC testing, use:"
    echo "  grpcurl -plaintext -import-path ./proto -proto ava/services/v1/services.proto $GRPC_ADDR describe"
    echo ""
else
    echo "=========================================="
    echo "gRPC Tests Skipped"
    echo "=========================================="
    echo "grpcurl not installed. Install with:"
    echo "  go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest"
    echo ""
fi

echo "=========================================="
echo "All REST tests completed!"
echo "=========================================="
