---
name: context7
description: Library documentation lookup via Context7/Upstash. Use for quick, cached, structured API docs for any npm/pypi package with code examples.
---

# Context7

Library documentation lookup via Context7/Upstash. Fast, cached, structured.

## When to Use

- Quick library documentation lookups
- Finding up-to-date API docs for any npm/pypi package
- Getting structured docs with code examples
- When you need docs but don't know the exact API

## Tools

| Tool | Description |
|------|-------------|
| `context7_resolve-library-id` | Resolve a library name to a Context7 library ID |
| `context7_query-docs` | Query documentation for a resolved library |

## Usage Patterns

### Step 1: Resolve Library

```
context7_resolve-library-id query="effect" libraryName="effect"
```

### Step 2: Query Docs

```
context7_query-docs libraryId="<id from step 1>" query="Schema.Struct"
```

## Best Practices

1. **Resolve first** — Always get the library ID before querying
2. **Both params required** — `query` and `libraryName` for resolve; `libraryId` and `query` for docs
3. **Use specific queries** — "Schema.Struct fields" > "schemas"
