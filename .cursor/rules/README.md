# Cursor Command Rules

Rules that apply to all Cursor commands and AI actions.

## Available Rules

- **[AI_ACTION_TREATMENT.md](AI_ACTION_TREATMENT.md)** - How to treat AI actions as user commands
- **[MCP_USAGE.md](MCP_USAGE.md)** - MCP usage requirements and patterns

## Quick Reference

### AI Action Treatment

When user says "do X" without `/command`, treat as if `/command` was called:
- Same format and context
- But think through actual implementation
- Examples are illustrative, not literal

### MCP Usage

Always use MCPs when available:
- Hygraph MCP for schema/model validation
- Exa MCP for code/documentation
- Docfork MCP for framework docs
- Think through which MCP is appropriate

## How Commands Reference Rules

Commands should include:

```markdown
## Important Rules

See `.cursor/rules/` for:
- AI Action Treatment: [AI_ACTION_TREATMENT.md](../../rules/AI_ACTION_TREATMENT.md)
- MCP Usage: [MCP_USAGE.md](../../rules/MCP_USAGE.md)
```

## Key Principles

1. **Examples are illustrative** - Think through actual implementation
2. **Use MCPs** - Validate and get current information
3. **Treat AI actions as commands** - Same format and context
4. **Think, don't copy** - Understand requirements, don't follow examples literally

