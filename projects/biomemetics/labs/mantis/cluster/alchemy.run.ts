import * as Alchemy from "alchemy";
import * as Kubernetes from "alchemy/Kubernetes";
import * as Effect from "effect/Effect";

const cluster = Kubernetes.KubeConfig({ context: "k3d-tmnl" });

export { cluster };

export default Alchemy.Stack(
  "MantisCluster",
  {
    providers: Kubernetes.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const procurement = yield* Kubernetes.Manifest("ProcurementNamespace", {
      cluster,
      manifest: {
        apiVersion: "v1",
        kind: "Namespace",
        metadata: { name: "procurement" },
      },
    });

    return {
      kubeContext: "k3d-tmnl",
      procurementNamespace: procurement.name,
    };
  }),
);
