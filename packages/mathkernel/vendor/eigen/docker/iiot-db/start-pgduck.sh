#!/bin/bash
# =============================================================================
# pgduck_server startup script
#
# Starts the DuckDB query server required by pg_lake.
# This should be run as a background process alongside PostgreSQL.
# =============================================================================

PGDUCK_SERVER=${PGDUCK_SERVER:-/usr/local/bin/pgduck_server}
SOCKET_DIR=${PGDUCK_SOCKET_DIR:-/tmp}
PORT=${PGDUCK_PORT:-5332}

if [ -x "$PGDUCK_SERVER" ]; then
    echo "Starting pgduck_server on socket ${SOCKET_DIR}:${PORT}..."
    exec "$PGDUCK_SERVER" --socket-dir="$SOCKET_DIR" --port="$PORT"
else
    echo "pgduck_server not found at $PGDUCK_SERVER - pg_lake queries will fail"
    exit 1
fi
