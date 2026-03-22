# ADR-008: System Named "Tsingou" — SIGINT/OSINT Analysis Platform

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user), Val (architect)  
**Evidence**: Questionnaire `tsingou-d2ts-signal-pipeline` (naming question), conversation context

---

## Context

Tsingou is a new system — not a fork of nw_wrld. nw_wrld (`submodules/nw_wrld/`) is included as a git submodule for **architectural reference only** — we study its patterns, learn from its decisions, and deliberately diverge where the SIGINT/OSINT mission demands. No nw_wrld code is copied. The implementation is entirely new, built on Effect-TS.

The system needed a name reflecting its identity as a "unified, signal-driven, multi-layer SIGINT/OSINT analysis platform that uses audiovisual rendering as its output modality."

## Decision

**Named "Tsingou"** after **Mary Tsingou (1928–2023)**, MANIAC programmer at Los Alamos National Laboratory.

### Why Mary Tsingou

- Programmed the MANIAC I computer for the Fermi-Pasta-Ulam-Tsingou problem (1955)
- Her work established that nonlinear systems can exhibit recurrent behavior — a foundational insight for signal analysis
- The FPUT problem she programmed was one of the first computer simulations ever run
- She was systematically uncredited for decades — the problem was called "Fermi-Pasta-Ulam" until 2008 when "Tsingou" was finally added
- Signals, analysis, computation, justice — the name carries weight

### Package Names

| Package | Purpose |
|---------|---------|
| `@tmnl/tsingou-core` | Core schemas, types, branded IDs |
| `@tmnl/tsingou-flow` | Signal pipeline (d2ts + Effect bridge) |
| `@tmnl/tsingou-operators` | Custom d2ts operators |
| `@tmnl/tsingou-r3f` | R3F rendering layer |
| `@tmnl/tsingou-p5` | p5 rendering layer |
| `@tmnl/tsingou-visx` | visx rendering layer |
| `@tmnl/tsingou-postfx` | Post-processing effects |

### Identity Shift

| Aspect | nw_wrld | Tsingou |
|--------|---------|---------|
| Purpose | Audiovisual sequencer | SIGINT/OSINT analysis platform |
| Input | MIDI, OSC, audio, file | ANY signal source (8+ adapters) |
| Output | Visual modules | 4-layer rendering (R3F, visx, p5, DOM) |
| Pipeline | Imperative broadcast | d2ts differential dataflow |
| Runtime | Electron (3 processes) | Tauri (single process + sidecars) |
| State | Jotai + mutable objects | effect-atom (Atom-as-State) |
| Transport | Electron IPC | NATS (Holonet) |

## Consequences

### Positive
- Clear differentiation from upstream nw_wrld
- Meaningful name with history and purpose
- `@tmnl/tsingou-*` namespace prevents collision

### Negative
- Pronunciation may be unfamiliar ("SING-go")
- Google searches return physics papers (good for credibility, confusing for newcomers)
