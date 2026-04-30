/**
 * Re-export shim → `@tmnl/lnk`
 *
 * The Effect v4-native Durable Streams implementation lives in its own workspace
 * package (`packages/lnk/`) so that v3 (the rest of TMNL) and v4
 * imports never collide in TS resolution.
 *
 * This shim exists so that TMNL-internal call-sites can keep using
 * `@/lib/holonet/durable-streams/latest` without knowing about the package
 * boundary.
 *
 * See `packages/lnk/ARCHITECTURE.md` for the architecture & phase plan.
 *
 * @module
 */

export * from '@tmnl/lnk';
