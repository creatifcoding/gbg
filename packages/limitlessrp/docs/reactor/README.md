# LimitlessRP Reactor Integration

OpenProse Reactor is now vendored as a GBG submodule at:

```txt
submodules/openprose
```

The Reactor package of interest is:

```txt
submodules/openprose/packages/reactor
```

At the pinned submodule commit, `@openprose/reactor` is version `0.3.1`; the CLI is `@openprose/reactor-cli` version `0.2.2`.

## What Reactor adds

Reactor is a deterministic harness for **standing OpenProse responsibilities**. It is not just another `prose run` wrapper.

The key mechanics from the upstream docs:

- A `kind: responsibility` declares a truth to keep current.
- A `kind: gateway` turns external arrivals into wake events.
- Compile freezes model-authored intelligence into deterministic artifacts: topology, canonicalizers, and postcondition validators.
- Runtime is a dumb reconciler: compare `(contract_fingerprint, input_fingerprints)`.
- If inputs did not materially move, write a cheap skipped receipt and avoid the expensive render.
- Every render/skip leaves a content-addressed receipt ledger.
- Cost is meant to scale with **surprise**, not with wall-clock polling.

## Why it fits LimitlessRP

LimitlessRP has standing truths, not just one-shot reports:

1. The iridium source registry should remain current enough for diligence.
2. The research cache should remain citation-audited and fresh by source class.
3. The due-diligence memo should update when either intake or audited research changes.
4. Quiet days should not re-run expensive research agents.

That maps cleanly to Reactor:

```txt
iridium_source_refresh gateway
  -> iridium_research_cache responsibility
       -> iridium_due_diligence_memo responsibility
```

## Files added

```txt
packages/limitlessrp/reactor/reactor.yml
packages/limitlessrp/reactor/iridium-source-refresh.prose.md
packages/limitlessrp/reactor/iridium-research-cache.prose.md
packages/limitlessrp/reactor/iridium-due-diligence-memo.prose.md
```

## Keyless commands

From `packages/limitlessrp/reactor`:

```bash
bunx --package @openprose/reactor-cli reactor doctor
bunx --package @openprose/reactor-cli reactor compile --check
```

`compile --check` is expected to report stale until a live compile has produced IR. It is still useful in CI as a keyless freshness gate.

## Live commands

Live compile/run requires provider credentials and peers. OpenProse docs suggest OpenRouter as the safe default today.

```bash
export OPENROUTER_API_KEY=...
bunx --package @openprose/reactor-cli reactor compile
bunx --package @openprose/reactor-cli reactor serve --http 8080
bunx --package @openprose/reactor-devtools reactor-devtools .reactor --describe
```

## Safety boundary

Reactor should maintain research state and memo artifacts. It must not:

- execute trades,
- recommend buy/sell/hold,
- store private counterparty details in committed artifacts,
- expose unauthenticated `reactor serve` outside loopback,
- treat stale price context as current.

## Integration path

1. Keep current `workflows/*.prose.md` as one-shot authored routines.
2. Use `reactor/*.prose.md` for standing state maintenance.
3. Let `iridium_research_cache` call the scraping workflow only when source registry or freshness actually moves.
4. Let `iridium_due_diligence_memo` re-render only when intake or accepted research facts move.
5. Replay receipts with `reactor-devtools` to audit why a memo changed and what caused model spend.
