# About A5 projection preview

Preview is a pure function of an `AcceptedPacket` plus a caller-supplied existing catalog target. `previewAccepted` goes through `requireAccepted`. Draft, validated-only, pending-review, rejected, and retained-inconclusive packets cannot preview.

## Payload

Component text is `admission.text`. Analog links use `admission.target`. `result.summary` is not a field the payload builder copies. Observed and measured records with `result.disposition === 'supports'` are the only preview-eligible source classes. Taxon and Locality are not `ProjectionComponent` tags.

`parseExistingTarget` wraps a caller string as `gbg:specimen:<id>`. It refuses a blank id, `biomemetics.mantis`, `mantis-lab`, and `projects/biomemetics/labs/mantis`. It does not call Intake. It does not invent an id.

## Cheap entity, gated component

A preview ref and a receipt ref are cheap entities. They are local branded strings `gbg:preview:<evidenceId>:<targetId>@<payloadDigest>` and `gbg:receipt:<evidenceId>:<targetId>@<payloadDigest>`. They are not `SpecimenId`. Honesty is the literal `projected` because the receipt is a receipt of a plan that did not run.

The same evidence id, target id, and payload digest mint the same refs. Retry and restart do not create a second attachment identity.

Catalog attach stays gated. `packages/specimendb/src/rpc/SpecimenRpcs.ts` on this branch exports Intake, Get, List, and Promote. There is no Attach RPC. `probeAttachWell` looks at a caller-supplied port. If `attach` or `Attach` is not a function, the well is `empty-well` with reason `specimendb-attach-unavailable`. If it is a function, the well is `gated-well` and this cut still does not call it. `executable` and `storeWrite` stay the literal `false`. `planAttach` does not mutate the accepted packet when the well is empty.

This cut is not shop-release and not A6.
