#!/usr/bin/env bun
/**
 * Provision JetStream streams for the AVA fusion pipeline.
 *
 * Creates 7 streams from AVA.3 (NATS Subject Taxonomy):
 *   SENSOR_KINETIC, SENSOR_RF, SENSOR_CYBER, SENSOR_OSINT,
 *   SENSOR_GEO, FUSION_RESULTS, ALARMS
 *
 * Idempotent — safe to re-run. Uses update-or-create pattern.
 *
 * @see docs/specifications/rfc/rfc-section-nats-subject-taxonomy.md §AVA.3.7
 */

import { connect, type JetStreamManager, type StreamConfig, RetentionPolicy, StorageType } from "nats";

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";
const NATS_TOKEN = process.env.NATS_TOKEN ?? "ava-dev-token";

/** Hours to nanoseconds (NATS max_age is in nanoseconds). */
function hoursToNanos(h: number): number {
  return h * 60 * 60 * 1_000_000_000;
}

interface StreamDef {
  name: string;
  subjects: string[];
  retention: RetentionPolicy;
  max_age_hours: number;
  description: string;
}

/**
 * AVA.3.7 JetStream Stream Mapping — verbatim from the RFC.
 * Each stream captures exactly the listed subjects with no overlap.
 */
const STREAMS: StreamDef[] = [
  {
    name: "SENSOR_KINETIC",
    subjects: ["sensor.adsb.>", "sensor.ais.>", "sensor.radar.>", "sensor.satellite.>"],
    retention: RetentionPolicy.Limits,
    max_age_hours: 24,
    description: "Kinetic sensor replay (AdsB, Ais, Radar, Satellite)",
  },
  {
    name: "SENSOR_RF",
    subjects: ["sensor.rfbearing.>", "sensor.sdr.>", "sensor.sigint.>", "sensor.elint.>", "sensor.comint.>"],
    retention: RetentionPolicy.Limits,
    max_age_hours: 24,
    description: "RF signal replay (RfBearing, Sdr, Sigint, Elint, Comint)",
  },
  {
    name: "SENSOR_CYBER",
    subjects: ["sensor.http.>", "sensor.dns.>", "sensor.cyber.>"],
    retention: RetentionPolicy.Limits,
    max_age_hours: 72,
    description: "Cyber data replay (Http, Dns, Cyber)",
  },
  {
    name: "SENSOR_OSINT",
    subjects: ["sensor.osint.>", "sensor.social.>", "sensor.financial.>", "sensor.travel.>"],
    retention: RetentionPolicy.Limits,
    max_age_hours: 72,
    description: "OSINT replay (Osint, Social, Financial, Travel)",
  },
  {
    name: "SENSOR_GEO",
    subjects: ["sensor.geoint.>", "sensor.humint.>", "sensor.masint.>"],
    retention: RetentionPolicy.Limits,
    max_age_hours: 168,
    description: "Geo/human replay (Geoint, Humint, Masint)",
  },
  {
    name: "FUSION_RESULTS",
    subjects: ["fusion.>"],
    retention: RetentionPolicy.Limits,
    max_age_hours: 168,
    description: "All fusion output (tier results, tracks, entities)",
  },
  {
    name: "ALARMS",
    subjects: ["alarm.>"],
    retention: RetentionPolicy.Interest,
    max_age_hours: 720,
    description: "Alarm archive (30 days)",
  },
];

async function provisionStreams(jsm: JetStreamManager): Promise<void> {
  for (const def of STREAMS) {
    const config: Partial<StreamConfig> = {
      name: def.name,
      subjects: def.subjects,
      retention: def.retention,
      max_age: hoursToNanos(def.max_age_hours),
      storage: StorageType.File,
      num_replicas: 1,
      description: def.description,
    };

    try {
      // Try update first (stream exists)
      await jsm.streams.update(def.name, config);
      console.log(`  [updated] ${def.name} — ${def.subjects.join(", ")}`);
    } catch {
      try {
        // Stream doesn't exist — create it
        await jsm.streams.add(config as StreamConfig);
        console.log(`  [created] ${def.name} — ${def.subjects.join(", ")}`);
      } catch (err) {
        console.error(`  [FAILED]  ${def.name}:`, err);
        process.exit(1);
      }
    }
  }
}

async function main(): Promise<void> {
  console.log(`Connecting to NATS at ${NATS_URL}...`);
  const nc = await connect({ servers: NATS_URL, token: NATS_TOKEN });
  const jsm = await nc.jetstreamManager();

  console.log("Provisioning JetStream streams (AVA.3.7):");
  await provisionStreams(jsm);

  console.log(`Done — ${STREAMS.length} streams provisioned.`);
  await nc.drain();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
