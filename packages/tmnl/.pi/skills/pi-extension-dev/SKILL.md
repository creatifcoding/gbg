---
name: pi-extension-dev
description: Development and debugging patterns for pi extensions. Use when building, testing, or debugging pi extensions. Covers tmux-based testing, log analysis, iterative debugging, and extension lifecycle.
---

# Pi Extension Development

Patterns and workflows for developing pi extensions.

## Quick Reference

```bash
# Start debug session
./scripts/pi-debug.sh start

# Watch logs
./scripts/pi-debug.sh logs

# Stop session  
./scripts/pi-debug.sh stop

# Full cycle: stop → start → wait → logs
./scripts/pi-debug.sh cycle
```

## Debug Session Pattern

### 1. Tmux-Based Testing

Run pi in a detached tmux session with log capture:

```bash
# Create session with log capture
tmux new-session -d -s pi-debug -c "$(pwd)" \
  && tmux send-keys -t pi-debug \
     "pi --provider anthropic --model claude-sonnet-4-20250514 2>&1 | tee /tmp/pi-debug.log" \
     Enter

# Watch logs in real-time
tail -f /tmp/pi-debug.log | grep --line-buffered "\[your-extension\]"

# Kill session when done
tmux kill-session -t pi-debug
```

### 2. Log Pattern Analysis

```bash
# Filter to your extension's logs
grep -E "\[mcp-bridge\]" /tmp/pi-debug.log

# Watch for errors
grep -E "Failed|Error|error" /tmp/pi-debug.log

# Timing analysis
grep -E "Connected in|Failed:" /tmp/pi-debug.log

# Last N lines with context
tail -50 /tmp/pi-debug.log | grep -A2 -B2 "\[your-extension\]"
```

### 3. Iterative Debug Cycle

```
┌─────────────────────────────────────────────────────┐
│  1. ADD INSTRUMENTATION                             │
│     console.log(`[ext] [${name}] State: ${state}`)  │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  2. TEST IN TMUX                                    │
│     tmux kill + new-session + send-keys             │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  3. WAIT FOR BEHAVIOR                               │
│     sleep N && grep pattern /tmp/pi-debug.log       │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  4. ANALYZE & FIX                                   │
│     Identify failure point → surgical edit          │
└─────────────────────┬───────────────────────────────┘
                      ▼
              (repeat until green)
```

## Extension Structure

```
.pi/extensions/your-extension/
├── index.ts          # Entry point (default export)
├── package.json      # Dependencies
└── node_modules/     # Installed deps
```

### Minimal Extension

```typescript
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'

export default function myExtension(pi: ExtensionAPI) {
  // Lifecycle hooks
  pi.on('session_start', async (_event, ctx) => {
    console.log('[my-ext] Session started')
  })

  pi.on('session_shutdown', async () => {
    console.log('[my-ext] Shutting down')
  })

  // Register tools
  pi.registerTool({
    name: 'my_tool',
    label: 'My Tool',
    description: 'Does something useful',
    parameters: Type.Object({
      input: Type.String()
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: 'text', text: `Result: ${params.input}` }],
        details: {}
      }
    }
  })

  // Register commands
  pi.registerCommand('mycmd', {
    description: 'My command',
    handler: async (args, ctx) => {
      ctx.ui.notify('Hello!', 'info')
    }
  })
}
```

## Instrumentation Patterns

### Timing Instrumentation

```typescript
console.log(`[ext] [${name}] Connecting...`)
const startTime = Date.now()

await someAsyncOperation()

console.log(`[ext] [${name}] Connected in ${Date.now() - startTime}ms`)
```

### State Logging

```typescript
console.log(`[ext] [${name}] Config:`, JSON.stringify(config, null, 2))
console.log(`[ext] [${name}] State: ${state}`)
console.log(`[ext] [${name}] Tools: ${tools.length}`)
```

### Error Logging

```typescript
try {
  await riskyOperation()
} catch (e) {
  const error = e instanceof Error ? e.message : String(e)
  console.error(`[ext] [${name}] Failed: ${error}`)
  // Re-throw or handle
}
```

## Timeout Patterns

### Promise.race for Timeouts

```typescript
const TIMEOUT = 15000

const result = await Promise.race([
  actualOperation(),
  new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT}ms`)), TIMEOUT)
  )
])
```

### Per-Operation Timeouts

```typescript
for (const [name, config] of servers) {
  try {
    const result = await Promise.race([
      connectServer(name, config),
      timeout(15000, `${name} connection timeout`)
    ])
    connected.set(name, result)
  } catch (e) {
    console.error(`[ext] [${name}] Failed: ${e.message}`)
    // Continue to next server
  }
}
```

## Performance Optimization

### bunx vs npx

**Always prefer bunx** for stdio subprocess spawning:

```typescript
// SLOW (~11s)
{ command: "npx", args: ["-y", "some-mcp@latest"] }

// FAST (~600ms)  
{ command: "bunx", args: ["some-mcp@latest"] }
```

**Exception**: Some packages fail with bunx. Fall back to npx if you see "Connection closed" errors.

### Parallel Connection (when independent)

```typescript
const results = await Promise.allSettled(
  servers.map(([name, config]) => connectServer(name, config))
)
```

### Sequential Connection (when order matters)

```typescript
for (const [name, config] of servers) {
  await connectServer(name, config)
}
```

## Self-Evolution Protocol

When discovering new patterns during development:

1. **Document immediately** in this skill
2. **Extract to scripts** if reusable
3. **Add to troubleshooting** if it's a gotcha
4. **Update examples** with real code

### Pattern Template

```markdown
### Pattern Name

**Problem**: What issue does this solve?

**Solution**:
\`\`\`typescript
// Code example
\`\`\`

**When to use**: Trigger conditions

**Gotchas**: Known issues
```

## Troubleshooting Log

<!-- Add new issues as discovered -->

### Extension Not Loading

**Symptom**: Extension doesn't appear in pi startup

**Check**:
1. `index.ts` has default export function
2. `package.json` exists with valid JSON
3. Dependencies installed (`bun install`)

### Tools Not Registering

**Symptom**: Tools don't appear for LLM

**Check**:
1. `registerTool` called in `session_start` handler
2. Tool name is unique (prefix with extension name)
3. Parameters use TypeBox schema

### Async Operations Hanging

**Symptom**: Extension never finishes startup

**Fix**: Add timeouts to all async operations:
```typescript
await Promise.race([op(), timeout(15000)])
```

## See Also

- [mcp-bridge skill](../mcp-bridge/SKILL.md) — MCP-specific patterns
- [Pi Extension Docs](https://github.com/badlogic/pi-mono/blob/main/docs/extensions.md)
