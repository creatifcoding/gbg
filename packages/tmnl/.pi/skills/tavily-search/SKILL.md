# Tavily Search

Web search, content extraction, and deep research via Tavily MCP.

## When to Use

- **Web search** — real-time information, news, documentation lookups
- **Content extraction** — pull structured content from known URLs
- **Replacement/complement for Exa** when Exa returns 402 errors

## Available Tools

| Tool | Purpose |
|---|---|
| `tavily-search` | Web search with filtering, domain scoping, depth control |
| `tavily-extract` | Extract readable content from one or more URLs |

## tavily-search Parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `query` | string | required | Search query |
| `search_depth` | `"basic"` \| `"advanced"` | `"basic"` | Advanced = deeper crawl, slower |
| `topic` | `"general"` \| `"news"` \| `"finance"` | `"general"` | Topic category |
| `max_results` | number | 5 | Max results (1-20) |
| `include_domains` | string[] | — | Restrict to these domains |
| `exclude_domains` | string[] | — | Exclude these domains |
| `include_raw_content` | boolean | false | Include full page content |
| `include_images` | boolean | false | Include image URLs |
| `days` | number | — | Recency filter (last N days) |

## tavily-extract Parameters

| Param | Type | Notes |
|---|---|---|
| `urls` | string[] | URLs to extract content from |

## Usage Patterns

### Quick web search
```
tavily-search({ query: "Effect-TS Schema.TaggedStruct examples" })
```

### News search with recency
```
tavily-search({ query: "AI agent frameworks", topic: "news", days: 7 })
```

### Domain-scoped search
```
tavily-search({ 
  query: "useEffect cleanup", 
  include_domains: ["react.dev", "github.com"],
  search_depth: "advanced"
})
```

### Extract content from URL
```
tavily-extract({ urls: ["https://effect.website/docs/schema/classes"] })
```

## Search Tool Routing (updated)

| Need | Primary | Fallback |
|---|---|---|
| General web search | `tavily-search` | `firecrawl_search`, `web_search` |
| Code examples | `exa_get_code_context` | `tavily-search` with domain filter |
| Company research | `exa_company_research` | `tavily-search` with topic |
| Deep research | `nia_research` | `tavily-search` advanced depth |
| GitHub repo docs | `deepwiki` | `nia_tracer` |
| Library API docs | `context7`, `effect-docs` | `tavily-extract` on docs URL |
| Scrape specific page | `firecrawl_scrape` | `tavily-extract` |
