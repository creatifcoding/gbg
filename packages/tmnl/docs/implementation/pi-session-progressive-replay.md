# Pi Session Progressive Replay

## Purpose

Pi CLI JSONL sessions can be enormous. The previous drawer open path loaded the full pi branch through `SessionManager.open(path).getBranch()`, translated the entire branch to one `HarnessSnapshot`, then mounted every resulting MorphChat row. That made time-to-first-visible proportional to historical archive size.

The new contract is split:

1. **Preview hot path** — bounded tail parse, latest useful summary + recent renderable entries.
2. **Background hydration** — full snapshot loads after preview in a cancelable fiber.
3. **Render window** — large hydrated histories show the latest message window instead of mounting the entire archive.

Prime, the whale is still available. We simply stopped swallowing it before painting the first pixel.

## Contracts

### Server-only source

`src/lib/harness/session/v2/pi-session-source.ts`

- `loadPreviewSnapshot(args)` reads:
  - first chunk for the `session` header
  - tail chunk for recent renderable entries
  - latest `compaction` or `branch_summary` outside the tail, when present
- `loadSnapshot(args)` remains the compatibility/full hydration path.

Preview events use a high sequence base (`1_000_000_000`) so later full-hydration events with normal sequence numbers can flow through the existing duplicate guard.

### Browser/runtime API

- `HarnessRuntime.loadPiSessionPreviewSnapshot(args)`
- WS command: `remote:load_pi_session_preview_snapshot`
- Response payload remains `HarnessSnapshot` for compatibility with the existing processor.

### MorphChat operation

`resumePiSessionOp$` now:

1. Clears old session state and immediately shows a pi opening status row.
2. Requests preview snapshot with a 3s timeout.
3. Activates normal harness wiring with preview events.
4. Forks full hydration in `piHydrationFiber$(instanceId)`.
5. Applies the full snapshot in batches with `Effect.yieldNow()` between batches.
6. Cancels stale hydration when a new session/resume interrupts the instance.

### Rendering guard

`ThreadView` keeps only the latest `400` message IDs in the DOM for large histories and shows a compact seam describing how many older archive messages are withheld from the DOM.

## Real corpus benchmark

Command:

```bash
bun run spike:pi-session:replay -- --scope current-plus-all --limit 500
```

Observed largest local session:

```json
{
  "size": 506885329,
  "preview": { "elapsedMs": 6.84, "events": 111, "within500ms": true },
  "full": { "elapsedMs": 3251.6, "events": 12829 }
}
```

Interpretation:

- Preview hot path is well under the 500ms target on a 506MB session.
- Full hydration is still seconds-scale, correctly moved off the user-visible open path.

## Corpus inventory

Streaming scan over the current TMNL pi session corpus:

- Files: `375`
- Total bytes: `4.76GB`
- Entry types:
  - `message`: `271510`
  - `custom`: `2575`
  - `custom_message`: `1080`
  - `compaction`: `956`
  - `thinking_level_change`: `534`
  - `model_change`: `513`
  - `session`: `375`
  - `branch_summary`: `6`
  - invalid JSON lines: `2`
- Message roles:
  - `toolResult`: `132899`
  - `assistant`: `128197`
  - `user`: `10414`
- Message content block types:
  - `text`: `184762`
  - `toolCall`: `133705`
  - `thinking`: `50480`
  - `image`: `856`
- Custom message content:
  - string: `1078`
  - text block: `1`

## Adapter matrix

| Pi JSONL surface | Current preview behavior | Hydrated/full behavior | Gap |
| --- | --- | --- | --- |
| `session` | `chat:v2/session_opened` | same | OK |
| `message.role=user` string/text | `chat:v2/user_message` | same | OK |
| `message.role=assistant` text/thinking | materialized `assistant_start` + `assistant_final`; thinking is flattened into text by current `textFromContent` | same | Needs richer thinking block replay |
| `message.role=assistant` `toolCall` | currently text placeholder `[tool:name]` | same | Needs tool-event reconstruction |
| `message.role=toolResult` | rendered as user-context row `[toolResult] ...` when text exists | same | Needs tool result ↔ tool call pairing |
| `message.content.image` | placeholder `[image]` | same | Needs file/image part policy |
| `custom_message` | text row from content | same | OK fallback; needs custom display metadata card |
| `custom` | ignored | ignored | Needs custom inspector/fallback mapping |
| `compaction` | summary row | same | OK; should become boundary card |
| `branch_summary` | summary row | same | OK; should become boundary card |
| `model_change` | ignored | ignored | Could map to provider/status marker |
| `thinking_level_change` | ignored | ignored | Could map to status/context marker |
| invalid JSON | skipped by bounded parser | SDK full path may throw/skip depending reader | Needs quarantine diagnostics |

## Follow-up work

- Reconstruct pi `toolCall` / `toolResult` pairs into `chat:v2/tool_event` phases.
- Preserve `thinking` as `thinking` parts instead of flattening to text.
- Render `compaction` / `branch_summary` as dedicated boundary cards.
- Surface `custom` and malformed records as safe inspector rows with counts.
- Add true prepend/virtualized archive browsing when older context must be explored, rather than only latest-window display.
