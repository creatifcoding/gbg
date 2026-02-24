#!/usr/bin/env bun
/**
 * Provision NATS Object Store bucket for the AVA fusion pipeline.
 *
 * Creates 1 Object Store bucket:
 *   ava-blobs — for IQ samples, large payloads, model weights
 *
 * Idempotent — safe to re-run.
 *
 * @see ava-fusion-runtime/src/nats_object.rs — chunk_size = 128KB
 * @see AVA.3-R7: IQ sample data SHOULD use Object Store
 */

import { connect, StorageType } from "nats";

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";
const NATS_TOKEN = process.env.NATS_TOKEN ?? "ava-dev-token";

async function main(): Promise<void> {
  console.log(`Connecting to NATS at ${NATS_URL}...`);
  const nc = await connect({ servers: NATS_URL, token: NATS_TOKEN });
  const js = nc.jetstream();

  console.log("Provisioning Object Store (AVA.3-R7):");

  try {
    await js.views.os("ava-blobs", {
      description: "Large blob storage (IQ samples, model weights, payloads)",
      storage: StorageType.File, // File-backed for durability
      max_bytes: 10 * 1024 * 1024 * 1024, // 10GB
    });
    console.log("  [ok] ava-blobs — 128KB chunks, 10GB max, file storage");
  } catch (err) {
    console.error("  [FAILED] ava-blobs:", err);
    process.exit(1);
  }

  console.log("Done — Object Store provisioned.");
  await nc.drain();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
