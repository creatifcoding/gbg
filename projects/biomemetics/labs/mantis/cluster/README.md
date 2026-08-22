# Mantis cluster

Alchemy v2 roseleaf of `biomemetics.mantis`. Workloads target kube context
`k3d-tmnl` on whatever host currently has that context. This directory does not
create the cluster and does not deploy.

It is not a `packages/*` project. Analogous to `analogs/`: a nested private
package (`@tmnl/mantis-cluster`) under the lab workspace.

## Cluster

The cluster is the existing TMNL k3d default: name `tmnl`, kubectl context
`k3d-tmnl`. Create it from the tmnl-k8s shell:

```bash
nix develop ./packages/tmnl#tmnl-k8s
k8s-cluster-create
```

`k8s-cluster-create` lives in `packages/tmnl/nix/modules/k8s.nix`. Do not copy
it here. Alchemy resolves kubeconfig from `$KUBECONFIG` or `~/.kube/config`.
There is no host path in this stack.

## Stack

`alchemy.run.ts` is the composition root. Run commands from this directory so
`Alchemy.localState()` writes `.alchemy/` here.

- `Kubernetes.providers()` only
- `Alchemy.localState()`
- `Kubernetes.KubeConfig({ context: "k3d-tmnl" })`
- a `procurement` Namespace via `Kubernetes.Manifest`

procurementbot owns procurement data. This roseleaf only reserves the namespace.

## Hold deploy

Do not run `alchemy deploy` from this land.

```bash
bun install
bun run typecheck
bun test
```
