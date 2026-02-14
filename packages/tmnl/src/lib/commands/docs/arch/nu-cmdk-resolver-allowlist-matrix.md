# NuCmdk Resolver Allow-list Matrix

**Status:** Locked  
**Date:** 2026-02-13

---

## Resolver tags in scope

- `CommandResolver`
- `NavigationResolver`
- `FileResolver`
- `RpcResolver`
- `HttpResolver`
- `ProviderCustomResolver`

Execution model remains data-resolver-only (typed specs), never raw closure execution.

---

## Scope matrix (allow / deny)

| Resolver Tag | global | editor | grid | tldraw | modal |
|---|---:|---:|---:|---:|---:|
| CommandResolver | ✅ | ✅ | ✅ | ✅ | ✅ |
| NavigationResolver | ✅ | ✅ | ✅ | ✅ | ⚠️ (allow-listed only) |
| FileResolver | ✅ | ✅ | ✅ | ⚠️ (read-only actions) | ❌ |
| RpcResolver | ✅ | ✅ | ✅ | ✅ | ⚠️ (read-only methods) |
| HttpResolver | ⚠️ (domain allow-list) | ⚠️ | ⚠️ | ⚠️ | ❌ |
| ProviderCustomResolver | ❌ default | ⚠️ explicit | ⚠️ explicit | ⚠️ explicit | ❌ |

Legend:

- ✅ allowed by default
- ⚠️ allowed with policy gates
- ❌ denied

---

## Capability gates

A resolver dispatch must pass all gates:

1. **Schema decode gate** — resolver payload decodes successfully.
2. **Tag allow-list gate** — resolver tag allowed in active scope.
3. **Action gate** — action/method/route/path allowed by policy.
4. **Credential gate** — required credentials/token context present.
5. **Redaction gate** — sensitive arguments redacted in logs.

Failure on any gate => deny dispatch + emit audit event.

---

## Policy object shape

```ts
type ResolverPolicy = {
  scope: "global" | "editor" | "grid" | "tldraw" | "modal"
  allowTags: ReadonlyArray<ExecutionResolverSpec["_tag"]>
  allowRoutes?: ReadonlyArray<string>
  allowDomains?: ReadonlyArray<string>
  allowRpcMethods?: ReadonlyArray<string>
  allowFileActions?: ReadonlyArray<"open" | "reveal" | "diff">
  allowProviderCustomResolverIds?: ReadonlyArray<string>
  readOnlyOnly?: boolean
}
```

---

## Effect Schema shape (runtime validation)

```ts
import { Schema } from "effect"

const Scope = Schema.Literal("global", "editor", "grid", "tldraw", "modal")
const ResolverTag = Schema.Literal(
  "CommandResolver",
  "NavigationResolver",
  "FileResolver",
  "RpcResolver",
  "HttpResolver",
  "ProviderCustomResolver",
)

export const ResolverPolicySchema = Schema.Struct({
  scope: Scope,
  allowTags: Schema.Array(ResolverTag),
  allowRoutes: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  allowDomains: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  allowRpcMethods: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  allowFileActions: Schema.optional(Schema.Array(Schema.Literal("open", "reveal", "diff"))),
  allowProviderCustomResolverIds: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  readOnlyOnly: Schema.optional(Schema.Boolean),
})
```

---

## Enforcement pseudocode

```ts
const authorize = (policy: ResolverPolicy, spec: ExecutionResolverSpec) => {
  if (!policy.allowTags.includes(spec._tag)) return { ok: false, reason: "tag-denied" }

  switch (spec._tag) {
    case "NavigationResolver":
      return policy.allowRoutes?.includes(spec.route)
        ? { ok: true }
        : { ok: false, reason: "route-denied" }

    case "RpcResolver":
      return policy.allowRpcMethods?.includes(`${spec.service}.${spec.method}`)
        ? { ok: true }
        : { ok: false, reason: "rpc-method-denied" }

    case "HttpResolver": {
      const domain = new URL(spec.endpointId).host
      return policy.allowDomains?.includes(domain)
        ? { ok: true }
        : { ok: false, reason: "domain-denied" }
    }

    default:
      return { ok: true }
  }
}
```

---

## Audit event fields

On every execution attempt:

- queryId
- rowId
- scope
- resolverTag
- allowDecision (`allow|deny`)
- denyReason
- actor context (if available)

---

## Relationship to decision lock

This document resolves Decision Lock follow-up item:

- "Resolver capability allow-list policy"

and is normative for execution safety.
