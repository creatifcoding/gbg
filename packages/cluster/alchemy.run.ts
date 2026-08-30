import * as Alchemy from "alchemy";
import * as Kubernetes from "alchemy/Kubernetes";
import * as Effect from "effect/Effect";
import { cluster } from "./src/cluster";
import { LabAppletCRD } from "./src/crd/source/lab-applet.crd";
import { LabImageCRD } from "./src/crd/source/lab-image.crd";
import { LabRegistryCRD } from "./src/crd/source/lab-registry.crd";
import { LabWorkloadCRD } from "./src/crd/source/lab-workload.crd";

export { cluster };

export default Alchemy.Stack(
  "LabCluster",
  {
    providers: Kubernetes.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const labImage = yield* Kubernetes.Manifest("LabImageCRD", {
      cluster,
      manifest: LabImageCRD,
    });
    const labRegistry = yield* Kubernetes.Manifest("LabRegistryCRD", {
      cluster,
      manifest: LabRegistryCRD,
    });
    const labWorkload = yield* Kubernetes.Manifest("LabWorkloadCRD", {
      cluster,
      manifest: LabWorkloadCRD,
    });
    const labApplet = yield* Kubernetes.Manifest("LabAppletCRD", {
      cluster,
      manifest: LabAppletCRD,
    });

    return {
      kubeContext: "k3d-tmnl",
      crds: {
        labImage: labImage.name,
        labRegistry: labRegistry.name,
        labWorkload: labWorkload.name,
        labApplet: labApplet.name,
      },
    };
  }),
);
