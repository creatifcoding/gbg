---
name: nia-docs
description: AI-powered library documentation search, code exploration, and research via Nia. Use for searching indexed repos, reading source files, exploring codebases, and getting AI-powered research answers.
---

# Nia Documentation

AI-powered library documentation search, code exploration, and research.

## When to Use

- Searching library documentation across any indexed repo
- Reading specific files from repositories
- Exploring codebase structure
- Getting AI-powered research answers about libraries
- Package search across registries

## Tools

| Tool | Description |
|------|-------------|
| `nia_search` | Search indexed repos, docs, papers, and local folders |
| `nia_index` | Index a repo/docs/paper (auto-detects type) |
| `nia_nia_read` | Read content from repo/docs/package/local folder |
| `nia_nia_grep` | Grep through indexed repositories |
| `nia_nia_explore` | Explore codebase structure |
| `nia_nia_research` | AI-powered research on a topic |
| `nia_nia_advisor` | Get advice on library usage |
| `nia_context` | Get context for a query |
| `nia_manage_resource` | Manage indexed resources and categories |
| `nia_nia_package_search_hybrid` | Search packages across registries |
| `nia_auto_subscribe_dependencies` | Auto-subscribe to project dependencies |

## Usage Patterns

### Search Documentation

```
nia_search query="Effect Schema getPropertySignatures"
```

### Index a Repository First

```
nia_index url="https://github.com/Effect-TS/effect"
```

### Read Specific File

```
nia_nia_read source_type="repository" path="packages/effect/src/SchemaAST.ts"
```

### AI Research

```
nia_nia_research query="How to inspect Effect Schema fields at runtime"
```

### Package Search

```
nia_nia_package_search_hybrid query="effect schema validation"
```

## Best Practices

1. **Index first** — Use `nia_index` before searching unindexed repos
2. **Search broadly** — `nia_search` covers all indexed sources
3. **Read for details** — After search, use `nia_read` for specific files
4. **Research for synthesis** — `nia_research` for AI-powered answers
