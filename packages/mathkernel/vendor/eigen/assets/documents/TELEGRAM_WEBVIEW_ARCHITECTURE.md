# TMNL Telegram WebView Architecture

> Comprehensive guide to the ngrok tunneling, durable streams, and Telegram WebView integration.

## System Overview

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                              THE OUTSIDE WORLD                                     ║
║                                                                                    ║
║     ┌─────────────────────┐         ┌─────────────────────┐                       ║
║     │   📱 TELEGRAM APP   │         │   🌍 WEB BROWSER    │                       ║
║     │   (Mobile/Desktop)  │         │   (Dev/Debug)       │                       ║
║     └─────────┬───────────┘         └─────────┬───────────┘                       ║
║               │                               │                                    ║
║               │ Bot Commands                  │ Direct Access                      ║
║               │ /blocks, /block info          │ (when tunneled)                    ║
║               │                               │                                    ║
║               ▼                               ▼                                    ║
║     ┌─────────────────────────────────────────────────────────┐                   ║
║     │                    TELEGRAM SERVERS                      │                   ║
║     │              api.telegram.org (Bot API)                  │                   ║
║     │         ┌─────────────────────────────────┐              │                   ║
║     │         │         WebView iframe          │              │                   ║
║     │         │   "Open in TMNL" button opens   │              │                   ║
║     │         │      ↓ via ngrok tunnel ↓       │              │                   ║
║     │         └─────────────────────────────────┘              │                   ║
║     └─────────────────────────┬───────────────────────────────┘                   ║
║                               │                                                    ║
╚═══════════════════════════════│════════════════════════════════════════════════════╝
                                │
     ══════════════════════════════════════════════════════════════
                          ☁️ NGROK EDGE ☁️
     ══════════════════════════════════════════════════════════════
                                │
                    ┌───────────┴───────────┐
                    │   ngrok tunnels (x3)  │
                    │                       │
          ┌─────────┴────┐    ┌─────┴─────┐    ┌──────┴──────┐
          │  :5173       │    │  :4437    │    │  :2222      │
          │  TMNL Web    │    │  Durable  │    │  SSH        │
          │  (Vite)      │    │  Streams  │    │  (Dev)      │
          └──────┬───────┘    └─────┬─────┘    └──────┬──────┘
                 │                  │                  │
╔════════════════│══════════════════│══════════════════│═════════════════╗
║                │       WSL2 / LOCAL MACHINE          │                 ║
║                │                                     │                 ║
║    ┌───────────▼───────────────────────────────────────────────────┐  ║
║    │                      DOCKER COMPOSE                           │  ║
║    │  ┌─────────────────────────────────────────────────────────┐  │  ║
║    │  │                    NGROK SERVICE                        │  │  ║
║    │  │  tunnels:                                               │  │  ║
║    │  │    tmnl:    http://host.docker.internal:5173           │  │  ║
║    │  │    streams: http://host.docker.internal:4437           │  │  ║
║    │  │    ssh:     tcp://host.docker.internal:2222            │  │  ║
║    │  │                                                         │  │  ║
║    │  │  webhook → ngrok-notify (env update)                   │  │  ║
║    │  └─────────────────────────────────────────────────────────┘  │  ║
║    │                                                               │  ║
║    │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │  ║
║    │  │    MinIO     │  │    NATS      │  │     y-sweet        │  │  ║
║    │  │   :9000      │  │   :4222      │  │     :8080          │  │  ║
║    │  │   :9001 UI   │  │   :8222 mon  │  │  (Yjs sync CRDT)   │  │  ║
║    │  │              │  │              │  │                    │  │  ║
║    │  │  S3-compat   │  │  Pub/Sub     │  │  Collaborative     │  │  ║
║    │  │  blob store  │  │  messaging   │  │  document sync     │  │  ║
║    │  └──────────────┘  └──────────────┘  └────────────────────┘  │  ║
║    │                                                               │  ║
║    │  ┌────────────────────────────────────────────────────────┐  │  ║
║    │  │              durable-streams-server                    │  │  ║
║    │  │                     :4437                              │  │  ║
║    │  │                                                        │  │  ║
║    │  │  ┌────────────────────────────────────────────────┐   │  │  ║
║    │  │  │              Effect-TS Stack                   │   │  │  ║
║    │  │  │  ┌─────────────┐    ┌─────────────────────┐   │   │  │  ║
║    │  │  │  │  HttpApi    │    │   StreamStore       │   │   │  │  ║
║    │  │  │  │  /v1/stream │───▶│   Effect.Service    │   │   │  │  ║
║    │  │  │  └─────────────┘    └──────────┬──────────┘   │   │  │  ║
║    │  │  │                                │               │   │  │  ║
║    │  │  │                     ┌──────────▼──────────┐   │   │  │  ║
║    │  │  │                     │  SQLite WAL         │   │   │  │  ║
║    │  │  │                     │  ~/.local/share/    │   │   │  │  ║
║    │  │  │                     │  tmnl/durable-      │   │   │  │  ║
║    │  │  │                     │  streams.db         │   │   │  │  ║
║    │  │  │                     └─────────────────────┘   │   │  │  ║
║    │  │  └────────────────────────────────────────────────┘   │  │  ║
║    │  └────────────────────────────────────────────────────────┘  │  ║
║    └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║    ┌───────────────────────────────────────────────────────────────┐  ║
║    │                     LOCAL PROCESSES (Bun)                     │  ║
║    │                                                               │  ║
║    │   ┌─────────────────────┐    ┌─────────────────────────────┐ │  ║
║    │   │   telegram-agent    │    │      TMNL Vite Dev          │ │  ║
║    │   │   (Bun runtime)     │    │         :5173               │ │  ║
║    │   │                     │    │                             │ │  ║
║    │   │  ┌───────────────┐  │    │  React + Tauri + tldraw    │ │  ║
║    │   │  │ Grammy Bot    │  │    │  + AG-Grid + Effect-TS     │ │  ║
║    │   │  │ @tmnl_tunnel  │  │    │                             │ │  ║
║    │   │  │ _bot          │  │    │  ┌──────────────────────┐  │ │  ║
║    │   │  └───────┬───────┘  │    │  │   BlockEditorView    │  │ │  ║
║    │   │          │          │    │  │   (WebView target)   │  │ │  ║
║    │   │  ┌───────▼───────┐  │    │  │                      │  │ │  ║
║    │   │  │ Block Commands│  │    │  │  - effect-atom state │  │ │  ║
║    │   │  │ /blocks       │  │    │  │  - Atom.family per   │  │ │  ║
║    │   │  │ /block info   │  │    │  │    chatId            │  │ │  ║
║    │   │  │ /block create │  │    │  │  - Durable stream    │  │ │  ║
║    │   │  └───────┬───────┘  │    │  │    persistence       │  │ │  ║
║    │   │          │          │    │  └──────────────────────┘  │ │  ║
║    │   │          │          │    │                             │ │  ║
║    │   │   chatBlockOps ─────┼────┼──▶ Atom.family(chatId)     │ │  ║
║    │   │   (per-chat atoms)  │    │                             │ │  ║
║    │   │          │          │    └─────────────────────────────┘ │  ║
║    │   │          │          │                                    │  ║
║    │   │          ▼          │                                    │  ║
║    │   │   DurableBlockStream│                                    │  ║
║    │   │   (HTTP client) ────┼──────▶ :4437 durable-streams      │  ║
║    │   │                     │                                    │  ║
║    │   └─────────────────────┘                                    │  ║
║    └───────────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## Data Flow Sequences

### Sequence 1: Telegram Bot Command → Durable Persistence

```
┌────────────┐      ┌────────────┐      ┌────────────┐      ┌────────────┐
│  Telegram  │      │  telegram  │      │  Durable   │      │   SQLite   │
│    User    │      │   agent    │      │  Streams   │      │    WAL     │
└─────┬──────┘      └─────┬──────┘      └─────┬──────┘      └─────┬──────┘
      │                   │                   │                   │
      │  /block create    │                   │                   │
      │  "My First Block" │                   │                   │
      │──────────────────▶│                   │                   │
      │                   │                   │                   │
      │                   │ POST /v1/stream   │                   │
      │                   │ /chat-{chatId}    │                   │
      │                   │──────────────────▶│                   │
      │                   │                   │                   │
      │                   │                   │ INSERT INTO       │
      │                   │                   │ stream_entries    │
      │                   │                   │──────────────────▶│
      │                   │                   │                   │
      │                   │   { offset: 42 }  │◀──────────────────│
      │                   │◀──────────────────│                   │
      │                   │                   │                   │
      │ "Block created!   │                   │                   │
      │  ID: abc123"      │                   │                   │
      │◀──────────────────│                   │                   │
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
```

### Sequence 2: WebView Opens → State Hydration

```
┌────────────┐      ┌────────────┐      ┌────────────┐      ┌────────────┐
│  Telegram  │      │   ngrok    │      │  TMNL Web  │      │  Durable   │
│  WebView   │      │   tunnel   │      │   :5173    │      │  Streams   │
└─────┬──────┘      └─────┬──────┘      └─────┬──────┘      └─────┬──────┘
      │                   │                   │                   │
      │ iframe loads      │                   │                   │
      │ https://xyz.ngrok │                   │                   │
      │ .io/blocks/123    │                   │                   │
      │──────────────────▶│                   │                   │
      │                   │                   │                   │
      │                   │ proxy to          │                   │
      │                   │ localhost:5173    │                   │
      │                   │──────────────────▶│                   │
      │                   │                   │                   │
      │                   │                   │ GET /v1/stream    │
      │                   │                   │ /chat-{chatId}    │
      │                   │                   │ ?offset=-1        │
      │                   │                   │──────────────────▶│
      │                   │                   │                   │
      │                   │                   │  { entries: [...] │
      │                   │                   │    blocks data }  │
      │                   │                   │◀──────────────────│
      │                   │                   │                   │
      │                   │ React hydrates    │                   │
      │                   │ BlockEditorView   │                   │
      │                   │◀──────────────────│                   │
      │                   │                   │                   │
      │ Rich block editor │                   │                   │
      │ with full state!  │                   │                   │
      │◀──────────────────│                   │                   │
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
```

---

## Operations Playbook

### Starting the Stack

```bash
# 1. Start Docker services (MinIO, NATS, y-sweet, ngrok)
docker compose -f docker/docker-compose.yml up -d

# 2. Start Durable Streams Server (background)
pueue add "bun run durable:server"

# 3. Start Telegram Agent with durable stream URL
pueue add "DURABLE_STREAM_URL=http://127.0.0.1:4437 bun run telegram:agent"

# 4. Start TMNL Web (Vite dev)
pueue add "bun run dev"

# 5. Get ngrok URLs
docker compose -f docker/docker-compose.yml logs ngrok | grep "url="
```

### Health Check Matrix

| Service | Check Command |
|---------|---------------|
| Durable Streams | `curl http://127.0.0.1:4437/health` |
| NATS | `curl http://127.0.0.1:8222/varz` |
| MinIO | `curl http://127.0.0.1:9000/minio/health/live` |
| y-sweet | `curl http://127.0.0.1:8080/health` |
| ngrok tunnels | `curl http://127.0.0.1:4040/api/tunnels` |
| Telegram Bot | Check pueue logs |
| TMNL Web | `curl http://127.0.0.1:5173` |

### Stopping the Stack

```bash
# Stop Docker services
docker compose -f docker/docker-compose.yml down

# Kill background processes
pueue kill --all
```

---

## ngrok Tunnel Architecture

```
   LOCAL                           INTERNET

   :5173 ─────────┐
   (Vite)         │
                  │    ┌────────────────────────────┐
                  ├───▶│  ngrok agent container     │
   :4437 ─────────┤    │                            │
   (Streams)      │    │  Reads ngrok.yml config:   │
                  │    │  - authtoken from env      │
   :2222 ─────────┤    │  - tunnels definition      │
   (SSH)          │    │  - webhook to ngrok-notify │
                  │    │                            │
                  │    │  Creates secure tunnels    │
                  └───▶│  with *.ngrok-free.app    │
                       └──────────────┬─────────────┘
                                      │
                       ┌──────────────▼─────────────┐
                       │  ngrok-notify container    │
                       │                            │
                       │  Receives webhook on       │
                       │  tunnel creation           │
                       │                            │
                       │  Writes URLs to:           │
                       │  docker/.env               │
                       │  ├─ NGROK_URL_TMNL=...    │
                       │  ├─ NGROK_URL_STREAMS=... │
                       │  └─ NGROK_URL_SSH=...     │
                       │                            │
                       │  (For other services to    │
                       │   read and use)            │
                       └────────────────────────────┘
```

### Tunnel Configuration

Located in `docker/ngrok/ngrok.yml`:

```yaml
version: "3"
agent:
  authtoken: ${NGROK_AUTHTOKEN}

tunnels:
  tmnl:
    proto: http
    addr: host.docker.internal:5173
    inspect: true

  durable-streams:
    proto: http
    addr: host.docker.internal:4437
    inspect: true

  ssh:
    proto: tcp
    addr: host.docker.internal:2222
```

---

## Per-Chat State Isolation

### The Atom.family Pattern

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│   Chat 123456          Chat 789012          Chat 345678       │
│   ┌─────────┐          ┌─────────┐          ┌─────────┐      │
│   │ Blocks  │          │ Blocks  │          │ Blocks  │      │
│   │ ├─ A    │          │ ├─ X    │          │ ├─ P    │      │
│   │ ├─ B    │          │ ├─ Y    │          │ ├─ Q    │      │
│   │ └─ C    │          │ └─ Z    │          │ └─ R    │      │
│   └────┬────┘          └────┬────┘          └────┬────┘      │
│        │                    │                    │            │
│        ▼                    ▼                    ▼            │
│   chatBlockOps(123456) chatBlockOps(789012) chatBlockOps(...) │
│        │                    │                    │            │
│        └────────────────────┼────────────────────┘            │
│                             │                                  │
│                             ▼                                  │
│              ┌──────────────────────────────┐                 │
│              │     Atom.family(chatId)      │                 │
│              │                              │                 │
│              │  Creates isolated atom       │                 │
│              │  instance per chatId         │                 │
│              │                              │                 │
│              │  No cross-chat pollution     │                 │
│              │  Each user sees their own    │                 │
│              │  block state only            │                 │
│              └──────────────────────────────┘                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Code Pattern

```typescript
// src/lib/blocks/atoms/index.ts
import { Atom } from '@effect-atom/atom-react'

// Per-chat block snapshot atom (Atom.family pattern)
export const chatBlockSnapshotAtom = Atom.family((chatId: number) =>
  Atom.make<BlockSnapshot>({ blocks: [], lastOffset: '-1' })
)

// Per-chat operations
export const chatBlockOps = (chatId: number) => ({
  getSnapshot: () => Atom.get(chatBlockSnapshotAtom(chatId)),
  setSnapshot: (snapshot: BlockSnapshot) =>
    Atom.set(chatBlockSnapshotAtom(chatId), snapshot),
})
```

---

## Resumable Streams

### Durable Persistence Flow

```
   Time ──────────────────────────────────────────────────▶

   Telegram Bot Session 1        Telegram Bot Session 2
   ┌────────────────────┐        ┌────────────────────┐
   │ Create block A     │        │ (resumed)          │
   │ Update block A     │        │ Read from offset 2 │
   │ Create block B     │        │ Update block A     │
   │ ────────╳──────    │  ...   │ Create block C     │
   │ (session ends)     │        │                    │
   └────────────────────┘        └────────────────────┘
         │ │ │                          │ │
         ▼ ▼ ▼                          ▼ ▼
   ┌─────────────────────────────────────────────────────┐
   │              DURABLE STREAM: chat-123456            │
   │                                                     │
   │  offset 0: { type: "create", block: A }            │
   │  offset 1: { type: "update", block: A, data: ... } │
   │  offset 2: { type: "create", block: B }            │
   │  offset 3: { type: "update", block: A, data: ... } │ ◀── resumed here
   │  offset 4: { type: "create", block: C }            │
   │                                                     │
   │  SQLite WAL — crash-safe, resumable                │
   └─────────────────────────────────────────────────────┘
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/stream/:id` | Append to stream (creates if needed) |
| GET | `/v1/stream/:id` | Read from stream (with offset) |
| HEAD | `/v1/stream/:id` | Check if stream exists |
| DELETE | `/v1/stream/:id` | Delete stream |
| GET | `/v1/stream/:id/metadata` | Get stream metadata |
| GET | `/health` | Health check |

### Query Parameters

- `offset` - Start reading from this offset (default: `-1` for beginning)
- `limit` - Maximum entries to return (default: `100`)

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DURABLE_STREAM_URL` | `http://127.0.0.1:4437` | Durable streams server URL |
| `DURABLE_STREAM_PORT` | `4437` | Server port |
| `DURABLE_STREAM_HOST` | `127.0.0.1` | Server host |
| `TELEGRAM_BOT_TOKEN` | (required) | Telegram bot token |
| `NGROK_AUTHTOKEN` | (required) | ngrok authentication token |

---

## Troubleshooting

### ngrok Tunnel Not Working

```bash
# Check ngrok logs
docker compose -f docker/docker-compose.yml logs ngrok

# Verify tunnel is active
curl http://127.0.0.1:4040/api/tunnels

# Check if ngrok-notify received webhook
docker compose -f docker/docker-compose.yml logs ngrok-notify
```

### Durable Streams Connection Failed

```bash
# Check server is running
curl http://127.0.0.1:4437/health

# Check SQLite database
sqlite3 ~/.local/share/tmnl/durable-streams.db ".tables"

# View recent entries
sqlite3 ~/.local/share/tmnl/durable-streams.db \
  "SELECT * FROM stream_entries ORDER BY id DESC LIMIT 10"
```

### Telegram Bot Not Responding

```bash
# Check bot process
pueue status

# View bot logs
pueue log <task-id>

# Verify bot token
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
```

---

## Related Documentation

- [Durable Streams Server Plan](../../../.claude/plans/lovely-hatching-melody.md)
- [Effect-Atom Patterns](../../.edin/EFFECT_PATTERNS.md)
- [Block System Architecture](./BLOCK_SYSTEM_ARCHITECTURE.md)
