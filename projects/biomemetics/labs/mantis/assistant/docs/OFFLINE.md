# Offline keeper (A1)

Status: `DRAFT` — local CareSubject PWA. Not shop-release. Not EVA. Not a graph claim. Not SpecimenDB.

This document is the A1 contract for capture, care logging, and export when Mastra, a model provider, Particle, or the network are unavailable. Canonical care truth is the append-only local event log. Mastra observational memory, when A0 binds it, is conversational continuity only.

## What stays useful offline

- Create a local `CareSubject`. Never a catalog Specimen.
- Capture or import a photo. EXIF location is stripped before the blob is addressed. The photo does not write taxon or locality.
- Write visible observations separately from interpretations and taxon hypotheses.
- Log `offered`, `eaten`, `refused`, and `removed` as distinct human-confirmed events.
- Set and cancel local reminders.
- Read sourced order-level care guidance from the golden-care fixture. Numerical prescriptions are withheld without a reviewed applicable CarePlan.
- Export and import a digest-checked envelope without duplicating events or blobs.
- Restart the PWA and rebuild the same read models from the log.

## What is an empty well offline

- Live Mastra / CopilotKit AG-UI streaming, until A0 publishes a bound runtime URL and contracts.
- Current supply inventory and public-transit options (assayed adapter is online-only; declining location still allows manual place entry and all non-map care functions).
- Terrarium telemetry. The Terrarium surface is an explicit empty well. Unavailable is not “safe.”
- Service / actuation / `device-command`. Hidden unless simulator query is on, and even then it is a simulator label, not a command path.
- SpecimenDB attachment, evidence admission, EVA, and shop-release.

## Event log

- Append-only. Corrections and supersessions are new events (`correction.issued` or `supersedesEventId`).
- Idempotency keys on capture, import, reminder, and confirmed care actions. Replaying the same key returns the original event.
- Unknown future `schemaVersion` values are retained and not folded into read models.
- Events hold digests and metadata, never raw image bytes.

## Blobs

- Content-addressed SHA-256 after location metadata is stripped.
- JPEG APP1 Exif (GPS IFD) and PNG `eXIf` / GPS text chunks are dropped before hashing.
- Re-ingest of the same stripped bytes is a digest hit, not a second blob.

## Export / import

Envelope kind: `MantisAssistantOfflineExport`.

- Canonical digest over event digests + blob digests.
- Privacy inspect refuses exact address, EXIF location, and GPS tokens.
- Import skips existing `eventId` / `idempotencyKey` / blob digest. No duplicates.

## Location

- Permission is per use and purpose-bound to `supply-transit`.
- Grants expire after the lookup and are not persisted on the CareSubject.
- Exact address and EXIF location are removed before memory, trace, export, or evidence drafts.
- Manual place entry is allowed when GPS is declined. It is not locality for the animal.

## CopilotKit / Mastra

The PWA depends on CopilotKit as the AG-UI surface. Mastra is table-stakes stack consumed through A0 contracts (`assistant/contracts/**`, `tooling/typescript/mantis-assistant/**`). A1 does not edit those paths. If a type is missing, A1 fixtures it locally and leaves the Mastra/controller well empty.

No LLM output can become a CareEvent without a separate confirmation. No chat path exposes `device-command` or `admin`.
