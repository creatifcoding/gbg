# AGENTS.md

> AI agent instructions for @gbg/ctl - Effect CLI Framework

## Quick Reference

```bash
# Development
bun install              # Install dependencies
bun run build            # TypeScript compilation
bun run test:all         # Run all tests (91 vitest + 13 bun)
bun run compile          # Build standalone binary to bin/ctl

# Nix
nix develop              # Enter devshell
nix run . -- --help      # Run CLI
nix flake check          # Validate flake
```

## Project Overview

CTL is an Effect-TS CLI framework providing:
- **Skill-driven development** - Modular, composable CLI skills
- **Agent-guiding errors** - Structured errors with suggested skills/actions
- **SQLite persistence** - @effect/sql-sqlite-bun for local state
- **Effect ecosystem** - Built on @effect/cli, @effect/platform, effect

## Architecture

```
src/
├── cli/           # CLI entry point and commands
├── core/          # Core abstractions (Result, errors)
├── config/        # Configuration loading (YAML, JSON, ENV)
├── messaging/     # Output formatting, tables, progress
├── persistence/   # SQLite with migrations
├── services/      # Logger, OutputService
└── skills/        # Skill system (loader, manifest, types)
```

## Code Style

- TypeScript strict mode
- No semicolons (Prettier configured)
- Effect-TS patterns throughout
- Schema for all domain types
- Functional, composable design

## Testing

Two test runners due to runtime requirements:

| Runner | Files | Why |
|--------|-------|-----|
| vitest | `test/*.test.ts` | Standard tests (91 tests) |
| bun:test | `test/*.bun-test.ts` | SQLite tests need bun runtime (13 tests) |

```bash
bun run test:all         # Both runners
bun run test:run         # vitest only
bun run test:bun         # bun:test only
```

## Installation Methods

### For Nix Users

```bash
# From source directory
cd packages/ctl
nix run . -- --help           # Run directly
nix profile install .#default # Install to profile

# Development
nix develop                   # Enter devshell with all tools
```

### For Non-Nix Users (Bun)

```bash
# Clone and build
git clone https://github.com/gbg/gbg.git
cd gbg/packages/ctl
bun install
bun run compile               # Creates bin/ctl
./bin/ctl --help
```

### curl | bash (Auto-detects)

```bash
curl -fsSL https://raw.githubusercontent.com/gbg/gbg/main/packages/ctl/setup.sh | bash
```

The setup script:
1. Detects Nix → `nix profile install`
2. Detects Bun → compiles from source
3. Neither → installs Bun first, then compiles

## Key Files

| File | Purpose |
|------|---------|
| `src/cli/index.ts` | CLI entry point |
| `src/core/errors.ts` | Agent-guiding error types |
| `src/skills/types.ts` | Skill schema definitions |
| `src/persistence/sqlite.ts` | SQLite service |
| `flake.nix` | Nix flake configuration |
| `setup.sh` | Universal installer script |

## Effect Patterns Used

```typescript
// Service definition
class MyService extends Effect.Service<MyService>()("ctl/MyService", {
  effect: Effect.gen(function* () {
    // ...
  }),
}) {}

// Schema for domain types
const Config = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
})

// Result type for operations
type Result<A> = Either<CtlError, A>
```

## Adding Features

### New Command

1. Define in `src/cli/commands/`
2. Add to command tree in `src/cli/index.ts`
3. Add tests in `test/`

### New Skill

1. Create skill directory in `skills/<name>/`
2. Add `SKILL.md` with metadata and instructions
3. Register in `skills/MANIFEST.json`

### New Migration

```bash
bun run ctl add migration add_users_table
```

## Common Tasks

| Task | Command |
|------|---------|
| Add dependency | `bun add <pkg>` |
| Type check | `bun run typecheck` |
| Watch mode | `bun run dev` |
| Run single test | `bun test test/core.test.ts` |

## Error Handling

Errors include skill suggestions for agents:

```typescript
new CtlError({
  code: "CONFIG_NOT_FOUND",
  message: "No ctl.config.yaml found",
  suggestion: "Run 'ctl new' to initialize a project",
  skill: "cli/init",
})
```

## Dependencies

Core Effect packages (latest versions):
- `effect@3.19.14`
- `@effect/cli@0.73.0`
- `@effect/platform@0.94.1`
- `@effect/sql-sqlite-bun@0.50.0`

## Security Notes

- SQLite databases stored in project directory
- No network calls in core library
- Config files should not contain secrets (use ENV vars)
