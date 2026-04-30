# @tmnl/lnk

Effect v4-native Durable Streams client and server-adapter library.

Spec-faithful implementation of the [Durable Streams wire protocol](https://github.com/durable-streams/durable-streams) with:

- **First-class `Yieldable` stream handles** — `DurableStream<A>` extends `Effect.YieldableClass` so `yield*` returns the latest message
- **`Pull`-driven offset tracking** — manual catch-up via `Stream.toPull`, no polling hacks
- **`@tmnl/stx` integration** — React surface backed by `stxLatest` / `stxPull` / `stxShared` materializers
- **Pluggable transports** — same client API over real HTTP, in-memory test wire, or a NATS-bridge server

## Status

🚧 Under active construction. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the phased rebuild plan.

## Replaces

This package replaces the legacy `tmnl/src/lib/holonet/durable-streams/v1/` Effect v3 implementation, which encoded a non-spec-faithful wire model (numeric offsets, custom JSON envelope, no producer-epoch fencing, no CDN cursor support).

## Why a separate package?

- Effect v4 lives alongside v3 in this monorepo via the `effect-v4` npm alias (same pattern as `@tmnl/stx`).
- Isolating v4 surface in its own package prevents accidental v3/v4 mixing in TS resolution.
- Workspace-linked into `@tmnl/tmnl` via `workspace:*`.

## License

MIT
