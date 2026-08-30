import * as Kubernetes from "alchemy/Kubernetes";

export const KUBE_CONTEXT = "k3d-tmnl";

export const cluster = Kubernetes.KubeConfig({ context: "k3d-tmnl" });
