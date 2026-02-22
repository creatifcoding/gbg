---
name: mcp-bridge
description: Bridges Model Context Protocol (MCP) servers to pi, exposing their tools for LLM use. Use when adding, debugging, or managing MCP server integrations and their companion skills.
---

# MCP Bridge Extension

Bridges Model Context Protocol (MCP) servers to pi, exposing their tools for LLM use.

## Architecture

```
.pi/
├── extensions/
│   └── mcp-bridge/
│       ├── index.ts              # Extension entry point
│       ├── package.json          # Dependencies (@modelcontextprotocol/sdk)
│       └── node_modules/
├── mcp.json                      # MCP server configuration (SOLE SOURCE)
├── mcp-tools-cache.json          # Auto-generated tool cache (DO NOT EDIT)
└── skills/
    └── mcp-bridge/               # This skill
        └── templates/
            └── skill-template.md # Template for new MCP skills
```

## How It Works

1. **Load**: Reads `.pi/mcp.json` for server configs
2. **Cache check**: Reads `.pi/mcp-tools-cache.json` for discovered tools
3. **First run**: If no cache, runs discovery subprocess → connects to all servers → caches tools
4. **Register**: Tools registered **synchronously** from cache at extension load time
5. **Lazy connect**: MCP servers connect on first tool invocation, not at startup
6. **Background refresh**: Cache refreshed in `session_start` if older than 1 hour

### Why Cache?

Pi requires synchronous tool registration. MCP connections are async. The cache bridges this:
- First run: ~60s discovery (one-time cost)
- Subsequent loads: instant (read JSON file)
- `/mcp-refresh` to force re-discovery

## Configuration: `.pi/mcp.json`

The **only** configuration file. No Claude config dependency.

```json
{
  "mcpServers": {
    "server-name": {
      "type": "http|sse|stdio",
      // ... transport-specific config
    }
  }
}
```

## Transport Types

### HTTP (StreamableHTTP) — For remote servers

```json
"exa": {
  "type": "http",
  "url": "https://mcp.exa.ai/mcp?exaApiKey=YOUR_KEY"
}
```

### SSE (Legacy) — For older servers

```json
"deepwiki": {
  "type": "sse",
  "url": "https://example.com/sse"
}
```

### Stdio — For local/npm packages

```json
"effect-docs": {
  "type": "stdio",
  "command": "bunx",
  "args": ["effect-mcp@latest"]
}
```

## Commands

| Command | Description |
|---------|-------------|
| `/mcp` | Show server status and registered tools |
| `/mcp-refresh` | Force re-discover tools from all servers |

## Adding a New MCP Server

1. Add to `.pi/mcp.json`
2. Run `/mcp-refresh` or delete `.pi/mcp-tools-cache.json` and restart
3. Create companion skill — see **Skill Authoring** below

## Skill Authoring — CRITICAL

**Every MCP server MUST have a companion skill** in `.pi/skills/<server-name>/SKILL.md`.

### YAML Frontmatter is REQUIRED

Pi discovers skills via YAML frontmatter. **Without it, the skill is invisible.** The agent cannot use it, the user cannot invoke it via `/skill:name`, and it won't appear in `<available_skills>`.

### Minimum Viable Skill

```markdown
---
name: server-name
description: One sentence describing what this MCP does and when to use it.
---

# Server Name

Description of the MCP server.

## Tools

| Tool | Description |
|------|-------------|
| `server-name_tool1` | What it does |

## Usage Patterns

### Basic Usage

\`\`\`
server-name_tool1 param="value"
\`\`\`
```

### Frontmatter Rules (from Pi spec)

| Field | Required | Rules |
|-------|----------|-------|
| `name` | **YES** | Lowercase a-z, 0-9, hyphens. Must match parent directory name. Max 64 chars. |
| `description` | **YES** | What it does AND when to use it. Max 1024 chars. **Missing = skill not loaded.** |
| `license` | No | License name |
| `metadata` | No | Arbitrary key-value |

### Template

A full template is available at: [templates/skill-template.md](templates/skill-template.md)

Or use the generator script:

```bash
.pi/skills/mcp-bridge/scripts/new-mcp-skill.sh <server-name> "<description>"
```

### When Updating Existing Skills

**NEVER strip frontmatter.** If you're editing a skill file:

1. **Check for existing frontmatter** — Look for `---` fences at the top
2. **Preserve it** — If present, keep the `name` and `description` fields intact
3. **Add it** — If missing, add frontmatter BEFORE any other content
4. **Validate** — `name` must match the parent directory name

### Current Skills

Each MCP server has a companion skill:

| Server | Skill Location |
|--------|---------------|
| deepwiki | `.pi/skills/deepwiki-research/SKILL.md` |
| exa | `.pi/skills/exa-search/SKILL.md` |
| context7 | `.pi/skills/context7/SKILL.md` |
| effect-docs | `.pi/skills/effect-docs/SKILL.md` |
| anime-js | `.pi/skills/animejs-docs/SKILL.md` |
| nia | `.pi/skills/nia-docs/SKILL.md` |
| firecrawl | `.pi/skills/firecrawl/SKILL.md` |

## Debugging

```bash
# View connection logs during pi startup
pi 2>&1 | grep "\[mcp-bridge\]"

# Test extension in isolation
bun -e "import ext from './.pi/extensions/mcp-bridge/index.ts'; ..."

# Force fresh discovery
rm .pi/mcp-tools-cache.json && restart pi
```

## Performance: bunx vs npx

**Always prefer `bunx` over `npx`** for stdio servers (10-60x faster).

**Exception**: Some packages fail with bunx (e.g., deepwiki-mcp uses npx).
