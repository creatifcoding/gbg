# @nx/vite/plugin

> up: INDEX.md
> prereqs: none
> provides: build, test, dev, serve, preview targets
> children: none

## Source
`@nx/vite/plugin` (npm)

## Infers From
`vite.config.*` or `vitest.config.*` presence.

## Targets

| Target | What It Does | Cached |
|---|---|---|
| build | `vite build` | ✓ |
| test | `vitest run` | ✓ |
| dev | `vite dev` | — |
| serve | `vite preview` (built output) | — |
| preview | `vite preview` | — |
| serve-static | Serve static files | — |
| typecheck | `tsc --noEmit` (if vite config exists) | ✓ |
| build-deps | Build upstream deps | — |
| watch-deps | Watch upstream deps | — |

## Options (nx.json)

| Option | Default |
|---|---|
| buildTargetName | `"build"` |
| testTargetName | `"test"` |
| serveTargetName | `"serve"` |
| devTargetName | `"dev"` |
| previewTargetName | `"preview"` |
| serveStaticTargetName | `"serve-static"` |
| typecheckTargetName | `"typecheck"` |

## When To Care
Primary build/test plugin for Vite-based libraries and apps. stx uses vitest.config.ts so this plugin infers the `test` target. TMNL's Tauri frontend uses vite.config.ts for `build` and `dev`.
