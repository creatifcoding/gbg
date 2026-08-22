# Mantis cluster

Thin roseleaf of `biomemetics.mantis`. Consumes `@gbg/cluster` and extends it
with mantis-specific Manifests. Same nesting as
`projects/biomemetics/labs/mantis/procurement/`: a private `@mantis/*`
package in the lab tree.

This directory does not own an Alchemy stack. The one stack lives in
`packages/cluster` (`@gbg/cluster`). Do not add `alchemy.run.ts` here.

Workloads target kube context `k3d-tmnl` on whatever host currently has
that context. This directory does not create the cluster and does not
deploy. It does not edit `procurement/`. procurementbot owns that book.
The `procurement` Namespace Manifest is reserved so the Start applet can
be hosted later as a `LabApplet`.

## Cluster

The cluster is the existing TMNL k3d default: name `tmnl`, kubectl context
`k3d-tmnl`. Create it from the tmnl-k8s shell:

```text
nix develop ./packages/tmnl#tmnl-k8s
k8s-cluster-create
```

`k8s-cluster-create` lives in `packages/tmnl/nix/modules/k8s.nix`. Do not
copy it here. Alchemy resolves kubeconfig from `$KUBECONFIG` or
`~/.kube/config`.

## Extensions

- `procurement` Namespace Manifest (`src/manifests.ts`)
- later: a `LabApplet` for the Start app

## Hold deploy

Do not run `alchemy deploy` from this land. Deploy, when allowed, is
`packages/cluster/alchemy.run.ts`.

```text
npm install
npm test
npm run typecheck
```
