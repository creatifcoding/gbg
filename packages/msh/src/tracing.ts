/**
 * MSH Structured Span Tags
 *
 * Branded span names for Effect.fn — type-checked, greppable, hierarchical.
 * Convention: msh.{service}.{method}
 *
 * @module @tmnl/msh/tracing
 */

// =============================================================================
// Span Name Constants
// =============================================================================

export const MshSpan = {
  // ─── Connection ─────────────────────────────────────────────────────────
  Connection: {
    connect: 'msh.connection.connect',
  },

  // ─── Inner (low-level NATS ops) ─────────────────────────────────────────
  Inner: {
    Core: {
      publish: 'msh.inner.core.publish',
      subscribe: 'msh.inner.core.subscribe',
      request: 'msh.inner.core.request',
      flush: 'msh.inner.core.flush',
      drain: 'msh.inner.core.drain',
    },
    JsPublish: 'msh.inner.jsPublish',
    Consumers: {
      get: 'msh.inner.consumers.get',
      consume: 'msh.inner.consumers.consume',
      fetch: 'msh.inner.consumers.fetch',
      next: 'msh.inner.consumers.next',
      add: 'msh.inner.consumers.add',
      info: 'msh.inner.consumers.info',
      delete: 'msh.inner.consumers.delete',
      list: 'msh.inner.consumers.list',
    },
    Streams: {
      info: 'msh.inner.streams.info',
      add: 'msh.inner.streams.add',
      update: 'msh.inner.streams.update',
      delete: 'msh.inner.streams.delete',
      list: 'msh.inner.streams.list',
      purge: 'msh.inner.streams.purge',
      find: 'msh.inner.streams.find',
    },
    KV: {
      bucket: 'msh.inner.kv.bucket',
      get: 'msh.inner.kv.get',
      put: 'msh.inner.kv.put',
      create: 'msh.inner.kv.create',
      delete: 'msh.inner.kv.delete',
      purge: 'msh.inner.kv.purge',
      watch: 'msh.inner.kv.watch',
      keys: 'msh.inner.kv.keys',
      history: 'msh.inner.kv.history',
    },
    ObjectStore: {
      bucket: 'msh.inner.os.bucket',
      info: 'msh.inner.os.info',
      get: 'msh.inner.os.get',
      put: 'msh.inner.os.put',
      delete: 'msh.inner.os.delete',
      list: 'msh.inner.os.list',
      watch: 'msh.inner.os.watch',
    },
  },

  // ─── Codec ──────────────────────────────────────────────────────────────
  Codec: {
    encodeJson: 'msh.codec.encodeJson',
    decodeJson: 'msh.codec.decodeJson',
  },

  // ─── Hub ────────────────────────────────────────────────────────────────
  Hub: {
    subscribe: 'msh.hub.subscribe',
    publish: 'msh.hub.publish',
    flush: 'msh.hub.flush',
  },

  // ─── PubSub ─────────────────────────────────────────────────────────────
  PubSub: {
    publish: 'msh.pubsub.publish',
    subscribe: 'msh.pubsub.subscribe',
    request: 'msh.pubsub.request',
    flush: 'msh.pubsub.flush',
  },

  // ─── KV ─────────────────────────────────────────────────────────────────
  KV: {
    get: 'msh.kv.get',
    getOrNull: 'msh.kv.getOrNull',
    put: 'msh.kv.put',
    delete: 'msh.kv.delete',
    purge: 'msh.kv.purge',
    watch: 'msh.kv.watch',
    keys: 'msh.kv.keys',
    list: 'msh.kv.list',
    history: 'msh.kv.history',
  },

  // ─── Stream ─────────────────────────────────────────────────────────────
  Stream: {
    ensureStream: 'msh.stream.ensureStream',
    getStreamInfo: 'msh.stream.getStreamInfo',
    deleteStream: 'msh.stream.deleteStream',
    publish: 'msh.stream.publish',
    subscribe: 'msh.stream.subscribe',
    getConsumer: 'msh.stream.getConsumer',
    fetch: 'msh.stream.fetch',
    next: 'msh.stream.next',
  },

  // ─── Micro ──────────────────────────────────────────────────────────────
  Micro: {
    add: 'msh.micro.add',
    addScoped: 'msh.micro.addScoped',
    stop: 'msh.micro.stop',
    client: 'msh.micro.client',
  },

  // ─── Discovery ──────────────────────────────────────────────────────────
  Discovery: {
    ping: 'msh.discovery.ping',
    info: 'msh.discovery.info',
    stats: 'msh.discovery.stats',
  },

  // ─── Registry ───────────────────────────────────────────────────────────
  Registry: {
    register: 'msh.registry.register',
    unregister: 'msh.registry.unregister',
    update: 'msh.registry.update',
    get: 'msh.registry.get',
    findBySubject: 'msh.registry.findBySubject',
    query: 'msh.registry.query',
    catalog: 'msh.registry.catalog',
  },

  // ─── StreamProcessor ────────────────────────────────────────────────────
  Processor: {
    publish: 'msh.processor.publish',
    read: 'msh.processor.read',
    subscribe: 'msh.processor.subscribe',
    subscribeFrom: 'msh.processor.subscribeFrom',
    getInfo: 'msh.processor.getInfo',
    delete: 'msh.processor.delete',
  },

  // ─── Auth (future — I9 redaction rules apply) ───────────────────────────
  Auth: {
    authenticate: 'msh.auth.authenticate',
    loadCredentials: 'msh.auth.loadCredentials',
    rotateToken: 'msh.auth.rotateToken',
    createAuthenticator: 'msh.auth.createAuthenticator',
  },
} as const;

/** Extract all span name string literals for type-checking */
type DeepValues<T> = T extends string
  ? T
  : T extends Record<string, unknown>
    ? DeepValues<T[keyof T]>
    : never;

export type MshSpanName = DeepValues<typeof MshSpan>;
