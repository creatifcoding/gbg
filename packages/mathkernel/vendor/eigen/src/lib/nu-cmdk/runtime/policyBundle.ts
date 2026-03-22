import { Schema } from "effect"
import type { Scope } from "./types"

export const PolicyGrant = Schema.Struct({
  resolverIdentity: Schema.String,
  scopes: Schema.Array(Schema.Literal("global", "editor", "grid", "tldraw", "modal")),
})

export const PolicyBundle = Schema.Struct({
  version: Schema.Int,
  grants: Schema.Array(PolicyGrant),
})

export type PolicyBundle = typeof PolicyBundle.Type

export const isResolverAllowed = (
  policy: PolicyBundle,
  scope: Scope,
  resolverIdentity: string,
): boolean =>
  policy.grants.some(
    (g) => g.resolverIdentity === resolverIdentity && g.scopes.includes(scope),
  )

export const makeDefaultPolicyBundle = (): PolicyBundle => ({
  version: 1,
  grants: [
    { resolverIdentity: "commands:open@v1", scopes: ["global", "editor", "grid", "tldraw", "modal"] },
    { resolverIdentity: "search:rpc.lookup@v1", scopes: ["global", "editor", "grid", "tldraw"] },
    { resolverIdentity: "docs:http.fetch@v1", scopes: ["global", "editor"] },
  ],
})
