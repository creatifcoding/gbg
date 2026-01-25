# Y-Sweet Service

## Purpose

Yjs CRDT document synchronization server. Powers real-time collaborative editing with automatic conflict resolution.

## Configuration

| Property | Value |
|----------|-------|
| Image | `jamsocket/y-sweet:latest` |
| Port | 8080 |
| Volume | `y-sweet-data` |
| Health | TCP port check |

## Dependencies

- **None** (independent service)

## Dependents

- Collaborative editor
- Real-time document sync
- Multiplayer features

## How It Works

1. Client creates/joins a document room
2. Y-Sweet syncs Yjs updates between clients
3. CRDT ensures eventual consistency without conflicts
4. Document state persisted to disk

## Commands

```bash
# View logs
docker compose logs -f y-sweet

# Check health
curl http://localhost:8080/health

# List active rooms (if API enabled)
curl http://localhost:8080/rooms
```

## Environment Variables

```yaml
Y_SWEET_PORT: 8080
Y_SWEET_STORE: /data
# Optional authentication
Y_SWEET_AUTH_KEY: your-secret-key
```

## Health Check

```yaml
healthcheck:
  test: ["CMD", "nc", "-z", "localhost", "8080"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Client Integration

### React (y-sweet)

```typescript
import { YDocProvider, useYDoc } from '@y-sweet/react'

function App() {
  return (
    <YDocProvider
      url="ws://localhost:8080"
      docId="my-document"
    >
      <Editor />
    </YDocProvider>
  )
}

function Editor() {
  const doc = useYDoc()
  const text = doc.getText('content')

  // Real-time sync happens automatically
}
```

### Vanilla Yjs

```typescript
import * as Y from 'yjs'
import { YSweetProvider } from '@y-sweet/client'

const doc = new Y.Doc()
const provider = new YSweetProvider(
  'ws://localhost:8080',
  'my-document',
  doc
)

// Awareness for cursors/presence
provider.awareness.setLocalState({
  user: { name: 'Alice', color: '#ff0000' }
})
```

## Document Structure

Y-Sweet stores Yjs documents with:
- Full document state
- Update history
- Awareness (presence) data

```
/data/
├── documents/
│   ├── doc-id-1.yjs
│   ├── doc-id-2.yjs
│   └── ...
└── metadata/
```

## Common Issues

### Connection drops

1. Check Y-Sweet is running:
   ```bash
   docker compose ps y-sweet
   ```

2. Check WebSocket connectivity:
   ```bash
   wscat -c ws://localhost:8080
   ```

### Sync conflicts

Yjs CRDTs should auto-resolve, but if issues:
- Check client Yjs versions match
- Ensure single provider per doc
- Review awareness state

### Document not persisting

1. Check volume mount:
   ```bash
   docker compose exec y-sweet ls /data
   ```

2. Check permissions:
   ```bash
   docker compose exec y-sweet ls -la /data
   ```

### High memory with many documents

- Implement document cleanup for inactive rooms
- Consider document archival strategy
- Scale horizontally for many concurrent docs

## Authentication

For production, enable auth:

```yaml
environment:
  Y_SWEET_AUTH_KEY: your-secret-key
```

Client must include token:
```typescript
const provider = new YSweetProvider(
  'ws://localhost:8080',
  'my-document',
  doc,
  { token: 'your-auth-token' }
)
```

## Scaling

Y-Sweet can scale horizontally with:
- Redis for pub/sub between instances
- S3/MinIO for document storage
- Load balancer with sticky sessions

## Integration with Electric

For hybrid sync (CRDT + Postgres):

1. Y-Sweet handles real-time collaboration
2. On save, serialize Yjs doc to JSON
3. Store in Postgres via Electric
4. Electric syncs to other clients
5. On load, initialize Yjs from JSON

This provides both real-time collab and persistent storage.
