#!/usr/bin/env bun
/**
 * Provision NATS KV buckets for the AVA fusion pipeline.
 *
 * Creates 4 KV buckets from AVA.3.6:
 *   ava-config, ava-state, ava-metrics, ava-schemas
 *
 * Idempotent — safe to re-run.
 *
 * @see docs/specifications/rfc/rfc-section-nats-subject-taxonomy.md §AVA.3.6
 * @see ava-fusion-runtime/src/nats_kv.rs — Key format conventions
 */

import { connect } from "nats";

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";
const NATS_TOKEN = process.env.NATS_TOKEN ?? "ava-dev-token";

/** Seconds shorthand. */
const HOURS = (h: number) => h * 60 * 60;

interface KvBucketDef {
  bucket: string;
  description: string;
  /** Max age in seconds (0 = no expiry). */
  ttl: number;
  /** Max value size in bytes. */
  max_value_size: number;
  /** History per key. */
  history: number;
}

/**
 * AVA.3.6 KV Bucket definitions.
 *
 * Key format: dots as separators (colons INVALID per AVA.3-R4).
 *   ava-config: pipeline.{name}, joinpath.{id}
 *   ava-state:  entity.{entity_id}, track.{track_id}
 *   ava-metrics: actor.{name}.stats
 *   ava-schemas: signal.{kind}
 */
const KV_BUCKETS: KvBucketDef[] = [
  {
    bucket: "ava-config",
    description: "Pipeline configs, join path definitions",
    ttl: 0, // No expiry — config is permanent until explicitly updated
    max_value_size: 1024 * 1024, // 1MB
    history: 5,
  },
  {
    bucket: "ava-state",
    description: "Entity state, track state (high TTL)",
    ttl: HOURS(168), // 7 days
    max_value_size: 1024 * 1024, // 1MB
    history: 1, // Only latest state matters
  },
  {
    bucket: "ava-metrics",
    description: "Actor performance counters (short TTL)",
    ttl: HOURS(1), // 1 hour
    max_value_size: 64 * 1024, // 64KB — metrics are small
    history: 1,
  },
  {
    bucket: "ava-schemas",
    description: "Signal payload schemas",
    ttl: 0, // No expiry
    max_value_size: 256 * 1024, // 256KB — schemas can be verbose
    history: 3,
  },
];

async function main(): Promise<void> {
  console.log(`Connecting to NATS at ${NATS_URL}...`);
  const nc = await connect({ servers: NATS_URL, token: NATS_TOKEN });
  const js = nc.jetstream();

  console.log("Provisioning KV buckets (AVA.3.6):");

  for (const def of KV_BUCKETS) {
    try {
      // Try to open existing bucket — if it exists, we're good
      await js.views.kv(def.bucket, {
        description: def.description,
        ttl: def.ttl > 0 ? def.ttl * 1_000 : undefined, // nats.js KV ttl is in milliseconds
        maxValueSize: def.max_value_size,
        history: def.history,
      });
      console.log(`  [ok] ${def.bucket} — ${def.description}`);
    } catch (err) {
      console.error(`  [FAILED] ${def.bucket}:`, err);
      process.exit(1);
    }
  }

  console.log(`Done — ${KV_BUCKETS.length} KV buckets provisioned.`);
  await nc.drain();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
