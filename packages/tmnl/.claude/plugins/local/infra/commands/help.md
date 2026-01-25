---
description: "Show infrastructure commands help"
argument-hint: "[command]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/infra-help.sh:*)"]
---

# Infrastructure Help

```!
"${CLAUDE_PLUGIN_ROOT}/scripts/infra-help.sh" $ARGUMENTS
```

Display comprehensive help for infrastructure commands in a floating pane.

## Options

- `[command]` - Show help for specific command (up, down, status, logs, rebuild)
- No argument - Show overview of all commands

## Examples

```bash
/infra:help              # Overview in floating pane
/infra:help up           # Help for /infra:up
/infra:help status       # Help for /infra:status
```
