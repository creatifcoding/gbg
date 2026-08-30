# @gbg/cluster

Lab Alchemy host. k3d hosts applets on kube context `k3d-tmnl`. CRDs
(`LabImage`, `LabRegistry`, `LabWorkload`, `LabApplet`) use API group
`tmnl.gbg.dev/v1alpha1`. Those strings are names, not a claim that TMNL is
the cluster.

## Cluster

k3d is the local kube runtime. Context name: `k3d-tmnl`. Create it with:

```text
nix develop ./packages/tmnl#tmnl-k8s
k8s-cluster-create
```

`k8s-cluster-create` lives in `packages/tmnl/nix/modules/k8s.nix` as a helper
path. Cosmo/WunderGraph home is `@gbg/nexus`, not that path. Do not copy the
helper here. Alchemy resolves kubeconfig from `$KUBECONFIG` or
`~/.kube/config`. There is no host path in this stack.

## Stack

`alchemy.run.ts` is the composition root. Run commands from this directory
so `Alchemy.localState()` writes `.alchemy/` here.

- `Kubernetes.providers()` only
- `Alchemy.localState()`
- `Kubernetes.KubeConfig({ context: "k3d-tmnl" })`
- four CRDs via `Kubernetes.Manifest`

Labs consume this host; they do not add a second Alchemy composition root.

No `AWS.providers()`, no Cloudflare resources, no kind files, no EKS/GKE/AKS,
no paid Workers/DO/Queues, no ECR/GCR/ACR.

This package uses its own npm lock so Alchemy's `effect@4.0.0-rc.110` peer
does not hoist over the repo `effect@4.0.0-beta.93` pin.

## CRDs

| Kind | Plural | Role |
|------|--------|------|
| LabImage | labimages | Image coordinate + optional digest / registry ref |
| LabRegistry | labregistries | In-cluster OCI. Default image: `ghcr.io/project-zot/zot-linux-amd64` (Zot). `registry:2` is the other local/free option. Never ECR/GCR/ACR. |
| LabWorkload | labworkloads | Generic workload (CosmoRouter minus GraphQL) |
| LabApplet | labapplets | TanStack Start specialization of LabWorkload |

## Cosmo

Cosmo/WunderGraph home is `@gbg/nexus` (`packages/nexus`). Not tmnl. Not
plexus. tmnl consumes nexus. This package does not copy Cosmo Pepr/CRD
sources out of tmnl. Catalog stays Postgres off-cluster; there is no catalog
pod.

One NATS: Cosmo router EDFS and `@tmnl/msh` share the existing helm NATS at
`packages/tmnl/nix/modules/nats/values.yaml`. Do not stand up a second NATS.

This package is types + CRD Manifests, not a second Pepr module and not a
reconcile controller.

## Ship

Ship when CI is green on the lab branch. User corrects after the fact.

Stop is only: paid cloud, deploy that leaves this machine, a second NATS, a
second catalog source of truth, a second API group. Wallet still stops paid
cloud and alchemy deploy that leaves this machine.

```text
npm install
npm test
npm run typecheck
```
