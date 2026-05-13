# Perplexity Search

AI-powered web search, reasoning, and real-time research via Perplexity's API.

## When to Use

- Real-time web search for current information
- Research questions requiring synthesis across multiple sources
- Fact-checking and verification
- Finding recent news, updates, or documentation changes
- Questions where you need citations and sources

## Tools

The `perplexity` MCP provides:

| Tool | Description |
|------|-------------|
| `perplexity_search` | Search the web with AI-powered synthesis |
| `perplexity_reason` | Deep reasoning over search results |

## Usage Pattern

```
1. Formulate a clear, specific query
2. Call perplexity_search with the query
3. Review synthesized results with citations
4. Follow up with perplexity_reason for deeper analysis if needed
```

## Example Queries

- "What are the latest Effect-TS v4 breaking changes?"
- "Current best practices for React Server Components 2026"
- "Compare Bun vs Deno performance benchmarks recent"

## Notes

- Results include citations — use them to verify claims
- Better for synthesis than raw document retrieval
- Complements `exa` (raw search) and `deepwiki` (repo-specific docs)
