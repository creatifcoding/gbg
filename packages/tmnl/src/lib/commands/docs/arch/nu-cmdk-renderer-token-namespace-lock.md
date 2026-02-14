# NuCmdk Renderer Token Namespace Lock

**Status:** Locked  
**Date:** 2026-02-13

---

## Decision

Renderer token namespace is locked to a fully-qualified format:

```text
<providerId>/<variantKey>/<viewKind>@v<major>
```

Examples:

- `commands/command/list@v1`
- `filesystem/file/list@v1`
- `docs/document/preview@v2`
- `agent/workflow/list@v1`

---

## Why this format

1. Avoids collisions across provider ecosystems.
2. Encodes variant + view intent in the token itself.
3. Enables controlled major-version upgrades for renderers.
4. Makes diagnostics readable and searchable.

---

## Formal constraints

## Token regex

```text
^[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*@v[1-9][0-9]*$
```

## Segment constraints

- `providerId`, `variantKey`, `viewKind` are lowercase kebab-safe identifiers.
- `@v<major>` must be positive integer major version.
- No whitespace.
- No trailing slash.

---

## Registry resolution contract

Resolution order:

1. exact token match
2. same provider/variant/view with lower compatible major (if policy allows)
3. variant fallback token
4. global fallback renderer (last resort)

If all fail: row is dropped + diagnostic emitted.

---

## Compatibility policy

- Major version mismatch is **breaking**.
- Minor and patch are handled inside component implementation, not token.
- Renderer registry must explicitly register every supported major.

---

## Manifest requirements

Every `VariantManifestEntry` must include:

- `rendererToken`
- `fallbackRendererToken?`

And both must pass namespace regex validation.

---

## Example validator (TypeScript)

```ts
export const RENDERER_TOKEN_RE =
  /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*@v[1-9][0-9]*$/

export const isValidRendererToken = (token: string) =>
  RENDERER_TOKEN_RE.test(token)
```

---

## Observability requirements

On each row render resolution attempt, emit:

- providerId
- laneId
- rowId
- rendererToken
- resolutionOutcome (`exact|compatible|fallback|drop`)
- resolvedComponentId

---

## Relationship to decision lock

This document resolves Decision Lock follow-up item:

- "Renderer token namespace format"

and should be treated as normative for implementation.
