# OpenCode/Claude to Claude Code (Codex) Migration Guide

> **Comprehensive guide to migrating MCPs and Skills from OpenCode/Claude Desktop to Claude Code**

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Key Differences](#key-differences)
3. [Migration Strategy](#migration-strategy)
4. [MCP Server Migration](#mcp-server-migration)
5. [Skills Migration](#skills-migration)
6. [Testing & Validation](#testing--validation)
7. [Best Practices](#best-practices)

---

## Executive Summary

**Claude Code (Codex)** is Anthropic's official CLI agent framework that unifies:

- **MCP (Model Context Protocol)** servers for external tool integration
- **Skills** for repeatable workflows and domain knowledge
- **Subagents** for task delegation
- **Hooks** for event-driven automation
- **Plugins** for bundled capabilities

**Key Migration Goals:**

1. Convert OpenCode/Claude Desktop MCP configs to Claude Code format
2. Migrate existing skills to Claude Code's skill structure
3. Preserve functionality while adopting Claude Code conventions
4. Enable cross-platform skill compatibility (Agent Skills standard)

---

## Key Differences

### Configuration Locations

| System             | MCP Config                                    | Skills Location       | Global Config             |
| ------------------ | --------------------------------------------- | --------------------- | ------------------------- |
| **OpenCode**       | `~/.opencode/mcp.json`                        | `~/.opencode/skills/` | `~/.opencode/config.json` |
| **Claude Desktop** | `~/.config/Claude/claude_desktop_config.json` | N/A                   | Same file                 |
| **Claude Code**    | `~/.claude/mcp.json`                          | `~/.claude/skills/`   | `~/.claude/config.json`   |
| **Project-level**  | `./.claude/mcp.json`                          | `./.claude/skills/`   | `./.claude/config.json`   |

### Scope Hierarchy

Claude Code introduces **three scopes** with precedence:

```
USER scope (~/.claude/)
  ↑ overrides
PROJECT scope (./.claude/)
  ↑ overrides
LOCAL scope (inline/temp configs)
```

**Rule:** More specific scope wins. Project MCPs override user MCPs.

---

## Migration Strategy

### Phase 1: Inventory (10 min)

**Identify existing assets:**

```bash
# Find OpenCode/Claude Desktop MCP configs
find ~ -name "*mcp*.json" -o -name "claude_desktop_config.json" 2>/dev/null

# Find skills (if using OpenCode)
find ~/.opencode/skills -name "*.md" 2>/dev/null
find ~/.claude/skills -name "SKILL.md" 2>/dev/null

# Find custom commands/agents
ls ~/.opencode/agents/ 2>/dev/null
ls ~/.claude/skills/ 2>/dev/null
```

**Document:**

- MCP servers in use (list all)
- Custom skills/workflows
- Environment variables needed
- API keys/credentials

### Phase 2: MCP Migration (20 min)

**Convert MCP configs** from OpenCode/Claude Desktop to Claude Code format.

### Phase 3: Skills Migration (30 min)

**Port skills** to Claude Code's SKILL.md format.

### Phase 4: Validation (15 min)

**Test each migrated component** end-to-end.

---

## MCP Server Migration

### Understanding MCP Types

Claude Code supports **three MCP server types:**

| Type      | Use Case           | Connection      |
| --------- | ------------------ | --------------- |
| **stdio** | Local process      | Command + args  |
| **HTTP**  | Remote API         | URL + headers   |
| **SSE**   | Server-Sent Events | URL + streaming |

### Migration Steps

#### Step 1: Export Claude Desktop MCPs

**Claude Desktop config format:**

```json
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": ["-y", "@smithery/cli@latest", "run", "exa", "--key", "API_KEY"]
    }
  }
}
```

#### Step 2: Convert to Claude Code Format

**Claude Code config format** (`~/.claude/mcp.json`):

```json
{
  "$schema": "https://raw.githubusercontent.com/anthropics/claude-code/main/schemas/mcp-config-schema.json",
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": [
        "-y",
        "@smithery/cli@latest",
        "run",
        "exa",
        "--key",
        "${EXA_API_KEY}"
      ],
      "env": {
        "EXA_API_KEY": "${EXA_API_KEY}"
      }
    }
  }
}
```

**Key changes:**

- ✅ Add `$schema` for validation
- ✅ Use environment variable expansion: `${VAR_NAME}`
- ✅ Add `env` block for required vars

#### Step 3: Add Environment Variables

**Create/update `~/.bash_profile` or `~/.zshrc`:**

```bash
# MCP Server API Keys
export EXA_API_KEY="your-api-key-here"
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Custom paths (if needed)
export TMNL_PROJECT_ROOT="/path/to/project"
```

**Reload shell:**

```bash
source ~/.bash_profile  # or ~/.zshrc
```

### Example Migrations

#### Example 1: Local stdio Server

**Before (OpenCode):**

```json
{
  "mcpServers": {
    "osm": {
      "command": "/path/to/osmmcp",
      "args": []
    }
  }
}
```

**After (Claude Code):**

```json
{
  "$schema": "https://raw.githubusercontent.com/anthropics/claude-code/main/schemas/mcp-config-schema.json",
  "mcpServers": {
    "OSM": {
      "command": "/home/user/projects/tmnl/bin/osmmcp",
      "args": [],
      "env": {}
    }
  }
}
```

#### Example 2: HTTP Server (GitHub)

**Before (Claude Desktop plugin):**

```json
{
  "github": {
    "type": "http",
    "url": "https://api.githubcopilot.com/mcp/",
    "headers": {
      "Authorization": "Bearer ghp_hardcoded"
    }
  }
}
```

**After (Claude Code):**

**1. Plugin method (recommended):**

```bash
claude code plugins install @claude-plugins-official/github
```

**2. Manual MCP config:**

```json
{
  "$schema": "https://raw.githubusercontent.com/anthropics/claude-code/main/schemas/mcp-config-schema.json",
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

#### Example 3: PostgreSQL Database

**Before (custom script):**

```json
{
  "database": {
    "command": "node",
    "args": ["~/scripts/db-mcp.js"]
  }
}
```

**After (Claude Code with env vars):**

```json
{
  "$schema": "https://raw.githubusercontent.com/anthropics/claude-code/main/schemas/mcp-config-schema.json",
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"
      ],
      "env": {
        "PGUSER": "${PGUSER}",
        "PGPASSWORD": "${PGPASSWORD}",
        "PGHOST": "${PGHOST}",
        "PGPORT": "${PGPORT}",
        "PGDATABASE": "${PGDATABASE}"
      }
    }
  }
}
```

### Testing MCP Migrations

```bash
# List active MCP servers
claude code mcp list

# Check specific server
claude code mcp status github

# Restart MCP servers
claude code mcp restart

# View MCP logs
tail -f ~/.claude/logs/mcp-*.log
```

---

## Skills Migration

### Understanding Skills Structure

**Claude Code Skills format:**

```
~/.claude/skills/
  └── my-skill/
      ├── SKILL.md           # Main skill definition (REQUIRED)
      ├── examples.md        # Optional: usage examples
      ├── patterns.md        # Optional: additional context
      └── allowed-tools      # Optional: tool restrictions
```

**SKILL.md frontmatter (YAML):**

```yaml
---
name: my-skill # Unique identifier (kebab-case)
description: Brief one-liner # Shown in skill list
model_invoked: true # false = manual invoke only
triggers: # Keywords that activate skill
  - 'keyword1'
  - 'keyword2'
scope: user # user | project | builtin
---
```

### Migration Process

#### Step 1: Audit Current Skills

**From your inventory:**

```bash
# You have these user-level skills:
~/.claude/skills/migrate/
~/.claude/skills/commit/
~/.claude/skills/tdd/
# ... ~100 skills total

# And project-level skills:
./.claude/skills/effect-patterns/
./.claude/skills/tmnl-debug-instrumentation/
# ... ~60 project skills
```

#### Step 2: Validate Skill Format

**Check if already compatible:**

```bash
# Good: SKILL.md with frontmatter
cat ~/.claude/skills/migrate/SKILL.md | head -10

# If no frontmatter, needs migration
```

**Example compliant skill:**

```markdown
---
name: migrate
description: Migration workflow - research → analyze → plan → implement → review
model_invoked: true
triggers:
  - 'migrate'
  - 'upgrade'
  - 'move from'
scope: user
---

# /migrate - Migration Workflow

Safe migrations for frameworks, languages, and infrastructure.

## When to Use

- "Migrate to X"
- "Upgrade framework"
  ...
```

#### Step 3: Migrate Non-Compliant Skills

**If skill lacks frontmatter, add it:**

```bash
# Backup original
cp ~/.claude/skills/my-skill/README.md ~/.claude/skills/my-skill/README.md.bak

# Rename to SKILL.md
mv ~/.claude/skills/my-skill/README.md ~/.claude/skills/my-skill/SKILL.md

# Add frontmatter
cat > ~/.claude/skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: What this skill does
model_invoked: true
triggers:
  - "relevant keyword"
scope: user
---

$(cat ~/.claude/skills/my-skill/SKILL.md.bak)
EOF
```

#### Step 4: Project-Specific Skills

**Best practice:** Keep project skills in `./.claude/skills/`

**Example: TMNL Effect patterns skill**

```markdown
---
name: effect-patterns
description: Effect-TS pattern reference for TMNL. Canonical file locations and pattern precedents.
model_invoked: true
triggers:
  - 'Effect'
  - 'Effect-TS'
  - 'Schema'
  - 'Layer'
  - 'service'
  - 'atom'
  - 'effect-atom'
scope: project
---

# Effect-TS Patterns for TMNL

## CRITICAL DOCTRINE: Atom-as-State

**NO EFFECT.REF. EVER.**

When React is the consumer via effect-atom, `Atom.make()` is the primary state mechanism...
```

### Advanced: Tool Restrictions

**Limit tools available to a skill:**

**File: `~/.claude/skills/read-only-skill/allowed-tools`**

```
Read
Glob
Grep
LSP:*
```

**Deny all except specific:**

```
Read
Write
!Bash
!Task
```

### Skill Categories

**Organize by type:**

| Type                 | Scope   | Example                                    |
| -------------------- | ------- | ------------------------------------------ |
| **Workflow**         | user    | `/migrate`, `/tdd`, `/commit`              |
| **Domain Knowledge** | project | `effect-patterns`, `tmnl-color-system`     |
| **Tool Integration** | user    | `playwright`, `dev-browser`                |
| **Code Patterns**    | project | `rust-macro-patterns`, `react-performance` |

---

## Testing & Validation

### Validation Checklist

**MCP Servers:**

- [ ] All servers listed in `claude code mcp list`
- [ ] No connection errors in logs
- [ ] Environment variables resolved
- [ ] Tools appear when invoked

**Skills:**

- [ ] All skills in `claude code skills list`
- [ ] Triggers activate skills correctly
- [ ] Frontmatter valid (no YAML errors)
- [ ] Supporting files load progressively

### Test Commands

```bash
# Test MCP server
claude code --prompt "Use the exa MCP to search for 'Effect-TS patterns'"

# Test skill
claude code --prompt "/migrate from Express to Fastify"

# Verbose mode for debugging
claude code --verbose --prompt "Your test prompt"

# Check skill activation
claude code --prompt "When I say Effect service, which skill activates?"
```

### Common Issues

#### Issue 1: MCP Not Loading

**Symptom:** Tool not available despite config

**Fixes:**

```bash
# Check syntax
cat ~/.claude/mcp.json | jq .  # Should not error

# Restart MCP servers
claude code mcp restart

# Check logs
tail -f ~/.claude/logs/mcp-*.log
```

#### Issue 2: Environment Variables Not Resolving

**Symptom:** `${VAR}` appears literally in command

**Fix:**

```bash
# Verify var is exported
echo $VAR_NAME

# Re-export in profile
export VAR_NAME="value"
source ~/.bash_profile

# Restart Claude Code
```

#### Issue 3: Skill Not Triggering

**Symptom:** Skill exists but doesn't activate

**Fixes:**

```bash
# Check frontmatter syntax
head -15 ~/.claude/skills/my-skill/SKILL.md

# Ensure model_invoked: true
# Check triggers match your prompt keywords

# Rebuild skill index
claude code skills refresh
```

---

## Best Practices

### 1. Scope Strategy

**User-level (`~/.claude/`):**

- Generic workflows (migrate, commit, tdd)
- Tool integrations (GitHub, Sentry)
- Personal conventions

**Project-level (`./.claude/`):**

- Project-specific patterns
- Domain knowledge
- Codebase conventions
- Architecture docs

**When to override:**

- Project skill can specialize user skill
- Example: User `commit` skill + project `commit-tmnl` skill with Effect conventions

### 2. Environment Variable Management

**Use `.env` files for projects:**

```bash
# ./.claude/.env (add to .gitignore!)
EXA_API_KEY=your-key
GITHUB_TOKEN=ghp_...
DATABASE_URL=postgresql://...
```

**Reference in mcp.json:**

```json
{
  "mcpServers": {
    "myserver": {
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

**Claude Code auto-loads** `.claude/.env` files.

### 3. Skill Documentation

**Follow progressive disclosure:**

```
skill-name/
  ├── SKILL.md           # Core: what, when, how (brief)
  ├── examples.md        # Usage examples (load on demand)
  ├── patterns.md        # Deep patterns (load on demand)
  └── troubleshooting.md # Edge cases (load on demand)
```

**SKILL.md loads first**, others only when needed.

### 4. Version Control

**What to commit:**

```
.claude/
  ├── skills/           # ✅ Commit (shared conventions)
  ├── mcp.json          # ✅ Commit (template with ${VARS})
  ├── config.json       # ✅ Commit (team settings)
  └── .env              # ❌ Gitignore (secrets)
```

**`.gitignore` entry:**

```gitignore
.claude/.env
.claude/logs/
.claude/cache/
```

### 5. Cross-Platform Skills

**Agent Skills standard** works across:

- Claude Code
- OpenCode
- VS Code with Copilot
- Cursor
- Gemini CLI

**Ensure compatibility:**

- Use SKILL.md (not README.md)
- YAML frontmatter required
- Avoid tool-specific references

---

## Migration Automation Script

**Save as `migrate-to-claudecode.sh`:**

```bash
#!/bin/bash
set -e

echo "🚀 Migrating to Claude Code..."

# Backup existing configs
echo "📦 Backing up configs..."
mkdir -p ~/claude-migration-backup
cp -r ~/.claude ~/claude-migration-backup/claude-$(date +%Y%m%d)
[ -d ~/.opencode ] && cp -r ~/.opencode ~/claude-migration-backup/opencode-$(date +%Y%m%d)

# Create Claude Code structure
echo "📁 Creating Claude Code directories..."
mkdir -p ~/.claude/skills
mkdir -p ~/.claude/plugins
mkdir -p ~/.claude/logs

# Migrate OpenCode MCPs if exist
if [ -f ~/.opencode/mcp.json ]; then
  echo "🔄 Migrating OpenCode MCP config..."
  cat ~/.opencode/mcp.json | jq '{
    "$schema": "https://raw.githubusercontent.com/anthropics/claude-code/main/schemas/mcp-config-schema.json",
    "mcpServers": .mcpServers
  }' > ~/.claude/mcp.json
fi

# Migrate Claude Desktop MCPs if exist
if [ -f ~/.config/Claude/claude_desktop_config.json ]; then
  echo "🔄 Migrating Claude Desktop MCP config..."
  cat ~/.config/Claude/claude_desktop_config.json | jq '{
    "$schema": "https://raw.githubusercontent.com/anthropics/claude-code/main/schemas/mcp-config-schema.json",
    "mcpServers": .mcpServers
  }' >> ~/.claude/mcp.json
fi

# Validate
echo "✅ Validating mcp.json..."
cat ~/.claude/mcp.json | jq . > /dev/null || echo "⚠️  Warning: Invalid JSON in mcp.json"

echo ""
echo "✨ Migration complete!"
echo ""
echo "Next steps:"
echo "1. Update environment variables in ~/.bash_profile or ~/.zshrc"
echo "2. Run: claude code mcp list"
echo "3. Verify skills: claude code skills list"
echo "4. Test: claude code --prompt 'Test MCP servers'"
```

**Usage:**

```bash
chmod +x migrate-to-claudecode.sh
./migrate-to-claudecode.sh
```

---

## Quick Reference

### Essential Commands

```bash
# MCP Management
claude code mcp list              # List all MCP servers
claude code mcp status <name>     # Check server status
claude code mcp restart [name]    # Restart server(s)
claude code mcp add <name>        # Add new MCP (wizard)

# Skill Management
claude code skills list           # List all skills
claude code skills refresh        # Rebuild skill index
claude code skills add <name>     # Create new skill (wizard)

# Configuration
claude code config show           # Show current config
claude code config edit           # Edit in $EDITOR

# Logs
tail -f ~/.claude/logs/main.log
tail -f ~/.claude/logs/mcp-*.log
```

### File Paths

| Config         | Path                          |
| -------------- | ----------------------------- |
| User MCP       | `~/.claude/mcp.json`          |
| Project MCP    | `./.claude/mcp.json`          |
| User Skills    | `~/.claude/skills/*/SKILL.md` |
| Project Skills | `./.claude/skills/*/SKILL.md` |
| Plugins        | `~/.claude/plugins/`          |
| Logs           | `~/.claude/logs/`             |
| Config         | `~/.claude/config.json`       |

---

## Next Steps

After migration:

1. **Explore Plugins:**

   ```bash
   claude code plugins search
   claude code plugins install @claude-plugins-official/github
   ```

2. **Create Custom Subagents:**

   - For specialized tasks (testing, deployment, etc.)
   - See: https://code.claude.com/docs/en/subagents

3. **Set Up Hooks:**

   - Automate workflows (pre-commit, on-file-save, etc.)
   - See: https://code.claude.com/docs/en/hooks

4. **Optimize Skills:**
   - Review trigger keywords for precision
   - Add progressive disclosure docs
   - Share project skills in repo

---

## Resources

- **Official Docs:** https://code.claude.com/docs
- **MCP Spec:** https://modelcontextprotocol.io
- **Agent Skills Standard:** https://github.com/anthropics/claude-code/blob/main/docs/agent-skills-standard.md
- **MCP Server Registry:** https://github.com/modelcontextprotocol/servers
- **Plugin Marketplace:** https://code.claude.com/plugins

---

## Troubleshooting

### Get Help

```bash
# Verbose logs
claude code --verbose --prompt "Your prompt"

# Check diagnostics
claude code diagnostics

# Report issue
claude code feedback
```

### Community

- **Discord:** https://discord.gg/claude
- **GitHub Discussions:** https://github.com/anthropics/claude-code/discussions
- **Stack Overflow:** Tag `claude-code`

---

**Last Updated:** January 2026  
**Version:** 1.0  
**Compatibility:** Claude Code 2.0+
