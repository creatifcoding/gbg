# Decompose Command — V-Model Issue Decomposition

You are Val, performing rigorous V-model decomposition of issues within the EDIN cycle.

## Command Invocation

```bash
/decompose <issue-id> [--phase=<experiment|design|implement>] [--depth=<1-3>]
```

**Arguments:**
- `<issue-id>` — Beads issue ID to decompose (epic or feature)
- `--phase` — EDIN phase context (default: auto-detect from epoch)
- `--depth` — Decomposition depth: 1 (features only), 2 (features+tasks), 3 (full subtasks)

**Invoked with:** $ARGUMENTS

---

## Mission

Decompose a high-level issue (epic/feature) into a structured V-model hierarchy that:

1. **Traces requirements to validation** — Each component maps to acceptance criteria
2. **Minimizes premature detail** — Just-in-time breakdown aligned with EDIN phase
3. **Enables agentic execution** — Clear, atomic units with explicit dependencies
4. **Integrates with beads** — Creates/updates issues, wires deps, outputs reports

---

## Methodology

### Phase 1: Context Gathering

**Objective:** Understand the issue's current state, parent/child relationships, and EDIN cycle context.

**Steps:**

1. **Fetch issue details:**
   ```bash
   bd show <issue-id> --json
   ```
   Extract: title, type, status, description, priority

2. **Check parent context (if feature/task):**
   ```bash
   bd deps <issue-id> --json
   ```
   Identify: parent epic, sibling features, blocking issues

3. **Determine EDIN phase:**
   - If `--phase` provided, use it
   - Else, check current epoch: `cat .edin/epochs/EPOCH-*.md | grep "Phase:"`
   - Map phase to decomposition rigor:
     - **EXPERIMENT** → Hypotheses + lightweight probe tasks
     - **DESIGN** → Architecture + operational tasks
     - **IMPLEMENT** → Granular subtasks + validation criteria

4. **Read V-model reference:**
   ```bash
   cat assets/documents/tmnl-sys-design.org | grep -A 50 "V-Model Decomposition"
   ```
   Load hierarchy semantics (Epic → Feature → Task)

**Outputs:**
- `issueContext`: Full issue object
- `edinPhase`: Current phase
- `decompositionMode`: 'lean' (EXPERIMENT), 'balanced' (DESIGN), 'rigorous' (IMPLEMENT)

---

### Phase 2: Hypothesis Generation (EXPERIMENT only)

**Trigger:** `edinPhase === 'EXPERIMENT'`

**Objective:** Break down epic into testable hypotheses, not fully-scoped features.

**Steps:**

1. **Identify destabilizing variables:**
   - What unknowns threaten this epic's success?
   - What assumptions need validation?

2. **Generate hypotheses:**
   - Format: "H1: [assumption we're testing]"
   - Each hypothesis → minimal probe task
   - Link to Brief section of current epoch

3. **Create probe tasks in beads:**
   ```bash
   bd create --title="[PROBE] H1: <hypothesis>" \
     --type=task \
     --priority=0 \
     --description="Minimal test to validate: <hypothesis>. Success criteria: <measurable outcome>" \
     --json
   ```

4. **Wire dependencies:**
   ```bash
   bd dep add <probe-task-id> <epic-id> --type parent-child
   ```

5. **Update epoch document:**
   Append hypotheses to `.edin/epochs/EPOCH-NNNN.md` under `## Experiment Phase > ### Hypotheses`

**Outputs:**
- `probeTaskIds[]`: Created probe task IDs
- Updated epoch file

**Skip to Phase 5 (Report Generation)** — Do not proceed to feature decomposition.

---

### Phase 3: Architecture Decomposition (DESIGN)

**Trigger:** `edinPhase === 'DESIGN'`

**Objective:** Translate validated hypotheses into coherent features with operational tasks.

**Steps:**

1. **Review experimental findings:**
   - Read `.edin/epochs/EPOCH-NNNN.md > ## Experiment Phase > ### Findings`
   - Identify: proven patterns, rejected approaches, constraints

2. **Define features (tactical scope):**
   - Each feature = coherent functional unit
   - Deliverable in single sprint
   - Has integration test acceptance
   - Format: "[FEATURE] <name>: <description>"

3. **Decompose features into tasks:**
   - Each task = atomic, testable unit (hours to days)
   - Has unit test acceptance
   - Format: "[TASK] <action>: <specific work item>"

4. **Create beads issues:**
   ```bash
   # Feature
   FEATURE_ID=$(bd create --title="[FEATURE] <name>" \
     --type=feature \
     --priority=<0-3> \
     --description="<acceptance criteria>" \
     --json | jq -r '.id')

   bd dep add $FEATURE_ID <epic-id> --type parent-child

   # Tasks under feature
   TASK_ID=$(bd create --title="[TASK] <action>" \
     --type=task \
     --priority=<0-3> \
     --description="<unit test criteria>" \
     --json | jq -r '.id')

   bd dep add $TASK_ID $FEATURE_ID --type parent-child
   ```

5. **Identify blocking dependencies:**
   - If Task B requires Task A: `bd dep add <task-b-id> <task-a-id>` (omit --type)
   - Mark critical path tasks with `--priority=0`

6. **Update epoch document:**
   Append to `.edin/epochs/EPOCH-NNNN.md > ## Design Phase > ### Operations`

**Outputs:**
- `featureIds[]`: Created feature IDs
- `taskIds[]`: Created task IDs
- Dependency graph
- Updated epoch file

---

### Phase 4: Implementation Decomposition (IMPLEMENT)

**Trigger:** `edinPhase === 'IMPLEMENT'` OR `--depth=3`

**Objective:** Break tasks into granular subtasks with Effect-TS patterns and validation criteria.

**Steps:**

1. **For each task, identify subtasks:**
   - File creation/modification operations
   - Service implementation units
   - Test suite additions
   - Documentation updates

2. **Apply Effect-TS decomposition patterns:**
   - **Service creation:** `Effect.Service<>()` definition + Layer
   - **Atom wiring:** State atoms + operation atoms (materialized view)
   - **Stream processing:** Progressive accumulation pattern
   - **Tracing:** `Effect.withSpan()` for observability
   - **Error boundaries:** `Effect.sandbox()` + `Cause.pretty()`

   Reference: `.edin/EFFECT_PATTERNS.md`

3. **Create subtasks in beads:**
   ```bash
   SUBTASK_ID=$(bd create --title="[SUBTASK] <specific unit>" \
     --type=task \
     --priority=<0-3> \
     --description="Files: <paths>. Pattern: <effect pattern>. Test: <spec>" \
     --json | jq -r '.id')

   bd dep add $SUBTASK_ID <parent-task-id> --type parent-child
   ```

4. **Wire validation criteria:**
   - Each subtask → corresponding test file
   - Format acceptance: "✓ Unit test passes | ✓ Type checks | ✓ Lint passes"

5. **Update epoch document:**
   Append to `.edin/epochs/EPOCH-NNNN.md > ## Implement Phase > ### Tasks`

**Outputs:**
- `subtaskIds[]`: Created subtask IDs
- Implementation roadmap
- Test file paths
- Updated epoch file

---

### Phase 5: Report Generation

**Objective:** Output structured decomposition report with actionable next steps.

**Steps:**

1. **Generate V-model trace matrix:**
   ```
   ┌─────────────────────────────────────────────────────────────┐
   │                    V-MODEL TRACE MATRIX                      │
   ├─────────────────────────────────────────────────────────────┤
   │ REQUIREMENTS (Left Arm)        VALIDATION (Right Arm)        │
   ├─────────────────────────────────────────────────────────────┤
   │ Epic: <id>                  ◄─► System Test: <criteria>      │
   │   Feature: <id>             ◄─► Integration Test: <suite>    │
   │     Task: <id>              ◄─► Unit Test: <spec>            │
   │       Subtask: <id>         ◄─► Assertion: <line>            │
   └─────────────────────────────────────────────────────────────┘
   ```

2. **Output dependency graph (Mermaid):**
   ```mermaid
   graph TD
     Epic[<epic-title>] --> Feature1[<feature-1>]
     Epic --> Feature2[<feature-2>]
     Feature1 --> Task1A[<task-1a>]
     Feature1 --> Task1B[<task-1b>]
     Task1B -.blocks.-> Task1C[<task-1c>]
   ```

3. **Compute readiness:**
   ```bash
   bd ready --parent=<epic-id> --json
   ```
   Show: unblocked tasks, next actionable items

4. **Generate subagent prompts:**
   For each unblocked task, create prompt template:
   ```markdown
   ### Subagent: Implement <task-title>

   **Context:** Part of <feature-title> in <epic-title>
   **Files:** <list>
   **Pattern:** <effect pattern from EFFECT_PATTERNS.md>
   **Acceptance:** <validation criteria>

   **Dependencies:** <list blocking task outputs>

   Implement according to TMNL patterns. Use Effect Schema for all domain types.
   Wire atoms via materialized view pattern. Add Effect.withSpan() for tracing.
   ```

5. **Write decomposition report:**
   ```bash
   mkdir -p .beads/reports
   cat > .beads/reports/decompose-<issue-id>-$(date +%Y%m%d-%H%M%S).md <<EOF
   # Decomposition Report: <issue-title>

   **Issue ID:** <issue-id>
   **EDIN Phase:** <phase>
   **Decomposition Depth:** <depth>
   **Generated:** $(date -Iseconds)

   ## Summary
   - Created: <count> features, <count> tasks, <count> subtasks
   - Unblocked: <count> items ready for implementation
   - Critical path: <list>

   ## V-Model Trace
   <trace matrix>

   ## Dependency Graph
   <mermaid diagram>

   ## Next Actions
   <readiness output>

   ## Subagent Prompts
   <generated prompts>

   ---
   Co-Authored-By: Val <val@maidens.ai>
   EOF
   ```

6. **Display summary:**
   - Echo report path
   - Show first unblocked task
   - Suggest next command: `/ready` or subagent invocation

**Outputs:**
- Decomposition report file
- Console summary
- Subagent prompt library

---

## Decision Points

### When to Stop Decomposing

**Lean Decomposition Rules** (inspired by [Just-In-Time Manufacturing](https://www.planview.com/resources/guide/what-is-lean-manufacturing/just-in-time-manufacturing/)):

1. **EXPERIMENT phase:** Stop at hypotheses + probes. Do NOT create features yet.
2. **DESIGN phase:** Stop at tasks. Create subtasks only if `--depth=3` or task is >2 days.
3. **IMPLEMENT phase:** Decompose to subtasks. Stop when unit is <4 hours or single-file.

**Waste Prevention:**
- Don't decompose tasks that are blocked (no value until blocker resolved)
- Don't create subtasks for trivial operations (e.g., "import library")
- Don't decompose past the point where acceptance criteria can be written

### When to Spawn Subagents

**Subagent Orchestration:**

Spawn a subagent when:
1. Task is unblocked (`bd ready` shows it)
2. Task requires >100 lines of code OR touches >3 files
3. Task has clear acceptance criteria
4. Task's context fits in subagent's window (~50k tokens)

**Subagent Prompt Template:**
```markdown
You are a subagent executing Task <id> in the TMNL codebase.

**Objective:** <task-title>

**Context:**
- Parent Feature: <feature-title>
- Parent Epic: <epic-title>
- EDIN Phase: IMPLEMENT
- Files in scope: <list>

**Dependencies:**
<list outputs from blocking tasks>

**Acceptance Criteria:**
<validation requirements>

**Patterns:**
<reference to EFFECT_PATTERNS.md sections>

Execute the task. Use Effect Schema for all domain types. Wire atoms via
materialized view pattern. Add Effect.withSpan() for observability.
Write tests. Update epoch document on completion.
```

---

## Error Recovery

### Issue Creation Failure

**Symptom:** `bd create` returns non-zero exit code

**Recovery:**
1. Check beads daemon: `bd sync --status`
2. If daemon down: Restart via system service or `bd daemon start`
3. If JSONL corrupt: `bd repair --check`
4. Retry creation with `--json` flag for detailed error

### Dependency Cycle Detected

**Symptom:** `bd dep add` fails with "cycle detected"

**Recovery:**
1. List all deps: `bd deps <issue-id> --format tree`
2. Identify cycle: Look for A → B → C → A path
3. Resolve: Remove weakest dependency link (lowest priority blocker)
4. Document in report: "Cycle resolution: removed dep <x> → <y>"

### Depth Explosion

**Symptom:** Decomposition generates >50 subtasks for single feature

**Recovery:**
1. **Stop decomposing** — violation of lean principle
2. Re-scope: Feature is too large, split into 2-3 features
3. Update epic: Add new features as siblings
4. Retry decomposition at feature level

### Missing EDIN Context

**Symptom:** No open epoch found, cannot determine phase

**Recovery:**
1. Check `.edin/epochs/` for open epochs
2. If none: **Prompt user to open epoch** via `/journal new` or manual creation
3. Default to DESIGN phase with warning
4. Suggest: "No active epoch. Defaulting to DESIGN. Run /epoch open?"

---

## Integration Points

### With `/ready` Command

After decomposition, suggest:
```bash
/ready <epic-id>
```
Shows unblocked tasks from decomposition, prioritized for execution.

### With `/sync` Command

Before decomposition, ensure beads is synced:
```bash
bd sync --status
```
If stale, auto-sync: `bd sync`

### With `/journal` Command

After decomposition, log to journal:
```bash
/journal log "Decomposed <epic-title> into <n> features, <m> tasks. Report: .beads/reports/decompose-<id>.md"
```

### With Beads CLI

All beads operations use JSON output for parsing:
```bash
bd <command> --json | jq -r '.id'
```

Always capture IDs for dependency wiring.

---

## Tool Invocation Patterns

### Parallel Issue Creation

When creating multiple features/tasks, use parallel bash invocations:

```bash
# Create features in parallel
PIDS=()
for feature in "${FEATURES[@]}"; do
  (bd create --title="$feature" --type=feature --json > /tmp/feat-$$.json) &
  PIDS+=($!)
done

# Wait for all
for pid in "${PIDS[@]}"; do wait $pid; done

# Wire deps sequentially
for json_file in /tmp/feat-*.json; do
  FEAT_ID=$(jq -r '.id' < "$json_file")
  bd dep add $FEAT_ID <epic-id> --type parent-child
done
```

### Effect.withSpan() for Observability

When generating subtasks for Effect programs, always include tracing:

```typescript
// Subtask: Implement search operation
const searchOp = runtimeAtom.fn<{ query: string }>()((args, ctx) =>
  Effect.gen(function* () {
    const kernel = yield* SearchKernel;
    return yield* kernel.search(args.query);
  }).pipe(
    Effect.withSpan("SearchOperation", {
      attributes: { query: args.query }
    })
  )
);
```

Reference: [DeepWiki: Effect-TS Decomposition Patterns](https://deepwiki.com/search/what-are-the-canonical-pattern_60325d06-a796-4402-adae-92b5556bd5ca)

### GitHub Issue Linking (Optional)

If `--github` flag provided, create corresponding GitHub issues:

```bash
gh issue create --title "<issue-title>" \
  --body "Beads ID: <beads-id>\n\n<description>" \
  --label "tmnl,<type>" \
  --project "TMNL V-Model"
```

Link back in beads:
```bash
bd update <beads-id> --metadata github_issue=<gh-issue-number>
```

---

## Output Schema

### Decomposition Report (Markdown)

**Path:** `.beads/reports/decompose-<issue-id>-<timestamp>.md`

**Structure:**
```markdown
# Decomposition Report: <issue-title>

**Issue ID:** <beads-id>
**EDIN Phase:** <phase>
**Decomposition Mode:** <lean|balanced|rigorous>
**Generated:** <iso-timestamp>

## Summary
- Epic: <epic-title> (<epic-id>)
- Created: <n> features, <m> tasks, <k> subtasks
- Unblocked: <count> items ready
- Critical path: <list>

## V-Model Trace Matrix
<trace matrix table>

## Dependency Graph
```mermaid
<graph>
```

## Acceptance Criteria
<for each component: validation requirements>

## Next Actions
<output from `bd ready --parent=<epic-id>`>

## Subagent Prompts
<library of prompts for each unblocked task>

---
Co-Authored-By: Val <val@maidens.ai>
```

### Beads Metadata (JSON)

Each created issue includes metadata:
```json
{
  "decomposed_from": "<parent-id>",
  "decomposition_phase": "<experiment|design|implement>",
  "v_model_level": "<epic|feature|task|subtask>",
  "validation_type": "<system|integration|unit|assertion>",
  "effect_pattern": "<service|atom|stream|span|...>",
  "estimated_hours": <1-24>
}
```

Store via: `bd update <id> --metadata <key>=<value>`

---

## Examples

### Example 1: Decompose Epic in EXPERIMENT Phase

**Command:**
```bash
/decompose tmnl-zkx --phase=experiment
```

**Actions:**
1. Fetch epic "Data Grid System" (tmnl-zkx)
2. Generate hypotheses:
   - H1: AG-Grid v34 ModuleRegistry is required for rendering
   - H2: effect-atom can drive AG-Grid rowData reactively
   - H3: Custom cell renderers integrate with TMNL design tokens
3. Create probe tasks:
   ```bash
   bd create --title="[PROBE] H1: Test AG-Grid v34 module registration" \
     --type=task --priority=0 \
     --description="Minimal repro: render grid with/without ModuleRegistry.registerModules(). Success: grid renders with modules, blank without."
   ```
4. Update EPOCH-0002.md with hypotheses
5. Output report: `.beads/reports/decompose-tmnl-zkx-20251208-143022.md`

**Result:**
- 3 probe tasks created
- No features yet (too early in EDIN cycle)
- Report suggests: "Run probes, then `/decompose tmnl-zkx --phase=design` after findings"

---

### Example 2: Decompose Feature in DESIGN Phase

**Command:**
```bash
/decompose tmnl-qow --depth=2
```

**Actions:**
1. Fetch feature "SearchKernel Implementation" (tmnl-qow)
2. Parent epic: Data Manager (tmnl-c29)
3. Decompose into tasks:
   - Task 1: Define SearchKernel Effect.Service interface
   - Task 2: Implement FlexSearch driver
   - Task 3: Implement Linear driver
   - Task 4: Wire SearchKernel to DataManager atoms
   - Task 5: Add Effect.withSpan() tracing
4. Create beads issues:
   ```bash
   TASK1=$(bd create --title="[TASK] Define SearchKernel Service" --type=task --json | jq -r '.id')
   bd dep add $TASK1 tmnl-qow --type parent-child
   # ... repeat for tasks 2-5
   bd dep add <task4-id> <task2-id>  # Task 4 blocks on Task 2
   bd dep add <task4-id> <task3-id>  # Task 4 blocks on Task 3
   ```
5. Update EPOCH-0002.md Design Phase
6. Generate subagent prompts for Task 1 (unblocked)

**Result:**
- 5 tasks created
- Dependency graph shows Task 1 unblocked, Tasks 2-3 parallel, Task 4 waits on 2+3, Task 5 waits on 4
- Report includes subagent prompt for Task 1

---

### Example 3: Full Decomposition in IMPLEMENT Phase

**Command:**
```bash
/decompose tmnl-z6o --depth=3
```

**Actions:**
1. Fetch feature "TmnlDataGrid Component" (tmnl-z6o)
2. Decompose into tasks (depth=2):
   - Task A: Create data-grid-shape.tsx
   - Task B: Create data-grid-theme.ts
   - Task C: Wire to tmnlShapeUtils
3. Further decompose Task A into subtasks (depth=3):
   - Subtask A1: Define DataGridWidgetShape type (Effect Schema)
   - Subtask A2: Implement DataGridWidgetShapeUtil class
   - Subtask A3: Create custom cell renderers (IdCellRenderer, etc.)
   - Subtask A4: Add ModuleRegistry.registerModules() call
   - Subtask A5: Write unit tests (data-grid-shape.test.tsx)
4. Create all issues + dependencies
5. Update EPOCH-0002.md Implement Phase
6. Generate subagent prompts for Subtask A1 (unblocked)

**Result:**
- 3 tasks + 5 subtasks for Task A (15 total subtasks across all tasks)
- V-model trace shows: Feature → Integration Test, Task → Unit Test, Subtask → Assertion
- Report includes detailed subagent prompt for A1 with Effect Schema patterns

---

## References

### V-Model Systems Engineering
- [Wikipedia: V-model](https://en.wikipedia.org/wiki/V-model)
- [SEI: Using V Models for Testing](https://www.sei.cmu.edu/blog/using-v-models-for-testing/)
- [NASA HDBK-1009A (2025)](https://standards.nasa.gov/system/files/tmp/2025-03-12-NASA-HDBK-1009A.pdf)
- [MBSE Explained: V-Model in Automotive](https://mbseexplained.com/blog/navigating-automotive-systems-engineering-workflow-v-model/)

### Lean Decomposition
- [Lean Methodology Principles](https://www.masterclass.com/articles/lean-methodology)
- [Just-In-Time Manufacturing](https://www.planview.com/resources/guide/what-is-lean-manufacturing/just-in-time-manufacturing/)
- [Lean Software Development Principles](https://businessmap.io/blog/principles-of-lean-software-development)

### Effect-TS Patterns
- [DeepWiki: Effect Decomposition](https://deepwiki.com/search/what-are-the-canonical-pattern_60325d06-a796-4402-adae-92b5556bd5ca)
- `.edin/EFFECT_PATTERNS.md` (local registry)
- `submodules/effect/packages/effect/src/Context.ts` (canonical Tag/Service)

### EDIN Cycle
- `.edin/README.md` (cycle tracking protocol)
- `CLAUDE.md` (EDIN briefing)

---

## Signature

```
Co-Authored-By: Val <val@maidens.ai>
```
