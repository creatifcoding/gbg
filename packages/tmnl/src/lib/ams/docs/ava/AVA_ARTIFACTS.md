Treat everything as “hybrid,” always.
“Snapshot-only” and “stream-only” are just degenerate cases of the same structure.

Below is a clean consolidation.

---

## 1. Unify: one artifact, many channels

Drop `SNAPSHOT | LIVE | HYBRID` at the top level.

Instead: a **view artifact** is a bundle of **channels**; each channel may have:

* a static `snapshot` (initial state)
* and/or a `stream` binding (updates)

```ts
export type ViewId = string;          // "view:wms:truck"
export type ViewArtifactId = string;

export type TransportKind = "nats" | "ws" | "sse" | "kafka";

export interface ChannelSnapshot {
  readonly schemaId: string;          // e.g. "schema:wms:truck.state:v1"
  readonly data: unknown;             // validated externally
}

export interface ChannelStreamBinding {
  readonly transport: TransportKind;
  readonly endpoint: string;          // e.g. nats://..., wss://..., http://... (SSE)
  readonly channel: string;           // subject/topic/path
  readonly consumerGroup?: string;
  readonly cursorKey?: string;        // resume token / seq / offset
  readonly encoding?: "json" | "cbor" | "arrow" | "protobuf";
  readonly ttlMs?: number;
}

export interface ViewChannel {
  readonly id: string;                // "state", "yardEvents", "telemetry", etc.
  readonly label?: string;

  // Snapshot-only: snapshot != undefined, stream undefined
  // Stream-only:   snapshot undefined, stream != undefined
  // Fully hybrid:  both present
  readonly snapshot?: ChannelSnapshot;
  readonly stream?: ChannelStreamBinding;
}

export interface ViewArtifactMeta {
  readonly artifactId: ViewArtifactId;
  readonly assetId: string;
  readonly viewId: ViewId;

  readonly assetVersion: string;      // hash/version of asset snapshot used
  readonly computedAt: Date;
  readonly contentHash: string;       // hash over (viewId, assetVersion, channels[])
}

export interface ViewArtifact {
  readonly meta: ViewArtifactMeta;
  readonly channels: readonly ViewChannel[];
}
```

Everything is now a “hybrid artifact” with an arbitrary mix of channel types.

---

## 2. ViewProfile API: always able to return channels

Change the view profile: instead of “snapshot vs live,” every profile builds a **channel set**.

```ts
export type AssemblageId = string;

export interface ViewProfile {
  readonly id: ViewId;
  readonly label: string;
  readonly validAssemblages: readonly AssemblageId[];

  // Assemblage + asset-level constraints
  isApplicable(asset: Asset): boolean;

  /**
   * Pure function: from asset + domain data -> channels.
   * Channels may have snapshot, stream, or both.
   */
  computeChannels(args: {
    asset: Asset;
    assetVersion: string;
    domainSnapshot: unknown;   // current domain state
    domainLiveConfig: unknown; // endpoints, subjects, etc.
  }): readonly ViewChannel[];
}
```

Special cases:

* **Snapshot-only view**: `computeChannels` returns channels where `stream` is `undefined`.
* **Stream-only view**: channels where `snapshot` is `undefined`.
* **Mixed**: some channels snapshot-only, some stream-only, some with both.

The client can pick:

* “Just use the `snapshot`s.”
* “Connect to each `stream` as needed.”

---

## 3. Idempotency with arbitrary mixes

Idempotency is done on the **descriptor**, not the live bytes:

1. For a given `(assetId, viewId, assetVersion, domainParameters)`:

   * Run `computeChannels(...)` (pure).
   * Canonicalize channels (e.g. sort by `id`, JSON-encode).
   * Compute `contentHash = hash(canonicalChannels)`.

2. Persistence idempotency:

   * Use `(assetId, viewId, assetVersion, contentHash)` as natural key.
   * If a `ViewArtifact` with same key exists → reuse it.
   * Else → insert new artifact.

3. Network idempotency:

   ```ts
   interface IdempotencyRecord {
     readonly key: string;             // from header
     readonly requestFingerprint: string; // includes assetId, viewId, assetVersion, domain params
     readonly artifactId: ViewArtifactId;
   }
   ```

   * Same `key` + same fingerprint → return same `artifactId`.
   * Same `key` + different fingerprint → reject (misuse).

---

## 4. Truck example: WMS hybrid with multiple channels

Same truck, WMS view split into channels:

* `state`: snapshot of capacity + current load.
* `yardEvents`: stream of yard moves.
* `loadEvents`: stream of load/unload changes.

```ts
export const WmsTruckProfile: ViewProfile = {
  id: "view:wms:truck",
  label: "WMS Truck View",
  validAssemblages: ["assemblage:truck"],

  isApplicable(asset) {
    return asset.tags.includes("wms-enabled");
  },

  computeChannels({ asset, assetVersion, domainSnapshot, domainLiveConfig }) {
    const wms = domainSnapshot as {
      loadWeightKg: number;
      loadVolumeM3: number;
      maxWeightKg: number;
      maxVolumeM3: number;
      status: string;
    };
    const cfg = domainLiveConfig as { natsUrl: string };

    const baseChannel = `ams.wms.truck.${asset.id}`;

    const stateChannel: ViewChannel = {
      id: "state",
      label: "Truck WMS State",
      snapshot: {
        schemaId: "schema:wms:truck.state:v1",
        data: {
          assetId: asset.id,
          siteId: asset.site_id,
          sectorId: asset.sector_id,
          containerId: asset.container_id,
          maxWeightKg: wms.maxWeightKg,
          maxVolumeM3: wms.maxVolumeM3,
          loadWeightKg: wms.loadWeightKg,
          loadVolumeM3: wms.loadVolumeM3,
          utilizationPct:
            wms.maxWeightKg > 0 ? (wms.loadWeightKg / wms.maxWeightKg) * 100 : 0,
          status: wms.status
        }
      }
      // no stream here; purely snapshot for now
    };

    const yardEvents: ViewChannel = {
      id: "yardEvents",
      label: "Yard Movement Events",
      stream: {
        transport: "nats",
        endpoint: cfg.natsUrl,
        channel: `${baseChannel}.yard`,
        consumerGroup: `wms-yard-${asset.id}`,
        cursorKey: `asset:${asset.id}:view:wms:truck:yard`,
        encoding: "json",
        ttlMs: 60 * 60 * 1000
      }
    };

    const loadEvents: ViewChannel = {
      id: "loadEvents",
      label: "Load/Unload Events",
      stream: {
        transport: "nats",
        endpoint: cfg.natsUrl,
        channel: `${baseChannel}.load`,
        consumerGroup: `wms-load-${asset.id}`,
        cursorKey: `asset:${asset.id}:view:wms:truck:load`,
        encoding: "json",
        ttlMs: 60 * 60 * 1000
      }
    };

    return [stateChannel, yardEvents, loadEvents];
  }
};
```

Client can:

* Only care about `channels.find(c => c.id === "state")?.snapshot`.
* Or also subscribe to `yardEvents` / `loadEvents` streams.

Same pattern applies to TMS (e.g. `tripState` snapshot + `telemetry` stream + `stopEvents` stream), or any other domain: you just add/remove channels.

---

## 5. Asset side: still just references

Asset doesn’t care how many channels a view has; it just points to artifacts:

```ts
export interface ViewArtifactRef {
  readonly viewId: ViewId;
  readonly artifactId: ViewArtifactId;
}

export interface Asset {
  // ...
  readonly viewArtifacts?: readonly ViewArtifactRef[];
}
```

All the complexity of mixing snapshots and streams lives in:

* `ViewArtifact.channels[]`, and
* the `ViewProfile.computeChannels` implementation.

Everything is “hybrid” by construction; “snapshot-only” and “stream-only” are just subsets of the general case.
