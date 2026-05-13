# @nx/jest/plugin

> up: INDEX.md
> prereqs: none
> provides: test target (Jest)
> children: none

## Source
`@nx/jest/plugin` (npm)

## Infers From
`jest.config.*` presence.

## Targets

| Target | What It Does | Cached |
|---|---|---|
| test | `jest --passWithNoTests` | ✓ |

## Options (nx.json)

| Option | Default |
|---|---|
| targetName | `"test"` |

## When To Care
Legacy test runner. New @tmnl/* packages use vitest (inferred by `@nx/vite/plugin`). Jest is still used by some @gbg/* packages.
