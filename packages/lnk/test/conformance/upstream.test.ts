/**
 * @vitest-environment node
 *
 * Upstream conformance — runs the OFFICIAL `@durable-streams/server-conformance-tests`
 * suite (232 tests across 11 categories) against our `node:http` spec server,
 * which is itself backed by our `InMemoryWire`.
 *
 * This validates spec faithfulness end-to-end against the canonical test
 * vectors — different from our internal `test/services/wire/conformance.ts`
 * (which is transport-agnostic and tests our wire shape directly).
 *
 * If the upstream suite passes here, our spec server's wire encoding is
 * spec-compliant and our `InMemoryWire` semantics are correct.
 *
 * @module @tmnl/lnk/test/conformance/upstream.test
 */

import { runConformanceTests } from "@durable-streams/server-conformance-tests"
import { beforeAll, afterAll } from "vitest"

import {
  startSpecServer,
  stopSpecServer,
  type SpecServerHandle,
} from "../services/wire/http/_spec-server.js"
import { v1Paths } from "../../src/services/wire/Paths.js"

let server: SpecServerHandle

beforeAll(async () => {
  // Upstream suite uses `/v1/stream/<id>` paths; configure the spec server
  // to match.
  server = await startSpecServer({ paths: v1Paths })
})

afterAll(async () => {
  await stopSpecServer(server)
})

// `runConformanceTests` registers describe/it blocks at module-load time,
// so we set up a Proxy/lazy-baseUrl pattern: the test runner consults the
// `baseUrl` getter at test-execution time (after `beforeAll` has run).
//
// Vitest evaluates describe/it bodies LAZILY at test execution; the
// configuration object is captured by closure. This means we can pass an
// object whose `baseUrl` is computed at-call-time.
runConformanceTests({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get baseUrl(): string {
    return server?.baseUrl ?? "http://127.0.0.1:0"
  },
} as { baseUrl: string })
