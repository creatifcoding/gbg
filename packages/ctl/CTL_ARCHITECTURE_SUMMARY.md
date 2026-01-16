# CTL TUI Architecture Summary

## Overview

CTL is an Effect-based CLI framework for building skill-driven CLIs. It features a hexagonal architecture with multiple output modes.

## Output Modes

| Mode | Trigger | Description |
|------|---------|-------------|
| **Inline** | default | Human-readable console output via `ConsoleOutputAdapter` |
| **Agent** | `--agent` | Structured `CtlAgentOutput` JSON for agent steering |
| **TUI** | `ctl tui` | Full-screen terminal UI with keyboard navigation |

## Commands

| Command | Description | Agent Mode |
|---------|-------------|------------|
| `ctl new <name>` | Create new CLI project | - |
| `ctl add <type> <name>` | Add command/skill/migration | - |
| `ctl inspect [path]` | Inspect CLI structure | - |
| `ctl health` | Check CLI health | ✅ |
| `ctl discover` | Discover project config | ✅ |
| `ctl help [query]` | Search commands | ✅ |
| `ctl catalog [search]` | Browse component catalog | ✅ |
| `ctl tui [--page=X]` | Launch TUI mode | - |

## Architecture

```
src/
├── cli/index.ts           # CLI entry & commands
├── core/
│   ├── domain/            # Effect Schemas
│   │   ├── agent-output.ts    # CtlAgentOutput, AgentAction
│   │   └── project-config.ts  # ProjectConfig, SkillRef
│   ├── ports/
│   │   └── output.ts          # OutputPort interface
│   └── services/
│       ├── agent-execution.ts # Parse/execute agent actions
│       ├── catalog.ts         # Component catalog
│       ├── command-router.ts  # Command routing
│       └── project-discovery.ts
├── adapters/output/
│   ├── agent.ts           # JSON output for agents
│   ├── console.ts         # Simple console output
│   ├── ink.tsx            # Rich Ink output (env-limited)
│   └── tui.tsx            # Full TUI mode
└── render/primitives/
    └── index.tsx          # UI primitives (Alert, Badge, etc.)
```

## Agent Output Protocol

When using `--agent`, commands emit `CtlAgentOutput`:

```typescript
{
  _type: "ctl_output",
  command: string,           // Command name
  status: "success" | "error" | "pending",
  result: unknown,           // Command-specific data
  actions: AgentAction[],    // Suggested follow-up actions
  suggestedSkills: string[], // Related skills
  steering: "continue" | "await_input" | "complete" | "escalate" | "retry",
  meta: { timestamp: string }
}
```

### AgentAction Schema

```typescript
{
  name: string,
  description: string,
  command: string,           // CLI command to execute
  category: "fix" | "create" | "update" | "delete" | "navigate" | "invoke" | "query",
  priority: "critical" | "high" | "normal" | "low",
  confirm?: boolean,         // Whether to confirm before execution
  when?: string              // Condition hint
}
```

## TUI Navigation

| Key | Page | Description |
|-----|------|-------------|
| H | Home | Welcome screen |
| E | Health | Health check |
| D | Discover | Project discovery |
| L | Logs | Log panel |
| C | Catalog | Component catalog |
| S | Settings | Configuration |
| Q | - | Quit |

Direct navigation: `ctl tui --page=catalog`

## Services

| Service | Purpose |
|---------|---------|
| `CommandRouter` | Routes queries to commands with confidence scoring |
| `ProjectDiscovery` | Finds CTL.md and discovers project config |
| `AgentExecution` | Parses and executes agent actions |
| `Catalog` | Queryable component catalog |

## Known Limitations

- **Ink/TUI modes**: May crash in Bun/WSL environments due to terminal compatibility
- **ConsoleOutputAdapter**: Used as default instead of Ink for stability

## Future Enhancements

- Claude Agent SDK integration for agentic scaffolding
- Interactive wizard for `ctl add component`
- NDJSON streaming for live updates
