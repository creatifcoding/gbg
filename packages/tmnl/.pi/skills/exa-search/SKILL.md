---
name: exa-search
description: Neural web search, code search, and deep research via Exa AI. Use for semantic web queries, finding code examples, company research, and multi-source synthesis.
---

# Exa Search

Neural web search, code search, and deep research via Exa AI.

## When to Use

- Semantic web search for current information
- Finding code examples and documentation
- Company research and competitive analysis
- Deep research tasks requiring multi-source synthesis
- Finding similar content to a given URL

## Tools

| Tool | Description |
|------|-------------|
| `exa_web_search_exa` | Search the web for any topic |
| `exa_get_code_context_exa` | Find code examples, docs, programming solutions |
| `exa_crawling_exa` | Get full content of a specific URL |
| `exa_company_research_exa` | Research a company's info, news, insights |
| `exa_linkedin_search_exa` | ⚠️ DEPRECATED — use people_search_exa |
| `exa_deep_researcher_start` | Start AI research agent for detailed reports |
| `exa_deep_researcher_check` | Check status/results of deep research task |

## Usage Patterns

### Web Search

```
exa_web_search_exa query="Effect-TS Schema.TaggedStruct patterns" numResults=5
```

### Code Search

```
exa_get_code_context_exa query="effect-atom Atom.runtime React hook pattern"
```

### Crawl a URL

```
exa_crawling_exa url="https://effect.website/docs/schema/basic-usage"
```

### Deep Research (async)

```
1. exa_deep_researcher_start instructions="Compare Effect-TS vs Zod schema validation"
2. exa_deep_researcher_check taskId="<id from step 1>"
```

## Best Practices

1. **Code search** — Use `get_code_context_exa` for programming questions
2. **Web search** — Use `web_search_exa` for general knowledge
3. **Deep research is async** — Start then check status after a delay
4. **numResults** — Default 8, lower for focused queries
