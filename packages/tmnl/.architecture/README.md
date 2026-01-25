# TMNL Architecture Documentation

**Purpose**: This directory documents architectural decisions, system organization strategies, and reorganization initiatives for the TMNL codebase.

**Goal**: Provide agent-friendly documentation for maintaining clarity across 100+ systems.

---

## Document Index

| Document                                 | Purpose                                               | Status     |
| ---------------------------------------- | ----------------------------------------------------- | ---------- |
| [REORG_STRATEGY.md](./REORG_STRATEGY.md) | Comprehensive reorganization strategy for 71+ systems | ✅ Initial |
| [AGENTS.md](./AGENTS.md)                 | Agent handoff guide for this directory                | ✅ Initial |

_Last Updated: 2026-01-14_

---

## What's Here

### Strategy Documents

- **REORG_STRATEGY.md**: Complete analysis of current state + 4-phase reorganization plan with concrete file structures

### Agent Documentation

- **AGENTS.md**: Describes the structure of this directory, how to extend it, and agent handoff conventions

---

## How to Extend

When adding new architecture documents:

1. **Add to INDEX.md**: Update the table above with new document name, purpose, and status
2. **Follow naming**: Use descriptive names like `[SYSTEM]_DECISION.md` or `[TOPIC]_GUIDE.md`
3. **Agent-friendly**: Document should be self-contained, include:
   - **Context**: Why this document exists
   - **Problem**: What issue it addresses
   - **Solution**: Concrete recommendation
   - **Status**: Implemented / In Progress / Proposed
   - **Dependencies**: Other docs to reference

---

## Related Documentation

- **`.edin/`**: EDIN cycle tracking (Experiment → Design → Implement → Negotiate)
- **`src-ava/docs/`**: AVA system architecture
- **`assets/documents/`**: Architectural Decision Records (ADRs)

---

_For questions about TMNL architecture, consult Val (AGENTS.md)_
