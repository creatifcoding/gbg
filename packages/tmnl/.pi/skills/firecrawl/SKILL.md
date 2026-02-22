---
name: firecrawl
description: Web scraping, crawling, and structured data extraction via Firecrawl. Use for scraping web pages, mapping site structure, LLM-powered extraction, and autonomous web data gathering.
---

# Firecrawl

Web scraping, crawling, and structured data extraction via Firecrawl.

## When to Use

- Scraping content from web pages
- Crawling entire websites
- Extracting structured data with LLM
- Mapping website structure
- Autonomous web data gathering

## Tools

| Tool | Description |
|------|-------------|
| `firecrawl_firecrawl_scrape` | Scrape content from a single URL |
| `firecrawl_firecrawl_map` | Map a website to discover all indexed URLs |
| `firecrawl_firecrawl_search` | Search the web and optionally extract content |
| `firecrawl_firecrawl_crawl` | Start a crawl job on a website |
| `firecrawl_firecrawl_check_crawl_status` | Check status of a crawl job |
| `firecrawl_firecrawl_extract` | Extract structured info using LLM |
| `firecrawl_firecrawl_agent` | Autonomous web data gathering agent |
| `firecrawl_firecrawl_agent_status` | Check status of an agent job |

## Usage Patterns

### Scrape a Page

```
firecrawl_firecrawl_scrape url="https://effect.website/docs/schema/basic-usage"
```

### Map a Website

```
firecrawl_firecrawl_map url="https://effect.website" search="schema"
```

### Search + Scrape

```
firecrawl_firecrawl_search query="Effect-TS Schema AST inspection" limit=5
```

### LLM Extraction

```
firecrawl_firecrawl_extract urls="https://example.com" prompt="Extract all API endpoints"
```

## Best Practices

1. **Scrape for single pages** — Fast, detailed content extraction
2. **Map before crawl** — Discover URLs first, then target crawl
3. **Crawl is async** — Start with `firecrawl_crawl`, check with `check_crawl_status`
4. **Agent is async** — Same pattern: start then check status
