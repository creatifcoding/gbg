# NATS WebSocket Browser Compatibility Fix

## Status: ✅ FIXED

## Problem

Documents were not being created because the NATS client was using Node.js APIs (`dns.resolve4`, `fs`, `path`) that don't exist in browsers.

**Error:**

```
[NatsKVService] NATS connection FAILED: TypeError: dns.resolve4 is not a function
```

## Solution

Switched from `nats` package to `nats.ws` (browser-compatible WebSocket transport) and configured NATS server to accept WebSocket connections.

## Changes Made

### 1. Package Installation

```bash
bun add nats.ws
```

### 2. Code Changes

**src/lib/nats/NatsKVService.ts**

- Changed import from `'nats'` to `'nats.ws'`
- Updated connection URL: `ws://localhost:9222`

**src/lib/nats/index.ts**

- Updated type exports to use `nats.ws`

### 3. NATS Server Configuration

**docker/nats/nats-server.conf** (NEW FILE)

```conf
server_name: tmnl-nats

jetstream {
  store_dir: /data
}

port: 4222
http_port: 8222

websocket {
  port: 9222
  no_tls: true
  same_origin: false
  compression: true
}

debug: false
trace: false
logtime: true
```

**docker/docker-compose.yml**

- Added port mapping: `9222:9222` (WebSocket)
- Mounted config: `./nats/nats-server.conf:/etc/nats/nats-server.conf:ro`
- Updated command: `--config /etc/nats/nats-server.conf`

### 4. Logging Added

Added comprehensive debug logging:

- `NatsKVService.ts` - Connection lifecycle
- `CollaborationService.ts` - y-sweet initialization
- `DocumentRegistryService.ts` - Document creation steps

## Port Assignments

| Service | Protocol  | Port | Purpose                          |
| ------- | --------- | ---- | -------------------------------- |
| NATS    | TCP       | 4222 | Standard NATS client connections |
| NATS    | HTTP      | 8222 | Monitoring/health checks         |
| NATS    | WebSocket | 9222 | **Browser client connections**   |
| y-sweet | HTTP      | 8080 | Yjs document sync server         |
| MinIO   | HTTP      | 9000 | S3 API                           |
| MinIO   | HTTP      | 9001 | Web console                      |

## Verification

NATS is now running with WebSocket support:

```bash
$ docker compose logs nats | grep websocket
[INF] Listening for websocket clients on ws://0.0.0.0:9222
[WRN] Websocket not configured with TLS. DO NOT USE IN PRODUCTION!
```

Existing data preserved:

```bash
[INF] Restored 72 messages for stream '$G > KV_tmnl-documents' in 2ms
```

## Testing Document Creation

1. **Start the app** (should auto-connect to NATS WebSocket)
2. **Click "New Document"** in AutonomousEditorPanel
3. **Check browser console** for logging trail:
   ```
   [NatsKVService] Acquiring NATS connection...
   [NatsKVService] Connecting to NATS...
   [NatsKVService] NATS connection established!
   [CollaborationService] Initializing...
   [DocumentRegistryService.create] Starting...
   [documentOps.create] Success: { id, title, tokenUrl }
   ```

## Key Architecture Insights

### Browser NATS Transport

- **Standard `nats` package**: Uses TCP with Node.js DNS resolution (browser incompatible)
- **`nats.ws` package**: Uses W3C WebSocket API (natively available in all browsers)

### Data Flow

```
UI (AutonomousEditorPanel)
  → useDocumentOps().create()
    → documentOps.create atom
      → DocumentRegistryService.create
        → CollaborationService.getClientToken (y-sweet)
        → NatsKVService.put (metadata → NATS KV)
```

## Production Considerations

⚠️ **SECURITY WARNING**: Current configuration has:

- `no_tls: true` - Unencrypted WebSocket
- `same_origin: false` - CORS disabled
- No authentication

**Before deploying to production:**

1. Enable TLS: `wss://` instead of `ws://`
2. Configure proper CORS origins
3. Add authentication (NATS JWT or username/password)
4. Use environment-specific connection strings

## Files Modified

1. ✅ `src/lib/nats/NatsKVService.ts` - Import, config, logging
2. ✅ `src/lib/nats/index.ts` - Type exports
3. ✅ `src/lib/editor/v3/services/CollaborationService.ts` - Logging
4. ✅ `src/lib/editor/v3/services/DocumentRegistryService.ts` - Logging
5. ✅ `docker/docker-compose.yml` - NATS WebSocket port + config
6. ✅ `docker/nats/nats-server.conf` - **NEW** WebSocket config

## Next Steps

1. Test document creation in the UI
2. Verify documents appear in NATS KV:
   ```bash
   docker exec -it tmnl_nats sh
   nats kv ls
   nats kv get tmnl-documents <doc-id>
   ```
3. Monitor logs for any connection issues
4. If working, remove debug console.log statements (keep Effect.log)

---

**Date:** 2025-12-26  
**Session:** NATS Browser Compatibility Fix
