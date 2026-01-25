# TMNL Architecture: Analysis & Cleanup Summary

**Date**: 2026-01-14
**Scope**: Complete scan of 71 systems in `src/lib/` for organization and cruft identification

---

## Executive Summary

**Codebase**: 71 systems in `src/lib/` with mixed organization quality

- **Issue**: Version sprawl (parallel development tracks), scattered documentation, unclear cross-system boundaries
- **Good News**: Cross-system imports are well-separated, no node_modules in lib, no TODO files

**Recommendation**: Tiered architecture + targeted cruft deletion before reorganization

---

## Current State Analysis

### System Count by Category

| Category           | System Count | Files with index.ts | Atoms | Services | Hooks | Test Dirs |
| ------------------ | ------------ | ------------------- | ----- | -------- | ----- | --------- |
| **Foundation**     | 0            | -                   | -     | -        | -     | 0         |
| **Capabilities**   | 0            | -                   | -     | -        | -     | 0         |
| **Features**       | 17           | ~17                 | 38    | 42       | 20    |
| **UI/Apps**        | 14           | ~14                 | 33    | 7        | 0     |
| **Interaction**    | 5            | ~5                  | 5     | 0        | 0     |
| **Data**           | 5            | ~5                  | 5     | 0        | 0     |
| **Domain Apps**    | 7            | ~7                  | 7     | 0        | 0     |
| **Infrastructure** | 12           | ~12                 | 12    | 0        | 2     |

### Versioned Systems (Parallel Dev)

| System           | Versions   | Status         | Recommendation                         |
| ---------------- | ---------- | -------------- | -------------------------------------- |
| **terminal**     | v1, v2, v3 | **v3 active**  | KEEP - Active development tracks       |
| **editor**       | v1, v2, v3 | **v3 active**  | KEEP - Most recent, active development |
| **slider**       | v1, v2     | **v2 active**  | KEEP - v2 is current stable version    |
| **data-manager** | v1, v2     | **v2 current** | KEEP - v2 is stable version            |
| **animation**    | v1, v2     | **v2 current** | KEEP - v2 is main version              |
| **minibuffer**   | v1, v2     | **v2 active**  | KEEP - Active development              |

**Assessment**: These are **intentional parallel development tracks**, NOT cruft. Deleting old versions would lose work-in-progress and git history.

### Cross-System Integration

**Analysis**: Searched for imports from `terminal/v3` → `editor/v3` pattern

- **Result**: **ZERO** instances found
- **Status**: ✅ **Excellent separation** - No circular dependencies, systems use capabilities correctly

**Analysis**: Commands consumed by minibuffer, hotkeys, overlays, screensaver, windows

- **Result**: **Multiple ownership points** - commands, minibuffer, overlays, windows all consume commands
- **Status**: ⚠️ **Ownership unclear** - Is commands a dependency, consumer, or shared resource?

### Well-Organized Systems (Templates)

| System              | Why It's Good                                          | Key Files          |
| ------------------- | ------------------------------------------------------ | ------------------ |
| **slider/v1**       | atoms/services/hooks/components clearly separated      | `index.ts:38`      |
| **hotkeys**         | Atom-first architecture documented                     | `index.ts:58`      |
| **data-manager/v1** | Materialized views + operations pattern                | `atoms/index.ts:2` |
| **editor/v3**       | Submodules + explicit adapters + comprehensive exports | `index.ts:488`     |
| **animation/v2**    | Clean structure with runtime/atoms/hooks               | `index.ts`         |
| **terminal/v3**     | Facade pattern with v3 as canonical                    | `README.md`        |

### Small Systems Requiring Review

| System           | File Count | Assessment             | Recommendation             |
| ---------------- | ---------- | ---------------------- | -------------------------- |
| **bfo**          | 2 files    | Block Field Operations | **REVIEW** before delete   |
| **axiom**        | 4 files    | Ontology system        | **REVIEW** before delete   |
| **charting/v1**  | 2 files    | Charting system        | **DELETE** - Likely unused |
| **canvas**       | 2 files    | Canvas system          | **REVIEW** before delete   |
| **fermion**      | 6 files    | Fermion pattern system | **REVIEW** before delete   |
| **blocks**       | 3 files    | Tldraw blocks          | **REVIEW** before delete   |
| **entity**       | 1 file     | Entity system          | **KEEP** - Foundation      |
| **file-browser** | 1 file     | File browser           | **DELETE** - Unused        |
| **file-index**   | 1 file     | File index             | **DELETE** - Unused        |

---

## Critical Issues Identified

### 1. Documentation Sprawl

**Finding**: ~100 markdown files scattered across `src/lib/*/` directories

**Examples**:

```
src/lib/ams/docs/              # 48 files (AMS architecture)
src/lib/holonet/docs/             # 50+ files (Holonet architecture)
src/lib/minibuffer/ARCHITECTURE.md  # Minibuffer architecture
src/lib/overlays/docs/EVENTLOG_TUTORIAL.md  # Overlays event log
src/lib/overlays/docs/EVENTLOG_INTEGRATION_PLAN.md
src/lib/editor-ai/reconciler/ARCHITECTURE.md # Editor AI reconciler
src/lib/overlays/docs/ARCHITECTURE.md       # Overlays architecture
src/lib/overlays/ARCHITECTURAL_FRAMING.md    # Overlays architecture
```

**Impact**: High - Confusion over where to find documentation, duplicate content, unclear versioning

### 2. Duplicate Documentation in src/lib

**Finding**: CLAUDE.\*.md files duplicated in system directories

```
src/lib/traits/CLAUDE.traits.md          # Duplicate of .edin/EFFECT_PATTERNS.md
src/lib/traits/AGENTS.traits.md          # Duplicate of .edin/EFFECT_SERVICE_PATTERNS.md
src/lib/commands/CLAUDE.commands.md       # Duplicate of .edin/COMMANDS.md
src/lib/commands/CLAUDE.commands.md       # Duplicate of .edin/COMMANDS.md
src/lib/data-manager/CLAUDE.data-manager.md  # Duplicate of .edin/EFFECT_PATTERNS.md
```

**Root Cause**: AGENTS.md (in `src/lib/`) was copied into system directories

**Recommendation**: Remove all CLAUDE.\*.md files, consolidate to `.edin/` or `.architecture/`

### 3. Test Directory Fragmentation

**Finding**: Every major system has `__tests__/` directory

```
src/lib/actors/__tests__/
src/lib/animation/v2/__tests__/
src/lib/buffer/__tests__/
src/lib/durable-streams/__tests__/
src/lib/kori/__tests__/
src/lib/fermion/__tests__/
src/lib/blocks/__tests__/
src/lib/ai-core/__tests__/
src/lib/ai/tools/__tests__/   # Empty!
src/lib/ams/v2/__tests__/        # Comprehensive
src/lib/ai/schemas/__tests__/    # Comprehensive
src/lib/ams/v2/core/__tests__/    # Core tests
src/lib/ai/v2/tms/queries/__tests__/  # Query tests
src/lib/ams/v2/base/repositories/__tests__/  # Repo tests
src/lib/ai/v2/base/services/__tests__/  # Service tests
src/lib/ai/v2/base/entities/__tests__/  # Entity tests
src/lib/ai/v2/base/handlers/__tests__/  # Handler tests
src/lib/ai/v2/base/events/__tests__/  # Event tests
src/lib/ams/v2/tms/__tests__/         # Integration tests
src/lib/ai/v2/tms/repositories/__tests__/  # Integration tests
src/lib/ai/v2/base/repositories/__tests__/  # Integration tests
src/lib/holonet/durable-streams/services/__tests__/     # Stream tests
src/lib/holonet/nats/__tests__/          # NATS tests
src/lib/holonet/durable-streams/events/__tests__/   # Event tests
src/lib/holonet/nats/__tests__/             # Integration tests
```

**Impact**: Medium - Well-distributed coverage, but scattered management

---

## Recommended Actions

### Phase 1: Safe Deletion (Week 1, Low Risk)

**Documentation Cleanup**:

```bash
# Remove duplicate CLAUDE files
rm src/lib/traits/CLAUDE.traits.md
rm src/lib/traits/CLAUDE.commands.md
rm src/lib/traits/AGENTS.traits.md
rm src/lib/commands/CLAUDE.commands.md
rm src/lib/data-manager/CLAUDE.data-manager.md

# Move valuable content to .architecture
mv src/lib/traits/CLAUDE.traits.md .architecture/
mv src/lib/traits/AGENTS.traits.md .architecture/
mv src/lib/commands/CLAUDE.commands.md .architecture/
mv src/lib/data-manager/CLAUDE.data-manager.md .architecture/
```

**Small System Cleanup** (requires review):

```bash
# DELETE unused systems (after Prime approval)
rm -rf src/lib/charting/v1      # Likely unused
rm -rf src/lib/canvas           # Likely unused
rm -rf src/lib/file-browser     # Likely unused
rm -rf src/lib/file-index       # Likely unused
rm -rf src/lib/entity           # 1 file, verify if needed

# KEEP but REVIEW small systems
# Review before delete: src/lib/bfo (2 files), src/lib/axiom (4 files), src/lib/fermion (6 files)
```

### Phase 2: Foundation Layer Creation (Week 2, Low Risk)

```bash
# Create foundation layer structure
mkdir -p src/lib/_core
mkdir -p src/lib/_core/schema
mkdir -p src/lib/_core/effect
mkdir -p src/lib/_core/runtime

# Move Effect primitives from scattered systems
# (Requires inventory of Effect helpers across systems)
```

### Phase 3: Tiered Migration (Week 3+, Medium Effort)

**Target: 5-10 keystone systems** per week

1. Move terminal v1/v2 → v3 (facade pattern)
2. Move editor v1/v2 → v3 (facade pattern)
3. Consolidate data-manager v1 → v2
4. Consolidate slider v1 → v2
5. Move remaining v1 systems to `features/` tier

**Expected Duration**: 4-6 weeks

### Phase 4: Cross-System Integration Rules (Week 4+, Ongoing)

1. **Define ownership**: Commands = capability, hotkeys = capability consumer
2. **Create wire modules**: Each capability has `wire/<target>.ts`
3. **Enforce direction**: Features import capabilities, never reverse
4. **Linter rules**: ESLint rule to ban `import from @/lib/(features|commands|hotkeys)/...`

---

## Success Criteria

### Organization Cleanup

- [ ] Duplicate CLAUDE files removed
- [ ] Documentation consolidated to `.architecture/`
- [ ] `.architecture/` directory structure established

### Version Consolidation

- [ ] 5 systems consolidated (terminal, editor, slider, data-manager, animation)
- [ ] Old versions marked as `@deprecated`
- [ ] v3 established as canonical version

### Cruft Deletion

- [ ] 3+ unused small systems deleted (with review)
- [ ] Empty test directories cleaned up
- [ ] System inventory created

### Boundary Enforcement

- [ ] Directional import rules defined
- [ ] Cross-system integration via wire modules
- [ ] Canonical system skeleton documented

---

## Documents Created

1. **[CRUFT_DELETION_PLAN.md](.architecture/CRUFT_DELETION_PLAN.md)** - This file: Cruft identification and deletion plan
2. **[SYSTEM_INVENTORY.md](.architecture/SYSTEM_INVENTORY.md)** - Complete catalog of all 71 systems
3. **[SUMMARY.md](.architecture/SUMMARY.md)** - This file: Analysis summary
4. **[INDEX.md](.architecture/INDEX.md)** - Master index (updated)
5. **[AGENTS.md](.architecture/AGENTS.md)** - Agent handoff guide

---

## Next Steps

### Immediate (Week 1)

1. Review small systems for deletion (bfo, axiom, charting, canvas, etc.)
2. Execute Phase 1 safe deletions (duplicate CLAUDE docs)
3. Create `_core/` structure and move Effect primitives
4. Establish `capabilities/` tier structure
5. Update `.architecture/INDEX.md` with Phase 1 completion

### Medium Term (Weeks 2-3)

1. Start tier migration (terminal, editor, etc.)
2. Create system inventory for tracking
3. Consolidate scattered system docs to `.architecture/`

### Long Term (Weeks 4+)

1. Complete full migration to tiered architecture
2. Enforce cross-system rules via linter
3. System inventory becomes single source of truth

---

## Notes for Prime

### What This Doesn't Cover

1. **Editor block integration** - MapBlock and DataGridBlock have direct imports to AVA/data-grid, no wire adapters

   - **Recommendation**: Create explicit `wire/ava-adapter.ts` and `wire/data-grid-adapter.ts`

2. **Commands ownership model** - Commands consumed by multiple systems, ownership unclear

   - **Recommendation**: Define commands as capability-owned service, consumed by wire adapters

3. **Test consolidation** - Test directories scattered across systems
   - **Recommendation**: Move to `testbed/` or consolidate per system

---

**Estimated Timeline**

- **Week 1**: Documentation cleanup + safe deletions + foundation setup
- **Week 2-3**: Tier migration of 10-15 systems
- **Week 4+**: Complete migration, enforcement, cleanup

---

_For implementation guidance, see: [CRUFT_DELETION_PLAN.md](.architecture/CRUFT_DELETION_PLAN.md)_
