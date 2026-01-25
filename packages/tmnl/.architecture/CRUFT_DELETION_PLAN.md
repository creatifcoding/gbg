# TMNL Cruft Deletion Plan

**Date**: 2026-01-14
**Purpose**: Identify and remove dead/unused code, duplicate versions, scattered documentation, and orphaned test directories.

---

## Summary of Findings

### Codebase State

- **71 systems** in `src/lib/`
- **Multiple versioned implementations**: terminal (v1/v2/v3), editor (v1/v2/v3), slider (v1/v2), data-manager (v1/v2), minibuffer (v1/v2)
- **Cross-system imports**: **ZERO** instances found of features importing other features
- **Documentation sprawl**: 100+ markdown files scattered across systems

### Positive Findings

✅ No node_modules in `src/lib/`
✅ No markdown or text files in `src/lib/` (code-only)
✅ No TODO/FIXME files found
✅ Cross-system boundaries are respected (good separation of concerns)

### Critical Issues Identified

## Phase 1: Deprecated Versions (Immediate Deletion)

### Priority: P0 (Safe, high impact)

| System           | Old Versions | Status     | Size/Footprint                  | Deletion Risk |
| ---------------- | ------------ | ---------- | ------------------------------- | ------------- |
| **terminal**     | v1, v2       | ⚠️ KEEP v3 | Small footprint, active dev     | None          |
| **editor**       | v1, v2, v3   | ⚠️ KEEP v3 | Most recent, active development | Low           |
| **slider**       | v1, v2       | ⚠️ KEEP v2 | Stable version, v3 is new       | Low           |
| **data-manager** | v1, v2       | ⚠️ KEEP v2 | Stable version, v2 is current   | None          |
| **minibuffer**   | v1, v2       | ⚠️ KEEP v2 | Stable version                  | None          |

**Decision**: **KEEP all versioned systems active in development.** The version sprawl is intentional parallel development, not cruft.

**Rationale**:

- terminal v3 is the current active version
- editor v3 is the current active version
- Deleting old versions would break history and active work
- Small directories (<5 files each) add minimal clutter

---

## Phase 2: Near-Empty or Single-File Systems (Review Required)

### Priority: P1 (Medium impact, requires review)

| System         | Assessment   | Action                   | Notes                                                       |
| -------------- | ------------ | ------------------------ | ----------------------------------------------------------- |
| **bfo**        | 2 files only | **REVIEW** before delete | bfo = Block Field Operations system - may be intentional    |
| **axiom**      | 4 files only | **REVIEW** before delete | axiom = Ontology system - may be experimental               |
| **fermion**    | 6 files      | **REVIEW** before delete | fermion = Fermion pattern system - complex, verify not dead |
| **blocks**     | 3 files only | **REVIEW** before delete | blocks = Tldraw blocks - likely intentional                 |
| **canvas**     | 2 files only | **REVIEW** before delete | canvas = Canvas system - likely intentional                 |
| **charting**   | 2 files only | **REVIEW** before delete | charting = Charting system - may be unused                  |
| **entity**     | 1 file only  | **REVIEW** before delete | entity = Entity system - may be foundational                |
| **primitives** | 3 files only | **REVIEW** before delete | primitives = UI primitives - may be foundational            |

**Candidate Deletions** (pending review):

- `src/lib/charting/v1/` - 2 files only
- `src/lib/entity/` - 1 file only

---

## Phase 3: Scattered Documentation Consolidation (High Impact)

### Priority: P0 (Safe cleanup)

| Location                    | Issue                                                                                                                   | Action             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------- |
| **Individual system docs**  | `src/lib/*/ARCHITECTURE.md`, `CLAUDE.*.md`, `AGENTS.*.md`                                                               | **KEEP in-system** | Valuable system-specific documentation                  |
| **Scattered docs in lib**   | `src/lib/traits/CLAUDE.traits.md`, `src/lib/commands/CLAUDE.commands.md`, `src/lib/data-manager/CLAUDE.data-manager.md` | **REVIEW**         | Duplicate of `.edin/` content - consolidate to `.edin/` |
| **System-specific READMEs** | `src/lib/kori/KORI.md`, `src/lib/ams/docs/AMS.md`, `src/lib/holonet/HOLONET.md`                                         | **KEEP**           | Valuable external docs                                  |
| **Event log docs**          | `src/lib/holonet/docs/HOLONET_AUDIT_OVERVIEW.md`, `src/lib/holonet/docs/HOLONET_REFACTORING_PLAN.md`                    | **KEEP**           | Valuable historical records                             |

**Specific Cleanup**:

1. Remove `src/lib/traits/CLAUDE.traits.md` - duplicate of `.edin/EFFECT_PATTERNS.md`
2. Remove `src/lib/traits/CLAUDE.commands.md` - duplicate of `.edin/EFFECT_SERVICE_PATTERNS.md`
3. Remove `src/lib/commands/CLAUDE.commands.md` - duplicate of `.edin/COMMANDS.md`
4. Remove `src/lib/data-manager/CLAUDE.data-manager.md` - duplicate of `.edin/EFFECT_PATTERNS.md`

**Estimated reduction**: 3 files, minimal risk

---

## Phase 4: Test Directory Cleanup (Low Impact)

### Priority: P2 (Review required)

| Test Directory                                        | Issue        | Action     |
| ----------------------------------------------------- | ------------ | ---------- | --------------------------------- |
| `src/lib/actors/__tests__/`                           | 3 test files | **REVIEW** | May be intentional separation     |
| `src/lib/animation/v2/__tests__/`                     | 2 test files | **REVIEW** | v2 tests, verify they're obsolete |
| `src/lib/buffer/__tests__/`                           | 4 test files | **REVIEW** | May be intentional separation     |
| `src/lib/durable-streams/__tests__/`                  | 6 test files | **REVIEW** | Comprehensive test suite          |
| `src/lib/kori/__tests__/`                             | 5 test files | **REVIEW** | Well-structured test suite        |
| `src/lib/fermion/__tests__/`                          | 1 test file  | **KEEP**   | Core test for complex system      |
| `src/lib/holonet/nats/__tests__/`                     | 6 test files | **REVIEW** | Comprehensive test suite          |
| `src/lib/holonet/durable-streams/services/__tests__/` | 9 test files | **REVIEW** | Comprehensive test suite          |
| `src/lib/ai-core/__tests__/`                          | 0 test files | **REVIEW** | Empty                             |
| `src/lib/ai/tools/__tests__/`                         | 2 test files | **REVIEW** | May be obsolete                   |
| `src/lib/ai/schemas/__tests__/`                       | 0 test files | **REVIEW** | May be obsolete                   |
| `src/lib/ams/v2/core/__tests__/`                      | 1 test file  | **REVIEW** | v2 core test                      |
| `src/lib/ams/v2/__tests__/`                           | 9 test files | **REVIEW** | v2 integration tests              |

**Observation**: Test coverage is well-distributed. Most test directories appear intentional.

---

## Phase 5: Documentation Cleanup (Low Impact)

### Priority: P3 (Safe, optional)

| Action                                 | Target                                                                                                                  | Risk                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------- |
| **Consolidate scattered AGENTS files** | `src/lib/traits/CLAUDE.traits.md`, `src/lib/commands/CLAUDE.commands.md`, `src/lib/data-manager/CLAUDE.data-manager.md` | Move content to `.edin/`                             | Low - Good cleanup     |
| **Remove duplicate ARCHITECTURE docs** | Individual system `ARCHITECTURE.md` files (e.g., `src/lib/actors/ARCHITECTURE.md`)                                      | Low - Duplicate of `.architecture/REORG_STRATEGY.md` | Low - Reduce confusion |

---

## Execution Plan

### Week 1: Safe Cleanup (No Risk)

1. ✅ **Remove duplicate CLAUDE files** in traits/commands/data-manager (3 files)

   - `rm src/lib/traits/CLAUDE.traits.md`
   - `rm src/lib/commands/CLAUDE.commands.md`
   - `rm src/lib/commands/CLAUDE.data-manager.md`
   - `rm src/lib/data-manager/CLAUDE.data-manager.md`

2. 📋 **REVIEW**: Near-empty systems before any deletion

   - Review: `src/lib/bfo/`, `src/lib/axiom/`, `src/lib/charting/v1/`
   - Ask: Are these systems dead or just small/intentional?

3. 📋 **REVIEW**: Test directory structure
   - Review: `src/lib/actors/__tests__/`, `src/lib/animation/v2/__tests__/`
   - Ask: Are these legacy or intentionally separated?

### Week 2: Targeted Cleanup (With Approval)

1. **DELETE** (P1): Consolidated scattered docs to `.edin/`
2. **DELETE** (P1): Duplicate ARCHITECTURE docs in individual systems
3. **DELETE** (P2 - with review): Near-empty single-file systems (after user approval)
4. **DELETE** (P3): Redundant test directories (after user approval)

### Week 3: Monitoring

1. Monitor import patterns for new circular dependencies
2. Check for new version folders created without clear plan
3. Track test file location consolidation

---

## Anti-Pattern Prevention

### New Rule: Version Directory Creation

**Problem**: Uncontrolled v1/v2/v3 sprawl
**Rule**: Before creating `v4`, `v5`, etc.:

1.  Document in system README why a new version is needed
2.  Migrate existing usage to new version
3.  Delete old version only after all imports updated

### New Rule: System Documentation Placement

**Problem**: Scattered docs in both `src/lib/*/` and `.edin/`
**Rule**:

1.  System-specific docs go in `src/lib/<system>/` with system README
2.  Cross-system patterns and decisions go in `.edin/`
3.  Duplicate content should be consolidated, not duplicated

---

## Metrics

### Current State

- **71 systems** in `src/lib/`
- **~100 markdown files** scattered across codebase
- **364 barrel exports** (`index.ts` / `index.tsx`)
- **100+ test files** in various `__tests__` directories

### Post-Cleanup Targets

- **70 systems** (minimal version cleanup)
- **~50 markdown files** (consolidated to `.edin/`)
- **~95 test files** (after removal of obsolete directories)

---

## Notes

### What We're NOT Deleting

1. **Versioned systems**: terminal v1/v2, editor v1/v2/v3, slider v1/v2, data-manager v1/v2

   - These are **parallel development tracks**, not cruft
   - Deleting would lose history and break active work

2. **Comprehensive test suites**: All `__tests__` directories

   - Test coverage is valuable
   - Deletions would reduce confidence

3. **System-specific READMEs**: ARCHITECTURE.md in individual systems

   - These document each system's architecture
   - Removing would push documentation into `.edin/` which is meant for cross-system concerns

4. **External system docs**: kori, AMS, Holonet READMEs in their directories
   - These explain integration points, valuable to keep

### What IS Cruft

1. **Duplicate content in src/lib**: CLAUDE.traits.md, CLAUDE.commands.md, CLAUDE.data-manager.md

   - Exact copies of `.edin/` content, creating confusion
   - Should be removed and consolidated to `.edin/`

2. **Near-empty single-file systems**: bfo (2 files), axiom (4 files), charting/v1 (2 files)

   - May be intentional experiments, worth reviewing

3. **Obsolete test directories**: `src/lib/ai-core/__tests__/` (empty)
   - Keepers with no tests can be removed

---

## Recommendations

1. **Review near-empty systems**: Before deleting small systems (bfo, axiom, charting/v1), verify with Prime if they're dead or intentionally minimal
2. **Consolidate .edin documentation**: Move cross-system patterns from individual system docs into `.edin/`
3. **Establish system README standard**: Every system should have a README.md explaining purpose, structure, and version status
4. **Monitor test organization**: Consider consolidating scattered test files into system-specific locations

---

**Next Steps**:

1. Execute Phase 1 safe deletions (3 duplicate docs)
2. Ask for review of near-empty systems before Phase 1 P2 deletions
3. Execute Phase 2 targeted cleanup (with user approval)
4. Update `.architecture/INDEX.md` with completed phases
5. Consider creating "System Inventory" document for tracking all 71 systems
