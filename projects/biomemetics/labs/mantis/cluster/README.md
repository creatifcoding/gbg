# Mantis cluster

Thin roseleaf of `biomemetics.mantis`. Consumes `@gbg/cluster` and extends it
with mantis-specific Manifests. Same nesting as
`projects/biomemetics/labs/mantis/procurement/`: a private `@mantis/*`
package in the lab tree.

The Alchemy composition root is `@gbg/cluster`. Do not add `alchemy.run.ts`
here. `@gbg/cluster` hosts applets on kube context `k3d-tmnl`. That string is
a name, not a claim that TMNL is the cluster. Cosmo home is `@gbg/nexus`.

procurementbot owns the procurement book; this roseleaf does not edit
`procurement/`.

Procurement is the first `LabApplet`: five Start routes over one shell, plus
a durable volume for the file-backed PGlite book. That volume is the
applet's only store. Mantis does not consume it.

## Cluster

k3d is the local kube runtime. Context name: `k3d-tmnl`. Dockerd comes from
the existing gbg flake only. Package merge is not a running cluster.

The create helper lives in `packages/tmnl/nix/modules/k8s.nix`
(`nix develop ./packages/tmnl#tmnl-k8s`, then `k8s-cluster-create`). Cosmo
home is `@gbg/nexus`, not that path. Alchemy resolves kubeconfig from
`$KUBECONFIG` or `~/.kube/config`.

## Extensions

- `procurement` Namespace Manifest (`src/manifests.ts`)
- `procurement` LabApplet object: routes `/register` `/buy` `/receive`
  `/need` `/vendors`, PGlite volume at `/data/pglite`

## Ship

Operator default is ship. User corrects after.

Ship when CI is green on the lab branch. Do not sit on a green generate.

Real stops: paid cloud, deploy that leaves this machine, a second NATS, a
second catalog source of truth, a second API group.

Dockerd from the existing gbg flake only. Package merge is not a running
cluster. Composition root: `packages/cluster/alchemy.run.ts`.

Missing OpenRouter or Paper bearer is not a merge gate.

```text
npm install
npm test
npm run typecheck
```
