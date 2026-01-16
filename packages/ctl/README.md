# @gbg/ctl

> Effect CLI Framework with skill-driven development, agent-guiding errors, and SQLite persistence

[![Effect](https://img.shields.io/badge/Effect-TS-blue)](https://effect.website)
[![Bun](https://img.shields.io/badge/Bun-Runtime-orange)](https://bun.sh)
[![Nix](https://img.shields.io/badge/Nix-Flake-5277C3)](https://nixos.org)

## Features

- **Skill-Driven Development** - Modular, composable CLI skills with manifest-based discovery
- **Agent-Guiding Errors** - Structured errors that suggest relevant skills and actions
- **SQLite Persistence** - Built-in migrations and type-safe queries via @effect/sql
- **Effect Ecosystem** - First-class integration with Effect-TS patterns

## Installation

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/gbg/gbg/main/packages/ctl/setup.sh | bash
```

### Nix Users

```bash
# Run directly
nix run github:gbg/gbg?dir=packages/ctl -- --help

# Install to profile
nix profile install github:gbg/gbg?dir=packages/ctl

# Development shell
nix develop github:gbg/gbg?dir=packages/ctl
```

### From Source (Bun)

```bash
git clone https://github.com/gbg/gbg.git
cd gbg/packages/ctl
bun install
bun run compile    # Creates bin/ctl
./bin/ctl --help
```

## Usage

```bash
# Create a new CTL project
ctl new my-cli

# Add components
ctl add command greet
ctl add skill core
ctl add migration users

# Check project health
ctl health

# Inspect project structure
ctl inspect
```

## Project Structure

```
my-cli/
├── ctl.config.yaml      # Project configuration
├── skills/
│   ├── MANIFEST.json    # Skill registry
│   └── core/
│       └── SKILL.md     # Skill definition
├── src/
│   └── commands/        # CLI commands
└── migrations/          # SQLite migrations
```

## Configuration

Create `ctl.config.yaml`:

```yaml
name: my-cli
version: 0.1.0

skills:
  - core
  - data

database:
  path: ./data/app.db
```

## Skills

Skills are self-contained modules with:
- `SKILL.md` - Metadata and instructions
- Triggers for automatic activation
- Dependencies on other skills

```markdown
---
name: data
description: Data management utilities
triggers:
  - "data import"
  - "data export"
dependencies:
  - core
---

# Data Skill

Instructions for the data skill...
```

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run ctl --help

# Build TypeScript
bun run build

# Run tests
bun run test:all    # 104 tests (91 vitest + 13 bun)

# Type check
bun run typecheck

# Compile standalone binary
bun run compile
```

## API

CTL exports modules for building your own CLI:

```typescript
import { CtlError, Result } from "@gbg/ctl/core"
import { SqliteService, Migration } from "@gbg/ctl/persistence"
import { OutputService, Table } from "@gbg/ctl/messaging"
import { ConfigLoader } from "@gbg/ctl/config"
import { SkillLoader, Skill } from "@gbg/ctl/skills"
```

---

## LLM Context

<details>
<summary><strong>Click to expand LLM instructions</strong></summary>

### For AI Assistants

This section provides context for LLMs (Claude, GPT, Copilot, etc.) working with this codebase.

#### Installation Decision Tree

```
Is Nix available?
├─ Yes → nix profile install .#default
│        (or nix run . -- <args>)
└─ No → Is Bun available?
        ├─ Yes → bun install && bun run compile
        │        Then: ./bin/ctl or add bin/ to PATH
        └─ No → curl -fsSL .../setup.sh | bash
                (auto-installs Bun, then compiles)
```

#### Key Commands

| Task | Command |
|------|---------|
| Run CLI (dev) | `bun run ctl <args>` |
| Build | `bun run build` |
| Compile binary | `bun run compile` |
| Test all | `bun run test:all` |
| Nix shell | `nix develop` |
| Nix run | `nix run . -- <args>` |

#### Testing Notes

- **vitest** (`test/*.test.ts`) - Standard unit tests
- **bun:test** (`test/*.bun-test.ts`) - SQLite tests requiring bun runtime

Always run `bun run test:all` to execute both test suites.

#### Effect-TS Patterns

This project uses Effect-TS throughout:

```typescript
// Services use Effect.Service pattern
class MyService extends Effect.Service<MyService>()("ctl/MyService", {
  effect: Effect.gen(function* () { /* ... */ }),
}) {}

// Errors are structured with suggestions
new CtlError({
  code: "NOT_FOUND",
  message: "Config not found",
  suggestion: "Run 'ctl new' first",
  skill: "cli/init",  // Suggests relevant skill
})

// Domain types use Schema
const Config = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
})
```

#### File Locations

| What | Where |
|------|-------|
| CLI entry | `src/cli/index.ts` |
| Commands | `src/cli/commands/` |
| Core errors | `src/core/errors.ts` |
| SQLite service | `src/persistence/sqlite.ts` |
| Skill types | `src/skills/types.ts` |
| Tests | `test/*.test.ts`, `test/*.bun-test.ts` |
| Nix config | `flake.nix`, `nix/` |

#### Adding Features

**New command:**
1. Create in `src/cli/commands/<name>.ts`
2. Register in `src/cli/index.ts`
3. Add tests

**New skill:**
1. Create `skills/<name>/SKILL.md`
2. Add to `skills/MANIFEST.json`

**New migration:**
```bash
ctl add migration <name>
```

#### Dependencies (Latest)

```json
{
  "effect": "^3.19.14",
  "@effect/cli": "^0.73.0",
  "@effect/platform": "^0.94.1",
  "@effect/sql-sqlite-bun": "^0.50.0"
}
```

#### Common Issues

| Issue | Solution |
|-------|----------|
| `Cannot find module '@effect/...'` | Run `bun install` |
| SQLite tests fail | Use `bun test` not `vitest` for `*.bun-test.ts` |
| Nix build fails | Use `nix develop` first, then compile |
| Binary not found | Run `bun run compile` to create `bin/ctl` |

</details>

---

## License

MIT

## Contributing

See [AGENTS.md](./AGENTS.md) for detailed development instructions.
