# Discovered Patterns Log

Self-evolving registry of patterns discovered during pi extension development.

**Protocol**: When you discover a new pattern, add it here with date and context.

---

## 2026-02-04: Transport Selection for MCP

**Problem**: MCP SDK has multiple transports, unclear which to use.

**Discovery**: 
- `SSEClientTransport` is deprecated
- `StreamableHTTPClientTransport` is preferred for HTTP
- Some legacy servers still need SSE (check for 405/410 errors)

**Solution**:
```typescript
if (config.type === 'http') {
  transport = new StreamableHTTPClientTransport(new URL(config.url))
} else if (config.type === 'sse') {
  transport = new SSEClientTransport(new URL(config.url))  // Legacy fallback
} else {
  transport = new StdioClientTransport({ command, args, env })
}
```

**Gotcha**: Try HTTP first, fall back to SSE if you get 405 Method Not Allowed.

---

## 2026-02-04: bunx vs npx Performance

**Problem**: Stdio MCP servers taking 11+ seconds to start.

**Discovery**: npx has significant cold-start overhead. bunx is 10-60x faster.

**Benchmarks**:
| Package | npx | bunx | Speedup |
|---------|-----|------|---------|
| effect-mcp | 11,336ms | 594ms | 19x |
| firecrawl-mcp | 11,402ms | 197ms | 58x |

**Gotcha**: Some packages fail with bunx ("Connection closed"). Fall back to npx.

**Pattern**:
```json
{
  "type": "stdio",
  "command": "bunx",  // Try this first
  "args": ["package-name"]
}
```

---

## 2026-02-04: Timeout Wrapping for Async Operations

**Problem**: Extension hangs during startup, no feedback.

**Solution**: Wrap all async operations with Promise.race timeout:

```typescript
const TIMEOUT = 15000

const result = await Promise.race([
  asyncOperation(),
  new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT}ms`)), TIMEOUT)
  )
])
```

**Lesson**: Never await unbounded promises in extension lifecycle hooks.

---

## 2026-02-04: Structured Console Logging

**Problem**: Hard to filter extension logs from pi's output.

**Solution**: Consistent prefix pattern:

```typescript
console.log(`[ext-name] [${context}] Message`)
console.log(`[mcp-bridge] [exa] Connecting...`)
console.log(`[mcp-bridge] [exa] Connected in 820ms: 7 tools`)
console.error(`[mcp-bridge] [exa] Failed: ${error}`)
```

**Filter**: `grep -E "\[mcp-bridge\]" /tmp/pi-debug.log`

---

## 2026-02-04: Decouple from External Configs

**Problem**: Extension relied on `~/.claude.json` — fragile, hard to debug.

**Solution**: Single source of truth in project:

```
.pi/mcp.json          # THE config
.pi/extensions/...    # Code
.pi/skills/...        # Documentation
```

**Lesson**: Don't inherit config complexity. Own your configuration.

---

## Template for New Patterns

```markdown
## YYYY-MM-DD: Pattern Name

**Problem**: What issue did you encounter?

**Discovery**: What did you learn?

**Solution**:
\`\`\`typescript
// Code
\`\`\`

**Gotcha**: What can go wrong?

**Lesson**: One-liner takeaway.
```
