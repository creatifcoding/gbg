# @nx/next/plugin

> up: INDEX.md
> prereqs: none
> provides: build, dev, start targets (Next.js)
> children: none

## Source
`@nx/next/plugin` (npm)

## Infers From
`next.config.*` presence.

## Targets

| Target | What It Does | Cached |
|---|---|---|
| build | `next build` | ✓ |
| dev | `next dev` | — |
| start | `next start` (production server) | — |
| serve-static | Serve static export | — |
| build-deps | Build upstream deps | — |
| watch-deps | Watch upstream deps | — |

## Options (nx.json)

| Option | Default |
|---|---|
| startTargetName | `"start"` |
| buildTargetName | `"build"` |
| devTargetName | `"dev"` |
| serveStaticTargetName | `"serve-static"` |

## Generator Defaults
`@nx/next application` → `style: tailwind`, `linter: eslint`

## When To Care
Used by `@gbg/gotby` (Next.js app). Not relevant for @tmnl/* library packages.
