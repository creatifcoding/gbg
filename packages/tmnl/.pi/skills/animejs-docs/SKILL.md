---
name: animejs-docs
description: Anime.js v4 documentation, animation examples, and API reference. Use when working with anime.js animations, easing functions, SVG animation, or verifying v4 vs v3 API differences.
---

# Anime.js Documentation

Anime.js v4 documentation and animation assistance.

**IMPORTANT**: Anime.js v4 API differs significantly from v3. Always verify patterns.

## When to Use

- Looking up anime.js v4 API and components
- Finding animation examples and patterns
- Understanding easing functions and timing
- SVG animation techniques

## Tools

| Tool | Description |
|------|-------------|
| `anime-js_get_anime_component` | Get info/examples for a specific component or API |
| `anime-js_list_anime_components` | List all available components and APIs |
| `anime-js_get_anime_example` | Get example code for a specific animation pattern |
| `anime-js_search_anime_examples` | Search examples and code snippets |
| `anime-js_get_anime_docs` | Get documentation for features and concepts |

## Usage Patterns

### Look Up a Component

```
anime-js_get_anime_component componentName="animate"
```

### Browse All Components

```
anime-js_list_anime_components category="all"
```

### Find Examples

```
anime-js_search_anime_examples query="SVG path morphing"
```

### Get Docs on a Topic

```
anime-js_get_anime_docs topic="easing functions"
```

## v4 vs v3 Gotchas

```typescript
// WRONG — v3 syntax
animate({ targets: element, opacity: 0 })

// CORRECT — v4 syntax
animate(element, { opacity: 0 })
```
