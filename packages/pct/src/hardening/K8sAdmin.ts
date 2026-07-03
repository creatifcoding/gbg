import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"

export const K8sHttpMethod = Schema.Literals([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
])
export type K8sHttpMethod = typeof K8sHttpMethod.Type

export const K8sObjectMeta = Schema.Struct({
  name: Schema.optional(Schema.String),
  namespace: Schema.optional(Schema.String),
  uid: Schema.optional(Schema.String),
  resourceVersion: Schema.optional(Schema.String),
  generation: Schema.optional(Schema.Number),
  labels: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  annotations: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  finalizers: Schema.optional(Schema.Array(Schema.String)),
})
export type K8sObjectMeta = typeof K8sObjectMeta.Type

export const K8sObject = Schema.Struct({
  apiVersion: Schema.String,
  kind: Schema.String,
  metadata: K8sObjectMeta,
  spec: Schema.optional(Schema.Unknown),
  status: Schema.optional(Schema.Unknown),
  data: Schema.optional(Schema.Unknown),
})
export type K8sObject = typeof K8sObject.Type

export const K8sResourceEndpoint = Schema.Struct({
  apiVersion: Schema.String,
  kind: Schema.String,
  plural: Schema.String,
  namespaced: Schema.Boolean,
})
export type K8sResourceEndpoint = typeof K8sResourceEndpoint.Type

export const K8sWatchPhase = Schema.Literals([
  "ADDED",
  "MODIFIED",
  "DELETED",
  "BOOKMARK",
  "ERROR",
])
export type K8sWatchPhase = typeof K8sWatchPhase.Type

export const K8sWatchEvent = Schema.Struct({
  type: K8sWatchPhase,
  object: Schema.Unknown,
})
export type K8sWatchEvent = typeof K8sWatchEvent.Type

export const K8sWorkloadNodeRole = Schema.Literals([
  "provisioner",
  "controller",
  "watcher",
  "reconciler",
  "verifier",
  "janitor",
])
export type K8sWorkloadNodeRole = typeof K8sWorkloadNodeRole.Type

export const K8sWorkloadNodeDescriptor = Schema.Struct({
  nodeId: Schema.String,
  role: K8sWorkloadNodeRole,
  description: Schema.optional(Schema.String),
})
export type K8sWorkloadNodeDescriptor = typeof K8sWorkloadNodeDescriptor.Type

export const K8sWorkloadDescriptor = Schema.Struct({
  workloadId: Schema.String,
  description: Schema.optional(Schema.String),
  nodes: Schema.Array(K8sWorkloadNodeDescriptor),
})
export type K8sWorkloadDescriptor = typeof K8sWorkloadDescriptor.Type

export const K8sHttpRequest = Schema.Struct({
  method: K8sHttpMethod,
  path: Schema.String,
  headers: Schema.Record(Schema.String, Schema.String),
  body: Schema.optional(Schema.Unknown),
})
export type K8sHttpRequest = typeof K8sHttpRequest.Type

export const K8sHttpResponse = Schema.Struct({
  status: Schema.Number,
  headers: Schema.Record(Schema.String, Schema.String),
  body: Schema.optional(Schema.Unknown),
})
export type K8sHttpResponse = typeof K8sHttpResponse.Type

export class K8sAdminError extends Schema.TaggedErrorClass<K8sAdminError>()(
  "K8sAdminError",
  {
    operation: Schema.String,
    path: Schema.String,
    status: Schema.Number,
    message: Schema.String,
    body: Schema.optional(Schema.Unknown),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export interface K8sTransportShape {
  readonly request: (
    request: K8sHttpRequest,
  ) => Effect.Effect<K8sHttpResponse, K8sAdminError>
}

export class K8sTransport extends Context.Service<K8sTransport, K8sTransportShape>()(
  "@tmnl/pct/hardening/K8sTransport",
) {}

export interface K8sClientConfig {
  readonly baseUrl: string
  readonly bearerToken?: string
  readonly defaultFieldManager?: string
}

export interface K8sListOptions {
  readonly namespace?: string
  readonly labelSelector?: string
  readonly fieldSelector?: string
  readonly resourceVersion?: string
  readonly resourceVersionMatch?: "Exact" | "NotOlderThan"
  readonly limit?: number
  readonly continue?: string
}

export interface K8sApplyOptions {
  readonly namespace?: string
  readonly name?: string
  readonly fieldManager?: string
  readonly force?: boolean
  readonly dryRun?: boolean
  readonly fieldValidation?: "Ignore" | "Warn" | "Strict"
}

export interface K8sDeleteOptions {
  readonly namespace?: string
  readonly propagationPolicy?: "Orphan" | "Background" | "Foreground"
  readonly dryRun?: boolean
}

export interface K8sAdminShape {
  readonly request: (
    request: K8sHttpRequest,
  ) => Effect.Effect<K8sHttpResponse, K8sAdminError>
  readonly get: (
    endpoint: K8sResourceEndpoint,
    options: { readonly name: string; readonly namespace?: string },
  ) => Effect.Effect<unknown, K8sAdminError>
  readonly list: (
    endpoint: K8sResourceEndpoint,
    options?: K8sListOptions,
  ) => Effect.Effect<unknown, K8sAdminError>
  readonly apply: (
    endpoint: K8sResourceEndpoint,
    object: K8sObject,
    options?: K8sApplyOptions,
  ) => Effect.Effect<unknown, K8sAdminError>
  readonly delete: (
    endpoint: K8sResourceEndpoint,
    name: string,
    options?: K8sDeleteOptions,
  ) => Effect.Effect<unknown, K8sAdminError>
}

export class K8sAdmin extends Context.Service<K8sAdmin, K8sAdminShape>()(
  "@tmnl/pct/hardening/K8sAdmin",
) {}

export const defineK8sResource = (
  endpoint: K8sResourceEndpoint,
): K8sResourceEndpoint => endpoint

export const K8sResources = {
  Namespace: defineK8sResource({
    apiVersion: "v1",
    kind: "Namespace",
    plural: "namespaces",
    namespaced: false,
  }),
  ConfigMap: defineK8sResource({
    apiVersion: "v1",
    kind: "ConfigMap",
    plural: "configmaps",
    namespaced: true,
  }),
  Secret: defineK8sResource({
    apiVersion: "v1",
    kind: "Secret",
    plural: "secrets",
    namespaced: true,
  }),
  Service: defineK8sResource({
    apiVersion: "v1",
    kind: "Service",
    plural: "services",
    namespaced: true,
  }),
  ServiceAccount: defineK8sResource({
    apiVersion: "v1",
    kind: "ServiceAccount",
    plural: "serviceaccounts",
    namespaced: true,
  }),
  Deployment: defineK8sResource({
    apiVersion: "apps/v1",
    kind: "Deployment",
    plural: "deployments",
    namespaced: true,
  }),
  StatefulSet: defineK8sResource({
    apiVersion: "apps/v1",
    kind: "StatefulSet",
    plural: "statefulsets",
    namespaced: true,
  }),
  Role: defineK8sResource({
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "Role",
    plural: "roles",
    namespaced: true,
  }),
  RoleBinding: defineK8sResource({
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "RoleBinding",
    plural: "rolebindings",
    namespaced: true,
  }),
  ClusterRole: defineK8sResource({
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    plural: "clusterroles",
    namespaced: false,
  }),
  ClusterRoleBinding: defineK8sResource({
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRoleBinding",
    plural: "clusterrolebindings",
    namespaced: false,
  }),
  Lease: defineK8sResource({
    apiVersion: "coordination.k8s.io/v1",
    kind: "Lease",
    plural: "leases",
    namespaced: true,
  }),
} as const

const encodePathSegment = (value: string): string => encodeURIComponent(value)

const apiPrefix = (apiVersion: string): string => {
  const slash = apiVersion.indexOf("/")
  if (slash === -1) return `/api/${apiVersion}`
  const group = apiVersion.slice(0, slash)
  const version = apiVersion.slice(slash + 1)
  return `/apis/${group}/${version}`
}

export const k8sCollectionPath = (
  endpoint: K8sResourceEndpoint,
  namespace?: string,
): string => {
  const prefix = apiPrefix(endpoint.apiVersion)
  if (endpoint.namespaced && namespace !== undefined && namespace !== "") {
    return `${prefix}/namespaces/${encodePathSegment(namespace)}/${endpoint.plural}`
  }
  return `${prefix}/${endpoint.plural}`
}

export const k8sObjectPath = (
  endpoint: K8sResourceEndpoint,
  name: string,
  namespace?: string,
): Effect.Effect<string, K8sAdminError> => {
  if (name === "") {
    return Effect.fail(new K8sAdminError({
      operation: "path",
      path: k8sCollectionPath(endpoint, namespace),
      status: 0,
      message: `${endpoint.kind} object path requires metadata.name`,
    }))
  }
  if (endpoint.namespaced && (namespace === undefined || namespace === "")) {
    return Effect.fail(new K8sAdminError({
      operation: "path",
      path: k8sCollectionPath(endpoint),
      status: 0,
      message: `${endpoint.kind} object path requires metadata.namespace or an explicit namespace option`,
    }))
  }
  return Effect.succeed(`${k8sCollectionPath(endpoint, namespace)}/${encodePathSegment(name)}`)
}

const appendQuery = (path: string, params: URLSearchParams): string => {
  const query = params.toString()
  return query === "" ? path : `${path}?${query}`
}

const listPath = (endpoint: K8sResourceEndpoint, options: K8sListOptions = {}): string => {
  const params = new URLSearchParams()
  if (options.labelSelector !== undefined) params.set("labelSelector", options.labelSelector)
  if (options.fieldSelector !== undefined) params.set("fieldSelector", options.fieldSelector)
  if (options.resourceVersion !== undefined) params.set("resourceVersion", options.resourceVersion)
  if (options.resourceVersionMatch !== undefined) params.set("resourceVersionMatch", options.resourceVersionMatch)
  if (options.limit !== undefined) params.set("limit", String(options.limit))
  if (options.continue !== undefined) params.set("continue", options.continue)
  return appendQuery(k8sCollectionPath(endpoint, options.namespace), params)
}

const applyPath = (
  endpoint: K8sResourceEndpoint,
  object: K8sObject,
  options: K8sApplyOptions = {},
): Effect.Effect<string, K8sAdminError> => Effect.gen(function* () {
  const name = options.name ?? object.metadata.name ?? ""
  const namespace = options.namespace ?? object.metadata.namespace
  const path = yield* k8sObjectPath(endpoint, name, namespace)
  const params = new URLSearchParams()
  params.set("fieldManager", options.fieldManager ?? "tmnl-pct")
  if (options.force === true) params.set("force", "true")
  if (options.dryRun === true) params.set("dryRun", "All")
  if (options.fieldValidation !== undefined) params.set("fieldValidation", options.fieldValidation)
  return appendQuery(path, params)
})

const deletePath = (
  endpoint: K8sResourceEndpoint,
  name: string,
  options: K8sDeleteOptions = {},
): Effect.Effect<string, K8sAdminError> => Effect.gen(function* () {
  const path = yield* k8sObjectPath(endpoint, name, options.namespace)
  const params = new URLSearchParams()
  if (options.dryRun === true) params.set("dryRun", "All")
  return appendQuery(path, params)
})

const assertOk = (
  request: K8sHttpRequest,
  response: K8sHttpResponse,
): Effect.Effect<K8sHttpResponse, K8sAdminError> => {
  if (response.status >= 200 && response.status < 300) return Effect.succeed(response)
  return Effect.fail(new K8sAdminError({
    operation: request.method,
    path: request.path,
    status: response.status,
    message: `Kubernetes API ${request.method} ${request.path} failed with HTTP ${response.status}`,
    body: response.body,
  }))
}

export const makeK8sAdmin = Effect.gen(function* () {
  const transport = yield* K8sTransport

  const request = (request: K8sHttpRequest) =>
    transport.request(request).pipe(Effect.flatMap((response) => assertOk(request, response)))

  return K8sAdmin.of({
    request,
    get: (endpoint, options) => Effect.gen(function* () {
      const path = yield* k8sObjectPath(endpoint, options.name, options.namespace)
      const response = yield* request({ method: "GET", path, headers: {} })
      return response.body
    }),
    list: (endpoint, options) => Effect.gen(function* () {
      const response = yield* request({ method: "GET", path: listPath(endpoint, options), headers: {} })
      return response.body
    }),
    apply: (endpoint, object, options) => Effect.gen(function* () {
      const path = yield* applyPath(endpoint, object, options)
      const response = yield* request({
        method: "PATCH",
        path,
        headers: {
          "content-type": "application/apply-patch+yaml",
          "accept": "application/json",
        },
        body: object,
      })
      return response.body
    }),
    delete: (endpoint, name, options) => Effect.gen(function* () {
      const path = yield* deletePath(endpoint, name, options)
      const body = options?.propagationPolicy === undefined
        ? undefined
        : { propagationPolicy: options.propagationPolicy }
      const response = yield* request({
        method: "DELETE",
        path,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        ...(body === undefined ? {} : { body }),
      })
      return response.body
    }),
  })
})

export const k8sAdminLayer: Layer.Layer<K8sAdmin, never, K8sTransport> =
  Layer.effect(K8sAdmin, makeK8sAdmin)

export const k8sTransportLayerFromFetch = (
  config: K8sClientConfig,
): Layer.Layer<K8sTransport> => Layer.succeed(K8sTransport, K8sTransport.of({
  request: (request) => Effect.tryPromise({
    try: async () => {
      const headers = new Headers(request.headers)
      if (config.bearerToken !== undefined && config.bearerToken !== "") {
        headers.set("authorization", `Bearer ${config.bearerToken}`)
      }
      const init: RequestInit = {
        method: request.method,
        headers,
      }
      if (request.body !== undefined) {
        init.body = JSON.stringify(request.body)
      }
      const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}${request.path}`, init)
      const text = await response.text()
      let body: unknown = undefined
      if (text !== "") {
        try {
          body = JSON.parse(text)
        } catch {
          body = text
        }
      }
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })
      return {
        status: response.status,
        headers: responseHeaders,
        ...(body === undefined ? {} : { body }),
      }
    },
    catch: (cause) => new K8sAdminError({
      operation: request.method,
      path: request.path,
      status: 0,
      message: String(cause),
      cause,
    }),
  }),
}))

export interface K8sNodeProgram<A = unknown, E = unknown, R = never> {
  readonly descriptor: K8sWorkloadNodeDescriptor
  readonly run: Effect.Effect<A, E, R | K8sAdmin>
}

export interface K8sWorkloadProgram<A = unknown, E = unknown, R = never> {
  readonly descriptor: Omit<K8sWorkloadDescriptor, "nodes">
  readonly nodes: ReadonlyArray<K8sNodeProgram<A, E, R>>
  readonly concurrency?: number | "unbounded"
}

export interface K8sNodeRunResult<A = unknown> {
  readonly nodeId: string
  readonly role: K8sWorkloadNodeRole
  readonly startedAt: number
  readonly completedAt: number
  readonly durationMs: number
  readonly value: A
}

export const defineK8sNode = <A, E, R>(
  descriptor: K8sWorkloadNodeDescriptor,
  run: Effect.Effect<A, E, R | K8sAdmin>,
): K8sNodeProgram<A, E, R> => ({ descriptor, run })

export const defineK8sWorkload = <A, E, R>(
  options: K8sWorkloadProgram<A, E, R>,
): K8sWorkloadProgram<A, E, R> => options

export const runK8sNode = <A, E, R>(
  node: K8sNodeProgram<A, E, R>,
): Effect.Effect<K8sNodeRunResult<A>, E, R | K8sAdmin> => Effect.gen(function* () {
  const startedAt = Date.now()
  const value = yield* node.run
  const completedAt = Date.now()
  return {
    nodeId: node.descriptor.nodeId,
    role: node.descriptor.role,
    startedAt,
    completedAt,
    durationMs: completedAt - startedAt,
    value,
  }
})

export const runK8sWorkload = <A, E, R>(
  workload: K8sWorkloadProgram<A, E, R>,
): Effect.Effect<ReadonlyArray<K8sNodeRunResult<A>>, E, R | K8sAdmin> =>
  Effect.all(
    workload.nodes.map((node) => runK8sNode(node)),
    { concurrency: workload.concurrency ?? "unbounded" },
  )

interface ReconcileQueueItem<A, E> {
  readonly item: A
  readonly deferred: Deferred.Deferred<void, E>
}

export interface K8sReconcileQueue<A, E = never> {
  readonly enqueue: (item: A) => Effect.Effect<void>
  readonly enqueueAndWait: (item: A) => Effect.Effect<void, E>
  readonly shutdown: Effect.Effect<boolean>
}

export const makeK8sReconcileQueue = <A, E, R>(options: {
  readonly handler: (item: A) => Effect.Effect<void, E, R>
}): Effect.Effect<K8sReconcileQueue<A, E>, never, R | Scope.Scope> => Effect.gen(function* () {
  const queue = yield* Queue.unbounded<ReconcileQueueItem<A, E>>()

  yield* Effect.forever(
    Queue.take(queue).pipe(
      Effect.flatMap(({ item, deferred }) =>
        options.handler(item).pipe(
          Effect.matchCauseEffect({
            onFailure: (cause) => Deferred.failCause(deferred, cause).pipe(Effect.asVoid),
            onSuccess: () => Deferred.succeed(deferred, undefined).pipe(Effect.asVoid),
          }),
        ),
      ),
    ),
  ).pipe(Effect.forkScoped)

  return {
    enqueue: (item) => Effect.gen(function* () {
      const deferred = yield* Deferred.make<void, E>()
      yield* Queue.offer(queue, { item, deferred })
    }),
    enqueueAndWait: (item) => Effect.gen(function* () {
      const deferred = yield* Deferred.make<void, E>()
      yield* Queue.offer(queue, { item, deferred })
      yield* Deferred.await(deferred)
    }),
    shutdown: Queue.shutdown(queue),
  }
})
