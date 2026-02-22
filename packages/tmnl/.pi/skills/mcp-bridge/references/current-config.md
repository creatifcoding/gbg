# Current MCP Configuration

## `.pi/mcp.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/anthropics/claude-code/main/schemas/mcp-config-schema.json",
  "mcpServers": {
    "exa": {
      "type": "http",
      "url": "https://mcp.exa.ai/mcp?tools=web_search_exa,get_code_context_exa,crawling_exa,company_research_exa,linkedin_search_exa,deep_researcher_start,deep_researcher_check&exaApiKey=1fb06823-dbc5-4807-a918-4bad42c80221"
    },
    "deepwiki": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "deepwiki-mcp@latest"],
      "env": {}
    },
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    },
    "effect-docs": {
      "type": "stdio", 
      "command": "bunx",
      "args": ["effect-mcp@latest"],
      "env": {}
    },
    "anime-js": {
      "type": "stdio",
      "command": "bunx",
      "args": ["anime-js-mcp-server"],
      "env": {}
    },
    "nia": {
      "type": "http",
      "url": "https://apigcp.trynia.ai/mcp",
      "headers": {
        "Authorization": "Bearer nk_ckU9ikCxZBVBhwaY4bKDIBBfrbRyJSK8"
      }
    },
    "firecrawl": {
      "type": "stdio",
      "command": "bunx",
      "args": ["firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "fc-a27a281ff25446b799fe521044eefe65"
      }
    }
  }
}
```

## Server Details

### exa (7 tools)
**Type**: HTTP | **Connect time**: ~800ms

Web search and research via Exa AI.

Tools:
- `web_search_exa` — Web search
- `get_code_context_exa` — Code search
- `crawling_exa` — Web crawling
- `company_research_exa` — Company research
- `linkedin_search_exa` — LinkedIn search
- `deep_researcher_start` — Start deep research
- `deep_researcher_check` — Check research status

### deepwiki (2 tools)
**Type**: stdio (npx) | **Connect time**: ~11s

Query documentation from GitHub repositories via DeepWiki.

Tools:
- `read_wiki_structure` — Get repo wiki structure
- `read_wiki_contents` — Read wiki page contents

**Note**: Uses npx due to bunx incompatibility.

### context7 (2 tools)
**Type**: HTTP | **Connect time**: ~700ms

Library documentation search via Context7/Upstash.

Tools:
- `resolve-library-id` — Resolve library to ID
- `get-library-docs` — Get library documentation

### effect-docs (2 tools)
**Type**: stdio (bunx) | **Connect time**: ~600ms

Effect-TS documentation and examples.

Tools:
- `search_effect_docs` — Search Effect documentation
- `get_effect_examples` — Get code examples

### anime-js (5 tools)
**Type**: stdio (bunx) | **Connect time**: ~400ms

Anime.js animation library assistance.

Tools:
- `get_animation_help` — Animation guidance
- `generate_animation` — Generate animation code
- `explain_animation` — Explain animation concepts
- `suggest_easing` — Suggest easing functions
- `validate_animation` — Validate animation code

### nia (11 tools)
**Type**: HTTP | **Connect time**: ~2-3s

Documentation search via Nia.

Tools:
- Various documentation search and retrieval tools

### firecrawl (8 tools)
**Type**: stdio (bunx) | **Connect time**: ~200ms

Web scraping and content extraction.

Tools:
- `scrape` — Scrape single URL
- `crawl` — Crawl website
- `map` — Map website structure
- `extract` — Extract structured data
- `deep_research` — Research a topic
- `llm_extract` — LLM-powered extraction
- `generate_llm_extract_schema` — Generate extraction schema
- `check_crawl_status` — Check crawl job status

## Performance Summary

| Server | Type | Tools | Time | Notes |
|--------|------|-------|------|-------|
| firecrawl | bunx | 8 | ~200ms | Fastest |
| anime-js | bunx | 5 | ~400ms | |
| effect-docs | bunx | 2 | ~600ms | |
| context7 | HTTP | 2 | ~700ms | |
| exa | HTTP | 7 | ~800ms | |
| nia | HTTP | 11 | ~2-3s | Most tools |
| deepwiki | npx | 2 | ~11s | Slowest (npx required) |

**Total**: 37 tools available
