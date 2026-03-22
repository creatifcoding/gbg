# Effect Submodule Research — HttpLayerRouter/Internal API Design Notes

**Status:** Completed research snapshot
**Date:** 2026-02-14
**Source:** `../../submodules/effect`
**Purpose:** Extract architectural patterns from `HttpLayerRouter` and `internal/httpRouter` to inform NuCmdk provider+adapter middleware/router design.

---

## Files inspected

- `packages/platform/src/HttpLayerRouter.ts`
- `packages/platform/src/internal/httpRouter.ts`
- `packages/platform/README.md` (middleware/combine examples)

---

## Key findings (with anchor references)

## 1) Router is a service with explicit composition API

`HttpLayerRouter.HttpRouter` exposes service methods for incremental composition:

- `prefixed` (`HttpLayerRouter.ts:58`)
- `add` (`HttpLayerRouter.ts:60`)
- `addAll` (`HttpLayerRouter.ts:73`)
- `addGlobalMiddleware` (`HttpLayerRouter.ts:82`)
- `asHttpEffect` (router execution entry)

`make` constructs router + middleware registries once (`HttpLayerRouter.ts:114`).

**Pattern takeaway:** Keep orchestration state in a service object, not ad-hoc free functions.

---

## 2) Local middleware and global middleware are first-class and distinct

- Global middleware path uses `addGlobalMiddleware` (`HttpLayerRouter.ts:170`, `:711`).
- Local middleware created via `middleware(...).layer` (`HttpLayerRouter.ts:687+`).

`middleware` can create typed middleware objects with `.combine(...)` (`HttpLayerRouter.ts:722+`).

**Pattern takeaway:** model both scopes explicitly:
- per-route/per-adapter middleware
- global cross-cutting middleware

---

## 3) Middleware ordering and dedupe is deterministic

`addAll` resolves middleware from context and wraps handlers in a stable order (`HttpLayerRouter.ts:128-137`).

`getMiddleware(...)` caches derived middleware stacks and dedupes across dependencies (`HttpLayerRouter.ts:772-799`).

Global middleware wrapping in runtime execution is applied with reverse ordering (`HttpLayerRouter.ts:212`).

**Pattern takeaway:** middleware assembly cannot be implicit; ordering and dedupe must be deterministic and cached.

---

## 4) Request requirements are encoded in types (phantom request channels)

`Request<Kind, T>` and utility types (`From`, `Only`, `Without`) are used to track required/provided/error channels (`HttpLayerRouter.ts:508+`).

Router distinguishes:
- `Provided` context (`HttpLayerRouter.ts:545`)
- `GlobalProvided` context (`HttpLayerRouter.ts:557`)

**Pattern takeaway:** type-level requirement channels make middleware safety compositional.

---

## 5) Internal router shows parse/decode helpers as shared edge utilities

`internal/httpRouter.ts` exposes centralized schema decode helpers:
- `schemaJson` (`internal/httpRouter.ts:47`)
- `schemaNoBody` (`:85`)
- `schemaParams` (`:120`)
- `schemaPathParams` (`:136`)

Route context, params, and parsed search params are pushed into context once and reused (`internal/httpRouter.ts:253`, `:278`).

**Pattern takeaway:** parse/marshalling should be centralized and reused, not duplicated per handler.

---

## 6) Runtime entry points separate composition vs serving

- `serve(...)` composes app layer + router + optional server middleware (`HttpLayerRouter.ts:1058+`).
- `toWebHandler(...)` composes similarly for handler embedding (`HttpLayerRouter.ts:1114+`).

**Pattern takeaway:** separate route graph composition from runtime execution adapters.

---

## 7) README examples confirm intended usage patterns

`packages/platform/README.md` sections:
- Applying middleware (`README.md:4908+`)
- Interdependent middleware + `.combine` (`README.md:4969+`)

**Pattern takeaway:** local middleware composition should be user-extensible and explicit.

---

## Implications for NuCmdk

For provider/adapter orchestration we should mirror these principles:

1. **Service router abstraction** for adapter registration and dispatch.
2. **Typed middleware contracts** with global + per-adapter scope.
3. **Deterministic middleware assembly** (ordered + deduped + cached).
4. **Type-tracked requirements** for parse/validation/marshalling dependencies.
5. **Shared query parse artifacts** produced once and reused by heavy adapters.
