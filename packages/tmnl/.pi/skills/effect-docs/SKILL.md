---
name: effect-docs
description: Official Effect-TS documentation and API reference. Use for looking up Effect API signatures, Schema patterns, module organization, and migration guides.
---

# Effect Documentation

Official Effect-TS documentation and API reference.

## When to Use

- Looking up Effect API signatures and types
- Finding official examples and usage patterns
- Understanding module organization (Effect, Schema, Stream, etc.)
- Migration guides between Effect versions
- **Primary source** for "how do I use X in Effect?"

## Tools

| Tool | Description |
|------|-------------|
| `effect-docs_effect_docs_search` | Search Effect documentation (returns documentIds) |
| `effect-docs_get_effect_doc` | Get full doc content by documentId (may be paginated) |

## Usage Patterns

### Search then Read

```
1. effect-docs_effect_docs_search query="SchemaAST getPropertySignatures"
2. effect-docs_get_effect_doc documentId="<id from search>" page=1
```

### API Lookup

```
effect-docs_effect_docs_search query="Schema.TaggedStruct"
```

### Module Discovery

```
effect-docs_effect_docs_search query="@effect/sql Model"
```

## Best Practices

1. **Search first** — `effect_docs_search` returns document IDs
2. **Then read** — `get_effect_doc` with the documentId to get content
3. **Paginated** — Content may span multiple pages, use `page` param
4. **Combine with deepwiki** — effect-docs for API, deepwiki for real-world patterns
