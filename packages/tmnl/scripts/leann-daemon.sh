#!/usr/bin/env bash
# LEANN Embedding Server Daemon
# Pre-warms the contriever model for fast searches

export LD_LIBRARY_PATH="/nix/store/xm08aqdd7pxcdhm0ak6aqb1v7hw5q6ri-gcc-14.3.0-lib/lib:/nix/store/8icpg7vrz95c6ap3mznmlmg7h0l2av1w-zlib-1.3.1/lib:$LD_LIBRARY_PATH"

INDEX_PATH="${1:-.leann/indexes/tmnl-codebase}"
ZMQ_PORT="${2:-5555}"

echo "Starting LEANN embedding server on port $ZMQ_PORT..."
echo "Index: $INDEX_PATH"
echo "Model: facebook/contriever"
echo ""
echo "Kill with: pkill -f 'hnsw_embedding_server.*$ZMQ_PORT'"

exec python -m leann_backend_hnsw.hnsw_embedding_server \
  --zmq-port "$ZMQ_PORT" \
  --model-name facebook/contriever \
  --passages-file "$INDEX_PATH/documents.leann.meta.json" \
  --distance-metric mips
