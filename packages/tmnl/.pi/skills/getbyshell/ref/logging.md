# Logging — Widget Reference

> up: ../SKILL.md
> prereqs: none
> update-strategy: re-derive from src/lib/getbyshell/logging/
> update-trigger: log pipeline changes

## Overview

Structured logging pipeline: Effect Logger → batched Tauri IPC → Rust `log` crate → systemd journald. Every operation traced via `Effect.withSpan()`.

## Source Layout

| Location | Purpose |
|----------|---------|
| `src/lib/getbyshell/logging/types.ts` | ShellLogLevel, ShellLogEntry, ShellLogBatch |
| `src/lib/getbyshell/logging/logger.ts` | Effect Logger implementation, Tauri IPC batching |
| `src/lib/getbyshell/logging/index.ts` | Exports |

## Pipeline

```
Effect.log("message")
  → ShellLogger (Effect Logger implementation)
  → Batches entries (configurable interval)
  → Tauri invoke("shell_log_batch", entries)
  → Rust log::info!/debug!/error!
  → systemd journald (SyslogIdentifier: tmnl-{surface})
```

## Querying Logs

```bash
# All getbyshell surfaces
journalctl --user -u "tmnl-*" -f

# Specific surface
journalctl --user -u tmnl-bar -f

# Frontend logs (tagged with [bar-fe] / [panel-fe])
journalctl --user -u tmnl-bar -g "\\[bar-fe\\]"

# Since time
journalctl --user -u tmnl-panel --since "5 min ago" --no-pager
```
