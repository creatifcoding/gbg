import { describe, expect, it } from "vitest"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

import {
  defineK8sNode,
  defineK8sWorkload,
  k8sAdminLayer,
  k8sCollectionPath,
  k8sObjectPath,
  K8sAdmin,
  K8sAdminError,
  K8sResources,
  K8sTransport,
  makeK8sReconcileQueue,
  runK8sWorkload,
  type K8sHttpRequest,
} from "../src/hardening/index.js"

const recordingAdminLayer = (recorded: K8sHttpRequest[]) =>
  k8sAdminLayer.pipe(
    Layer.provide(Layer.succeed(K8sTransport, K8sTransport.of({
      request: (request) => Effect.sync(() => {
        recorded.push(request)
        return {
          status: 200,
          headers: {},
          body: {
            ok: true,
            method: request.method,
            path: request.path,
          },
        }
      }),
    }))),
  )

describe("Effect-native Kubernetes admin spike", () => {
  it("builds canonical Kubernetes REST paths for core and grouped resources", async () => {
    expect(k8sCollectionPath(K8sResources.ConfigMap, "pct-system")).toBe(
      "/api/v1/namespaces/pct-system/configmaps",
    )
    expect(k8sCollectionPath(K8sResources.ConfigMap)).toBe("/api/v1/configmaps")
    expect(k8sCollectionPath(K8sResources.Deployment, "pct-system")).toBe(
      "/apis/apps/v1/namespaces/pct-system/deployments",
    )
    expect(k8sCollectionPath(K8sResources.ClusterRole)).toBe(
      "/apis/rbac.authorization.k8s.io/v1/clusterroles",
    )

    const missingNamespace = await Effect.runPromise(
      k8sObjectPath(K8sResources.ConfigMap, "pct-config").pipe(Effect.result),
    )
    expect(missingNamespace._tag).toBe("Failure")
    if (missingNamespace._tag === "Failure") {
      expect(missingNamespace.failure).toBeInstanceOf(K8sAdminError)
    }
  })

  it("uses server-side apply PATCH with field manager, force, dry-run, and strict validation", async () => {
    const recorded: K8sHttpRequest[] = []

    await Effect.runPromise(
      Effect.gen(function* () {
        const admin = yield* K8sAdmin
        return yield* admin.apply(
          K8sResources.ConfigMap,
          {
            apiVersion: "v1",
            kind: "ConfigMap",
            metadata: {
              name: "pct-control-plane",
              namespace: "pct-system",
            },
            data: {
              mode: "effect-program",
            },
          },
          {
            fieldManager: "tmnl-pct-spike",
            force: true,
            dryRun: true,
            fieldValidation: "Strict",
          },
        )
      }).pipe(Effect.provide(recordingAdminLayer(recorded))),
    )

    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({
      method: "PATCH",
      path:
        "/api/v1/namespaces/pct-system/configmaps/pct-control-plane?fieldManager=tmnl-pct-spike&force=true&dryRun=All&fieldValidation=Strict",
      headers: {
        "content-type": "application/apply-patch+yaml",
        "accept": "application/json",
      },
    })
  })

  it("lets Kubernetes workloads and nodes be defined as Effect programs", async () => {
    const recorded: K8sHttpRequest[] = []

    const namespaceNode = defineK8sNode(
      {
        nodeId: "pct-namespace",
        role: "provisioner",
        description: "Create the namespace boundary for the PCT runtime.",
      },
      Effect.gen(function* () {
        const admin = yield* K8sAdmin
        yield* admin.apply(
          K8sResources.Namespace,
          {
            apiVersion: "v1",
            kind: "Namespace",
            metadata: { name: "pct-system" },
          },
          { fieldManager: "tmnl-pct", force: true },
        )
        return "namespace-ready"
      }),
    )

    const configNode = defineK8sNode(
      {
        nodeId: "pct-config",
        role: "provisioner",
        description: "Apply controller configuration after the namespace exists.",
      },
      Effect.gen(function* () {
        const admin = yield* K8sAdmin
        yield* admin.apply(
          K8sResources.ConfigMap,
          {
            apiVersion: "v1",
            kind: "ConfigMap",
            metadata: {
              name: "pct-runtime",
              namespace: "pct-system",
            },
            data: {
              PCT_BACKEND: "msh-bridge",
            },
          },
          { fieldManager: "tmnl-pct", force: true },
        )
        return "config-ready"
      }),
    )

    const workload = defineK8sWorkload({
      descriptor: {
        workloadId: "pct-control-plane-bootstrap",
        description: "Pepr-inspired bootstrap expressed as plain Effect node programs.",
      },
      nodes: [namespaceNode, configNode],
      concurrency: 1,
    })

    const results = await Effect.runPromise(
      runK8sWorkload(workload).pipe(Effect.provide(recordingAdminLayer(recorded))),
    )

    expect(results.map((result) => result.nodeId)).toEqual(["pct-namespace", "pct-config"])
    expect(results.map((result) => result.value)).toEqual(["namespace-ready", "config-ready"])
    expect(recorded.map((request) => request.path)).toEqual([
      "/api/v1/namespaces/pct-system?fieldManager=tmnl-pct&force=true",
      "/api/v1/namespaces/pct-system/configmaps/pct-runtime?fieldManager=tmnl-pct&force=true",
    ])
  })

  it("models Pepr-style Reconcile as an ordered Effect queue", async () => {
    const seen: string[] = []

    await Effect.runPromise(
      Effect.scoped(Effect.gen(function* () {
        const queue = yield* makeK8sReconcileQueue<string, never, never>({
          handler: (item) => Effect.gen(function* () {
            seen.push(`start:${item}`)
            if (item === "a") yield* Effect.sleep(Duration.millis(20))
            seen.push(`end:${item}`)
          }),
        })

        yield* Effect.all(
          [queue.enqueueAndWait("a"), queue.enqueueAndWait("b")],
          { concurrency: "unbounded" },
        )
      })),
    )

    expect(seen).toEqual(["start:a", "end:a", "start:b", "end:b"])
  })
})
