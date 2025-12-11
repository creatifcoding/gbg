I’ll structure this around three things you asked for:

1. Pull-based reductions/enrichments
2. Asset ↔ view-artifact references
3. Network + persistence + operational idempotency

---

## 1. Pull-based reductions & enrichments

Definitions in your AMS:

* **Reduction**: pure projection `Asset → View` that:

  * drops fields,
  * normalizes/renames,
  * aggregates asset-internal data only.

* **Enrichment**: pure function `Asset ⨯ DomainSources → View` that:

  * joins in domain data (WMS/TMS tables, telemetry, etc.),
  * computes derived fields.

Both are **pull-based**:

* No profile is pushing state into the Asset.
* A **view request** triggers:

  1. Fetch Asset snapshot.
  2. Optionally fetch domain data.
  3. Compute `View`.
  4. Optionally write/update a `ViewArtifact` record.
  5. Return the `View` (or ref to the `ViewArtifact`).

So “section-level semantics” live on *pulled* data; the Asset itself only stores *references*.

---

## 2. Asset ↔ ViewArtifact references

Extend the monolithic `Asset` with:

* A registry of “current view artifacts”.
* Indexed by profile (domain) and maybe purpose.

### 2.1 View artifact model

```ts
export type ProfileId = string;        // e.g. "profile:wms:truck", "profile:tms:truck"

export const ViewArtifactId = Schema.String;
export type ViewArtifactId = Schema.Schema.Type<typeof ViewArtifactId>;

// Minimal metadata for a view artifact
export interface ViewArtifactMeta {
  readonly artifactId: ViewArtifactId;
  readonly assetId: string;
  readonly profileId: ProfileId;
  readonly assetVersion: string;      // e.g. hash/version of the asset snapshot used
  readonly computedAt: Date;
  readonly ttlMs?: number;            // optional TTL for cache
  readonly contentHash: string;       // hash of serialized view payload
}

// “Opaque” payload; profile knows how to decode
export interface ViewArtifact {
  readonly meta: ViewArtifactMeta;
  readonly payload: unknown;
}
```

### 2.2 References on the Asset

On the Asset itself, store only **references**, not full views:

```ts
export interface ViewArtifactRef {
  readonly profileId: ProfileId;
  readonly artifactId: ViewArtifactId;
}

export interface AssetWithViews /* extends Asset */ {
  // existing Asset fields...

  readonly viewArtifacts: readonly ViewArtifactRef[];
}
```

Key points:

* The Asset doesn’t know the shape of each view; it just knows “these profiles have artifacts for me”.
* View artifacts live in their own store (could be a KV, document DB, etc.).
* Profiles are free to recompute; the Asset reference points at “current” artifact id.

---

## 3. Pull-path: from Asset to profile view

Conceptual pull flow for e.g. WMS truck view:

1. Client calls:

   * `GET /asset/{assetId}/view/{profileId}?idempotencyKey=...`

2. `ProfileGateway`:

   * Looks up Asset snapshot (at some version).
   * Checks Asset’s `viewArtifacts` for a matching `profileId`.
   * If found:

     * Loads `ViewArtifact` from ViewStore.
     * Validates freshness (TTL, assetVersion match).
     * If valid → returns payload.
   * If missing/stale:

     * Calls `ViewProjector.compute(asset, profileId)` to recompute.
     * Writes/upserts `ViewArtifact`.
     * Updates Asset’s `viewArtifacts` list with new `artifactId` (if you want strong linkage).
     * Returns new payload.

Everything is initiated by **pull** (client request).

---

## 4. Idempotency—three layers

You asked for network, persistence, and operational idempotency.

### 4.1 Network idempotency (request-level)

API pattern:

* Client sends `Idempotency-Key` header or query param.

* Server logs:

  ```ts
  interface IdempotencyRecord {
    readonly key: string;
    readonly requestFingerprint: string;  // hash of important inputs
    readonly responseArtifactId: ViewArtifactId;
    readonly createdAt: Date;
  }
  ```

* On each call with `key`:

  * If a record exists with **same** fingerprint → return same view artifact / result.
  * If fingerprint differs → treat as programmer error and reject (prevents key reuse with different semantics).

This guards against:

* Retries from client or intermediary.
* At-least-once delivery on the network.

### 4.2 Persistence idempotency (view-store & asset-store)

You don’t want duplicate or divergent artifacts for “same asset + same profile + same asset version”.

Define a **natural key**:

* `(assetId, profileId, assetVersion)`.

ViewStore upsert:

* `computeView(asset, profileId)` → `(meta, payload)` with:

  * `assetVersion`: version/hash of the asset snapshot used.
  * `contentHash`: hash of payload.

Persist logic:

1. `SELECT artifact WHERE assetId, profileId, assetVersion`:

   * If exists:

     * If `contentHash` same → reuse.
     * If `contentHash` differs → you have non-determinism or changed transform; either:

       * record new artifact as a **new revision**, or
       * treat as conflict and surface.

2. If not exists:

   * `INSERT` new artifact (with `artifactId`).
   * Optionally, mark as “current” for that `(assetId, profileId)`.

Asset update logic:

* When binding Asset to a “current” view:

  * Upsert Asset’s `viewArtifacts` such that there is at most one active ref per `(assetId, profileId)`.

This makes recomputation idempotent **at the persistence layer**.

### 4.3 Operational idempotency (function-of-inputs)

You want:

```text
View = f(AssetSnapshot, DomainSourcesSnapshot)
```

to be:

* Pure (no hidden random/clock access except via explicit inputs),
* Deterministic.

Practically:

* Have `ViewProjector` functions be pure w.r.t. their arguments:

  ```ts
  interface ViewProjector<V> {
    readonly profileId: ProfileId;

    // no side effects; just compute
    compute: (args: {
      asset: Asset;
      assetVersion: string;
      domainData: unknown;      // WMS/TMS-specific fetch results
    }) => V;
  }
  ```

* Domain data fetches (`domainData`) should themselves be **idempotent** and keyed:

  * Example: `fetchWmsState(assetId, atTime)` → stable snapshot.
  * Example: `fetchTmsState(assetId, tripId)` → stable trip view.

As long as:

* `assetVersion` and `domainData` are stable per “logical revision”,
* `compute()` is pure,

then rerunning the whole pull-pipeline multiple times is operationally idempotent.

---

## 5. Putting WMS/TMS profiles into this structure

For the truck:

* **AMS Asset**:

  * Holds identity, BFO base class, properties, traits, and `viewArtifacts` references.

* **WMS Truck Profile**:

  * `ViewProjector<WmsTruckView>` gets:

    * Asset snapshot + assetVersion.
    * WMS state snapshot for that truck (yard status, loads, waves).
  * Computes a `WmsTruckView`.
  * Persists `ViewArtifact` under `(assetId, profileId="profile:wms:truck", assetVersion)`.

* **TMS Truck Profile**:

  * `ViewProjector<TmsTruckView>` gets:

    * Asset snapshot + assetVersion.
    * TMS state snapshot (trip, driver, telemetry).
  * Computes a `TmsTruckView`.
  * Persists `ViewArtifact` under `(assetId, profileId="profile:tms:truck", assetVersion)`.

From the API’s perspective:

* `GET /asset/{id}/view/profile:wms:truck` is a **pull-based reduction/enrichment** into a WMS section with full idempotent semantics across network + persistence + operational behavior.

If you want, next step can be sketching the actual Effect-based service interfaces (`AssetStore`, `ViewStore`, `ProfileGateway`) wired around these keys.
