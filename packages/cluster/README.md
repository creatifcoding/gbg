# @gbg/cluster

Alchemy v2 stack for kube context `k3d-tmnl`, plus the generalized Pepr lab
CRD kit (`LabImage`, `LabRegistry`, `LabWorkload`, `LabApplet`) on
`tmnl.gbg.dev/v1alpha1`. This is the one stack. Labs consume it; they do not
own a second Alchemy composition root.

## Cluster

The cluster is the existing TMNL k3d default: name `tmnl`, kubectl context
`k3d-tmnl`. Create it from the tmnl-k8s shell:

```text
nix develop ./packages/tmnl#tmnl-k8s
k8s-cluster-create
```

`k8s-cluster-create` lives in `packages/tmnl/nix/modules/k8s.nix`. Do not
copy it here. Alchemy resolves kubeconfig from `$KUBECONFIG` or
`~/.kube/config`. There is no host path in this stack.

## Stack

`alchemy.run.ts` is the composition root. Run commands from this directory
so `Alchemy.localState()` writes `.alchemy/` here.

- `Kubernetes.providers()` only
- `Alchemy.localState()`
- `Kubernetes.KubeConfig({ context: "k3d-tmnl" })`
- four CRDs via `Kubernetes.Manifest`

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

CosmoRouter and CosmoSubgraph stay GraphQL specializations in `packages/tmnl`.
Their apply path remains `nix develop ./packages/tmnl#tmnl-k8s` then
`k8s-pepr-deploy`. This package is types + CRD Manifests, not a second Pepr
module and not a reconcile controller.

When a bus is needed later, `@tmnl/msh` is the house NATS Effect client.
Cosmo router EDFS talks to that same NATS. Do not stand up a second NATS.

## Hold deploy

Do not run `alchemy deploy` from this land.

```text
npm install
npm test
npm run typecheck
```
