1) verdict: Only in-memory and HTTP wires are currently implemented; NATS-backed Wire is not implemented yet (phase-planned only).

2) evidence file:line:
- packages/lnk/src/services/wire/index.ts:11-14 (`./nats-bridge` marked Phase 5, planned); 64-65 exports only `InMemory` and `Http`.
- packages/lnk/src/services/wire/Wire.ts:9-12 lists `NatsBridgeWire` as planned server-side adapter (no implementation in file).
- packages/lnk/src/services/wire/in-memory/index.ts:10-12 exports only `InMemoryWire`/`InMemoryInner`.
- packages/lnk/src/services/wire/http/index.ts:15-17 exports only HTTP wire pieces.
- packages/lnk/ARCHITECTURE.md:250 notes `NatsBridgeWireLive` as future Phase 5; 341-350 details Phase 5 NATS tasks unchecked.
- packages/lnk/CONFORMANCE.md:434-445 marks Phase 1/in-memory/http complete; 482 shows Phase 3 as "NATS-bridge wire" (later).
- packages/pct/src/cli/serve.ts:170-178 wires `LnkServices.Wire.Http.Routes` + `LnkServices.Wire.InMemory.InMemoryWire.layer` only.

3) next work: implement `packages/lnk/src/services/wire/nats-bridge/` (`NatsBridgeWire`) and switch any runtime composition where NATS transport is desired, then close out Architecture/Conformance Phase 5/NATS bridge milestones.