# Mantis cluster

Thin roseleaf of `biomemetics.mantis`. Consumes `@gbg/cluster` (the gbg / lab
cluster) and extends it with mantis-specific Manifests. Same nesting as
`projects/biomemetics/labs/mantis/procurement/`: a private `@mantis/*`
package in the lab tree.

This directory does not own an Alchemy stack. The one stack lives in
`packages/cluster` (`@gbg/cluster`). Do not add `alchemy.run.ts` here.

Workloads target kube context `k3d-tmnl` on whatever host currently has
that context. k3d is the local kube runtime. This is not TMNL as a product
identity. This directory does not create the cluster and does not deploy.
It does not edit `procurement/`. procurementbot owns that book.

Procurement is the first `LabApplet` object: five Start routes over one
shell, plus a durable volume for the file-backed PGlite book. That volume
is the applet's only store. Mantis does not consume it. The applet is not
started.

## Cluster

k3d is the local kube runtime. The kube context string is `k3d-tmnl`
(existing coordinate; this roseleaf does not rename it). Create the cluster
with the existing helper:

```text
nix develop ./packages/tmnl#tmnl-k8s
k8s-cluster-create
```

`k8s-cluster-create` lives in `packages/tmnl/nix/modules/k8s.nix`. That is
the helper path, not Cosmo's home. Alchemy resolves kubeconfig from
`$KUBECONFIG` or `~/.kube/config`.

## Extensions

- `procurement` Namespace Manifest (`src/manifests.ts`)
- `procurement` LabApplet object: routes `/register` `/buy` `/receive`
  `/need` `/vendors`, PGlite volume at `/data/pglite`, image blank, not applied

## Hold deploy

Do not run `alchemy deploy` from this land. Deploy, when allowed, is
`packages/cluster/alchemy.run.ts`.

```text
npm install
npm test
npm run typecheck
```
