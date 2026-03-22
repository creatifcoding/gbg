# Conductor Chat UX v1 Baseline (Design Kickoff)

Owner: Val  
Feature: #F206  
Date: 2026-02-10

## Decision Inputs (Questionnaire Run: `conductor-chat-ux-kickoff`)

- Density: **balanced**
- Composer: **guided** (visible slash/mention affordances)
- Failure UX: **inline banners in thread**
- Breakout policy: **inline-first, manual breakout**
- Agent switch: **preserve draft + context chips by default**

---

## UX Principles (v1)

1. **Operator clarity over flourish**
   - Every state change must be inspectable: sending, streaming, final, error, offline, reconnecting.
2. **Composer confidence**
   - Slash + mention affordances are visible, not hidden power-user trivia.
3. **Thread truthfulness**
   - Thread reflects server-authoritative event stream with minimal optimistic overlays.
4. **Failure is first-class**
   - Inline failure banners live where work happens (inside thread region).
5. **Fast path priority**
   - Enter-to-send, immediate accepted state, progressive deltas, stable finalization.

---

## Low-Fi Information Architecture

```txt
┌──────────────────────────────────────────────────────────────┐
│ Header: Agent Selector | Session Status | Connectivity Badge │
├──────────────────────────────────────────────────────────────┤
│ Context Chips Row: @entities | panel context | active mode   │
├──────────────────────────────────────────────────────────────┤
│ Thread                                                      │
│  - inline status rows (accepted/streaming/reconnecting)     │
│  - assistant/user messages                                  │
│  - inline error banners                                     │
│  - optional "Open in Panel" breakout action                │
├──────────────────────────────────────────────────────────────┤
│ Composer                                                    │
│  - textarea                                                 │
│  - guided controls: /command, @mention, voice, send         │
│  - thinking level + mode toggles                            │
└──────────────────────────────────────────────────────────────┘
```

---

## Primary State Model (UI)

- `idle`
- `typing`
- `send-accepted`
- `streaming`
- `finalized`
- `error`
- `offline`
- `reconnecting`
- `resyncing`

State transitions are driven by Chat V2 events (`session_opened`, `send_accepted`, `assistant_start`, `assistant_delta`, `assistant_final`, `error`) plus transport connectivity signals.

---

## Components.build + Vercel Guidance (applied)

- Compound components maintained (`Root/Header/Thread/Composer`)
- Accessibility-first defaults and semantic regions
- Controlled+uncontrolled compatible internal state handling at component boundaries
- Minimal rerender strategy for stream updates (append/mutate targeted assistant row)
- Avoid waterfall behavior in send path (ack fast, stream after)

---

## v1 Deliverables

1. **IA + states** (this doc)
2. **Slot contract map** (next: #742)
3. **Interaction precedence matrix** (escape/enter/suggestions/voice/agent-switch)
4. **Failure copy + severity map** (inline banners)

---

## Out-of-Scope for v1

- Auto-breakout default behavior
- Advanced multimodal orchestration choreography
- Non-essential visual polish/theme variants
