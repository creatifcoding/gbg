# Template for Updating Commands with Rules

When updating command files, add this section after the initial description:

```markdown
## Important Rules

See `.cursor/rules/` for:
- **AI Action Treatment**: [AI_ACTION_TREATMENT.md](../../rules/AI_ACTION_TREATMENT.md)
- **MCP Usage**: [MCP_USAGE.md](../../rules/MCP_USAGE.md)

**Implementation Notes:**
- Examples in this file are **illustrative, not literal** - think through actual implementation
- Use appropriate MCPs for validation and documentation
- Determine actual requirements from system state, not examples
```

## Key Points to Emphasize

1. **Examples are illustrative** - Don't copy literally, think through what's actually needed
2. **Use MCPs** - Validate and get current information
3. **Think through implementation** - Consider actual system state and requirements
4. **Treat AI actions as commands** - Same format, but thoughtful implementation

