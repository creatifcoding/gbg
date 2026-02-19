# Decision: Effect Schema Integration with genifer

> **Date**: 2026-01-15
> **Status**: DECIDED
> **Decision**: Fork genifer to accept generic schema interface

## Context

We need genifer (Vercel Labs' guardrailed UI generation library) to work with Effect Schema instead of Zod for the Generative Entity Card smoke test.

## Research Findings

### Adapter Approach (FAILED)

We attempted to create a `effectToZodLike()` adapter that wraps Effect Schema with a Zod-like API:

```typescript
// What we tried
function effectToZodLike<A>(schema: Schema.Schema<A>): ZodType<A> {
  return {
    parse: (input) => Schema.decodeUnknownSync(schema)(input),
    safeParse: (input) => { /* ... */ },
    _type: undefined as A,
    _def: { typeName: 'ZodObject' },
  }
}
```

**Result**: Unit tests pass (7/10), but catalog integration fails (3/10).

**Root cause**: Zod v4 uses internal trait checks:
```javascript
// Inside Zod v4's schema composition
if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
  throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
}
```

Our adapter can't satisfy these internal symbol checks.

### Effect → Zod Interop (NONE EXISTS)

Researched via:
- Effect docs: No Zod conversion API
- effect/Schema source: No Zod interop
- DeepWiki: Confirmed no bridges exist

### Standard Schema V1

Effect provides `Schema.standardSchemaV1()` which produces a Standard Schema V1 object:

```typescript
const standardSchema = Schema.standardSchemaV1(myEffectSchema)
// Returns StandardSchemaV1<Input, Output> interface
```

However:
- Zod v4 does NOT accept Standard Schema V1 as a valid schema
- genifer specifically uses Zod's internal APIs for schema composition

## Options Evaluated

| Option | Effort | Risk | Maintainability |
|--------|--------|------|-----------------|
| Fork genifer | Medium | Low | Good |
| Dual schemas (Effect + Zod) | Low | High (drift) | Poor |
| Effect → JSON Schema → Zod | High | Medium | Poor |

## Decision

**Fork genifer** to accept a generic schema interface.

### Implementation Plan

1. Fork `submodules/genifer` to `packages/genifer` (or modify in place)
2. Replace `z.ZodType` constraints with a generic `SchemaLike<T>` interface:
   ```typescript
   interface SchemaLike<T> {
     parse(input: unknown): T
     safeParse(input: unknown): { success: boolean; data?: T; error?: unknown }
   }
   ```
3. Update `createCatalog()` to accept `SchemaLike` instead of `z.ZodType`
4. Build internal validation using the generic interface, not Zod composition
5. Effect Schema satisfies `SchemaLike` via our adapter

### Benefits

- Full control over the code
- Clean Effect Schema integration
- No dual-schema maintenance
- Future-proof for other schema libraries

### Risks

- Upstream changes require manual merge
- Additional maintenance burden

## References

- Test file: `src/lib/genifer/__tests__/effect-catalog.test.ts`
- Adapter: `src/lib/genifer/effect-adapter.ts`
- genifer catalog: `submodules/genifer/packages/core/src/catalog.ts`
