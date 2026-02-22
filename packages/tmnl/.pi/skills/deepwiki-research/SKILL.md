---
name: deepwiki-research
description: Repository-aware documentation search via DeepWiki. Use for understanding GitHub repo architecture, verifying Effect-TS patterns against canonical sources, and researching library implementations. Includes AI-powered Q&A via ask_question.
---

# DeepWiki Research

Repository-aware documentation search and AI-powered Q&A for any public GitHub repo.

## When to Use

- Understanding a GitHub repository's architecture
- Finding patterns and conventions in open source projects
- Researching how a library implements specific features
- Verifying implementation approaches against canonical sources
- **Asking natural-language questions** about any repo and getting grounded answers
- **CRITICAL**: Use for Effect-TS pattern verification against `Effect-TS/effect`

## Tools

| Tool | Description |
|------|-------------|
| `deepwiki_read_wiki_structure` | Get the documentation topic index for a repo (owner/repo) |
| `deepwiki_read_wiki_contents` | Read documentation content for a specific topic |
| `deepwiki_ask_question` | **AI-powered Q&A** — ask any question about a repo, get a context-grounded response |

## Usage Patterns

### Quick Answer (Preferred for Specific Questions)

Use `ask_question` when you have a specific question about a repo:

```
deepwiki_ask_question repo="Effect-TS/effect" question="How does Schema.TaggedStruct work internally?"
```

### Browse Documentation

For exploring repo structure and reading docs:

```
1. deepwiki_read_wiki_structure repo="Effect-TS/effect"
2. deepwiki_read_wiki_contents path="<path from structure>"
```

### Effect-TS Pattern Verification

```
# Quick: ask directly
deepwiki_ask_question repo="Effect-TS/effect" question="What is the canonical pattern for Atom.runtime with service layers?"

# Deep: browse the docs
1. deepwiki_read_wiki_structure repo="Effect-TS/effect"
2. deepwiki_read_wiki_contents path="<schema-related page>"
```

## Key Repositories

| Repo | Use For |
|------|---------|
| `Effect-TS/effect` | Effect patterns, Schema, Services |
| `tim-smart/effect-atom` | effect-atom patterns |
| `statelyai/xstate` | XState v5 patterns |
| `TanStack/query` | Data fetching patterns |

## Best Practices

1. **Prefer `ask_question` for specific queries** — faster, AI-grounded, no index browsing needed
2. **Use structure + contents for exploration** — when you need to survey what's available
3. **Repo format is `owner/repo`** — e.g. `Effect-TS/effect`, not separate params
4. **Verify patterns before implementation** — use as ground truth
5. **Combine with effect-docs** — DeepWiki for patterns/architecture, effect-docs for API signatures
