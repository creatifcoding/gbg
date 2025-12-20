# BDD Skills Overview

Three extensible Claude Code skills for Behavior-Driven Development patterns in TMNL.

## Skills Created

### 1. bdd-specification-patterns
**Location:** `.claude/skills/bdd-specification-patterns/SKILL.md`  
**Lines:** 616  
**Triggers:** `write.*bdd`, `gherkin`, `given.*when.*then`, `feature.*scenario`, `specification`

**Core Patterns:**
- Scenario Structure (Given/When/Then)
- TMNL Hypothesis-Driven Scenarios (H1/H2/H3)
- Data Tables (Parameterized Tests)
- Scenario Outlines (Cross-Product Testing)
- Background (Shared Setup)
- Tagging Scenarios (@smoke, @integration, @hypothesis)
- Mapping Specifications to Effect Services
- Acceptance Criteria Mapping

**Key Doctrine:**
> Specifications ARE the requirements, not documentation of code. If you cannot express a requirement as a concrete scenario, you do not understand it well enough to implement it.

---

### 2. bdd-test-implementation
**Location:** `.claude/skills/bdd-test-implementation/SKILL.md`  
**Lines:** 798  
**Triggers:** `implement.*bdd`, `step definition`, `it.effect`, `@effect/vitest`, `test.*effect`

**Core Patterns:**
- @effect/vitest Setup (`it.effect()` API)
- Effect Service Step Definitions
- Effect.either for Error Assertions
- Shared Test Fixtures (Effect.gen factories)
- Data Table Scenarios (forEach + it.effect)
- Effect-Atom State Assertions
- Effect.Scope for Resource Management
- Stream Assertions (Progressive Data Flow)
- Multi-Service Integration Tests
- Hypothesis-Driven Implementation

**Key Doctrine:**
> If your step definition contains complex logic, the specification is wrong. Fix the spec first. Step definitions translate Given/When/Then into Effect.gen programs - nothing more.

---

### 3. bdd-hypothesis-validation
**Location:** `.claude/skills/bdd-hypothesis-validation/SKILL.md`  
**Lines:** 952  
**Triggers:** `hypothesis`, `H1.*H2.*H3`, `validation.*hypothesis`, `testbed.*hypothesis`, `damage report`

**Core Patterns:**
- Hypothesis Declaration (H1-H5 naming)
- Hypothesis Validation (Acceptance Criteria)
- Progressive Validation (Stream metrics)
- Real-Time Metrics (Throughput calculation)
- Driver Switching (State isolation)
- Damage Reports (Antipattern discovery)
- Hypothesis UI Components (Badge, Card, Section)
- EDIN Integration (Experiment → Design)
- Multi-Hypothesis Testbeds (Grid layout)

**Key Doctrine:**
> A hypothesis without concrete acceptance criteria is not a hypothesis. It's a hope. Verify outcomes (gridData.length > 0), not function calls (setGridData was invoked).

---

## Canonical Sources Referenced

All three skills draw from:

**Effect Testing Patterns:**
- `submodules/effect/packages/*/test/*.test.ts` - Canonical Effect patterns
- `submodules/effect-atom/packages/atom/test/*.test.ts` - Atom testing
- `src/lib/streams/__tests__/ChannelService.test.ts` - Effect.Service lifecycle
- `src/lib/ams/v2/__tests__/integration.test.ts` - Multi-service composition

**TMNL Testbed Patterns:**
- `src/components/testbed/DataManagerTestbed.tsx` - H1-H5 hypothesis validation
- `src/components/testbed/shared/hypothesis.tsx` - Validation UI components
- `src/components/testbed/EffectAtomTestbed.tsx` - Damage report pattern

**EDIN Methodology:**
- `CLAUDE.md` — EDIN phases (Experiment, Design, Implement, Negotiate)
- `.edin/EFFECT_PATTERNS.md` — Effect-atom state patterns
- `.agents/index.md` — Session journal with hypothesis tracking

---

## Usage Examples

### Invoke Specification Patterns

```
Write BDD specifications for the search service integration.
```

Claude Code will use `bdd-specification-patterns` to generate Gherkin-style scenarios with Given/When/Then structure.

### Invoke Test Implementation

```
Implement BDD step definitions for the ChannelService lifecycle tests using it.effect().
```

Claude Code will use `bdd-test-implementation` to create Effect.gen-based test implementations.

### Invoke Hypothesis Validation

```
Create hypothesis tracking for the DataManager testbed with H1-H5 validation.
```

Claude Code will use `bdd-hypothesis-validation` to set up hypothesis declarations, validation hooks, and damage reports.

---

## Philosophy: BDD as Design Discipline

These skills embody a **fanatical** approach to BDD:

1. **Specifications precede implementation** - Write `.feature` files BEFORE code
2. **Specifications are executable** - They run as tests via step definitions
3. **Specifications are living requirements** - Update them as the system evolves
4. **Specifications reveal architecture** - Service boundaries emerge from scenarios

### TMNL-Specific Adaptations

- **Hypothesis-driven scenarios** - Map to testbed validation (H1, H2, H3...)
- **Effect.gen step definitions** - Use `it.effect()` for Effect-based assertions
- **Atom state verification** - Assert on atom values, not implementation details
- **Evidence tracking** - Include concrete metrics in hypothesis updates
- **Damage reports** - Document antipatterns discovered during validation

---

## Anti-Patterns Covered

All three skills explicitly document anti-patterns to avoid:

**Specification Anti-Patterns:**
- Vague specifications ("Search works")
- Implementation details in specs ("FlexSearch driver.search()")
- Testing framework leakage ("expect(results).toHaveLength(10)")
- Hypothesis tracking without verification ("setGridData was called")

**Implementation Anti-Patterns:**
- Mocking Effect services (defeats dependency injection)
- Mixing Effect.runPromise in it.effect() (breaks composition)
- Testing implementation details (internal state, not behavior)
- Tracking function calls instead of outcomes

**Hypothesis Anti-Patterns:**
- Vague hypotheses ("Search works correctly")
- Missing evidence strings
- Tracking function calls instead of outcomes
- Hypothesis without acceptance criteria

---

## Extensibility

These skills are designed to be **extended** as TMNL evolves:

### Adding New Patterns

Edit the relevant `SKILL.md` file to add new patterns:

```markdown
## Pattern N: New Pattern Name

### When to Use

- Use case 1
- Use case 2

### Example

\`\`\`typescript
// Code example
\`\`\`

### TMNL-Specific Notes

- Adaptation for TMNL
```

### Adding New Canonical Sources

Add references to new testbed files:

```markdown
**New Testbed:**
- `src/components/testbed/NewTestbed.tsx` - Description of patterns
```

### Adding New Anti-Patterns

Document in the Anti-Patterns section:

```markdown
### ❌ New Anti-Pattern

\`\`\`typescript
// BAD
// ...

// GOOD
// ...
\`\`\`
```

---

## Integration with EDIN

BDD skills align with EDIN phases:

1. **Experiment** - Use `bdd-hypothesis-validation` to define H1-H5 hypotheses
2. **Design** - Use `bdd-specification-patterns` to write acceptance criteria
3. **Implement** - Use `bdd-test-implementation` to create step definitions
4. **Negotiate** - Review damage reports, update patterns, reallocate resources

---

## File Statistics

| Skill                       | Lines | Patterns | Anti-Patterns | Examples |
|-----------------------------|-------|----------|---------------|----------|
| bdd-specification-patterns  | 616   | 8        | 4             | 20+      |
| bdd-test-implementation     | 798   | 12       | 3             | 25+      |
| bdd-hypothesis-validation   | 952   | 10       | 4             | 30+      |
| **TOTAL**                   | 2366  | 30       | 11            | 75+      |

---

## Next Steps

1. **Test the skills** - Invoke them via Claude Code to validate patterns
2. **Extend with new patterns** - Add patterns as TMNL testbeds evolve
3. **Cross-reference** - Link to `.edin/EFFECT_TESTING_PATTERNS.md` for deeper Effect patterns
4. **Update CLAUDE.md** - Document skill usage in project instructions

---

**Created:** 2025-12-20  
**Author:** Val (Prime's architectural conscience)  
**Purpose:** Fanatical BDD discipline for TMNL
