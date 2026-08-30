# Mantis cluster

Thin roseleaf of `biomemetics.mantis`. Consumes `@gbg/cluster` and extends it
with mantis-specific Manifests. Same nesting as
`projects/biomemetics/labs/mantis/procurement/`: a private `@mantis/*`
package in the lab tree.

The Alchemy composition root is `@gbg/cluster`. Do not add `alchemy.run.ts`
here. k3d hosts applets on kube context `k3d-tmnl`. That string is a name,
not a claim that TMNL is the cluster.

procurementbot owns the procurement book; this roseleaf does not edit
`procurement/`.

Procurement is the first `LabApplet` object: five Start routes over one
shell, plus a durable volume for the file-backed PGlite book. That volume
is the applet's only store. Mantis does not consume it. The applet is not
started.

## Cluster

k3d is the local kube runtime. Context name: `k3d-tmnl`. Create it with:

```text
nix develop ./packages/tmnl#tmnl-k8s
k8s-cluster-create
```

`k8s-cluster-create` lives in `packages/tmnl/nix/modules/k8s.nix` as a helper
path. Cosmo/WunderGraph home is `@gbg/nexus`, not that path. Alchemy resolves
kubeconfig from `$KUBECONFIG` or `~/.kube/config`.

## Extensions

- `procurement` Namespace Manifest (`src/manifests.ts`)
- `procurement` LabApplet object: routes `/register` `/buy` `/receive`
  `/need` `/vendors`, PGlite volume at `/data/pglite`, image blank, not applied

## Ship

Ship when CI is green on the lab branch. User corrects after the fact.

Stop is only: paid cloud, deploy that leaves this machine, a second NATS, a
second catalog source of truth, a second API group. Wallet still stops paid
cloud and alchemy deploy that leaves this machine. Composition root:
`packages/cluster/alchemy.run.ts`.

```text
npm install
npm test
npm run typecheck
```
