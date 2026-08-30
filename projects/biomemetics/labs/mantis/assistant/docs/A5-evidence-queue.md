# About the A5 evidence queue

The review queue is the consistency boundary. A lab `EvidenceRecord` can be schema-valid and still be the wrong kind of thing for the assistant to admit. The queue is the missing state machine. Packets move `draft → validated → pending-review → accepted | rejected | retained-inconclusive`.

Call `createEvidenceQueue`, then `enqueueDraft`, `validate`, `submit`, and `accept`. Do not treat a single JSON object as a self-sufficient envelope that can preview, bind a target, or carry its own admission.

## Origins

`parseIntake` takes a closed `origin` string. It does not infer origin from producer, text, or `kind`.

Admissible origins are `canonical-record` and `lab-artifact`. Inadmissible origins never construct a `DraftPacket`. Those origins are `observational-memory`, `chat`, `recommendation`, `raw-telemetry`, `taxon-hypothesis`, `photo-only-taxon`, and `photo-only-location`. Mastra observational memory is `observational-memory`. It is not care truth and not a catalog write.

A canonical record that still carries taxon or locality keys is refused as `taxon-or-locality-keys-present`.

## Roles

`curator` drafts and submits. `adversarialReviewer` calls `flagDefect` and leaves the packet in `pending-review`. `governedReviewer` is the only role `accept` will take. A curator object that is cast through still fails at runtime when `role` is not `governed-reviewer`, or when `actorId` equals the author.

Incoming `review.status` is discarded to `pending`. Incoming `projectionBinding` is stripped. A fixture that already says `accepted` cannot self-admit.

## Schema gate

`schema-gate.ts` reads `labs/mantis/contracts/evidence.schema.json` and pins digest `bf38331eb8f66d1152e0ef16ab003ebc6fb4c5d9ec9b06cf395860e2f3485cf1`. It does not import `@tmnl/mantis-lab` or `@tmnl/specimendb`. A lookalike gate that is not in the WeakSet throws.

`claim-unbound` and `digest-missing` are named transition reasons at `validate`. They are not silent schema noise.

## Empty wells that are not this aggregate

CopilotKit `runtimeUrl` is not required. A2 is not required. The queue does not mint a Specimen, select a target, or infer locality.
