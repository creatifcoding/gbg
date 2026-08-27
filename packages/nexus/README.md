# @gbg/nexus

Cosmo/WunderGraph federated GraphQL **router home**. Not a stub. Not a README
with a name. Not tmnl. Not plexus. tmnl consumes this package.

Leftover Pepr (`cosmo-operator`, CosmoRouter / CosmoSubgraph CRDs) stays in
`packages/tmnl/src/infra/graph`. This package does not copy those sources.
This package is not on the cluster draft (`packages/cluster` / PR 109).

Catalog stays Postgres off-cluster; there is no catalog pod.

## Compose (the can-do path)

Official local composition. No control plane. No Helm umbrella, studio,
ClickHouse, Keycloak, or CDN.

```text
wgc router compose -i graph.yaml -o router.json
```

Same command as `npm run compose`. Output filename is `router.json`
everywhere (local file, leftover CRD mount `/config/router.json`, Cosmo
router `execution_config.file.path`).

| File | Role |
|------|------|
| `graph.yaml` | wgc compose input (`version: 1`, `subgraphs[]`) |
| `fixtures/fixture-demo.graphql` | Federation v2 fixture SDL. Not a catalog / specimen / procurement well. |
| `config.yaml` | Router runtime: `execution_config.file` + `events.providers.nats` |
| `router.json` | Execution config `wgc` emits (generated; not committed) |

Router image: `ghcr.io/wundergraph/cosmo/router`. Default listen: `3002`.

Pinned CLI: `wgc@0.130.1` (tmnl already depends on `wgc`; current npm is
`0.130.1`).

## One NATS

Cosmo router EDFS and `@tmnl/msh` share the existing helm NATS at
`packages/tmnl/nix/modules/nats/values.yaml` (release `nats`, namespace
`nats`, client URL `nats://nats.nats.svc.cluster.local:4222`). No second
broker. No paid Synadia Cloud.

## tmnl consumes

Import `@gbg/nexus` for compose helpers and types (`@gbg/nexus` is mapped in
`packages/tmnl/tsconfig.json` and `tsconfig.base.json`). Do not treat
`packages/tmnl/src/infra/graph` as Cosmo's home. That leftover is the Pepr
operator. Cluster-create in `packages/tmnl/nix/modules/k8s.nix` is a helper
path, not this home.

This package is excluded from the root bun/npm workspace (`!packages/nexus`)
so `wgc@0.130.1` keeps its own lock, same pattern as `@gbg/cluster`.

## Hold merge. No deploy.

Do not helm install, docker-compose.full, k3d apply, or pepr deploy from
this land.

```text
npm install
npm run typecheck
npm test
```

This package is not a root workspace member. CI sets `NPM_CONFIG_WORKSPACES=false`
so those three commands install `wgc@0.130.1` into `packages/nexus`.
