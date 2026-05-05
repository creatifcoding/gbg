/**
 * @tmnl/pct/manifest — structured snapshots of an instance's recognized
 * schemas and operations.
 *
 * Per `PCT.md` §7 the manifest is the readout of a registry's live state:
 * what's in `/capabilities`, what `pact registry status` prints, what
 * federated peers compare to detect drift.
 *
 * Manifest is a `Schema.TaggedClass` (entity with methods). Sub-entities
 * (`PeerInfo`) are `TaggedStruct`. Wire form is self-describing JSON.
 *
 * @module @tmnl/pct/manifest
 */

export {
  type FromRegistryOptions,
  type ManifestDiff,
  type PrintOptions,
  Manifest,
  PeerInfo,
} from "./Manifest.js"
