# `/ready` Command Specification

**Version:** 1.0
**Date:** 2025-12-08
**Author:** Val <val@maidens.ai>

---

## Executive Summary

The `/ready` command transforms beads issue tracking into an **intelligent work surface** for lean agentic decomposition workflows. It replaces manual issue triage with algorithmic ranking based on:

1. **Priority weighting** (P0-P3)
2. **Context affinity** (matches recent commits/files)
3. **Dependency impact** (what this unblocks)
4. **Effort estimation** (quick wins vs deep work)

The command surfaces not just "what's available" but **"what should I work on next?"** — optimized for AI-assisted development where context switching is expensive and dependency chains are complex.

---

## Design Philosophy

### The Problem

Traditional issue trackers (Jira, Linear, GitHub Issues) present flat lists sorted by:
- Creation date
- Priority
- Assignee

This fails for agentic workflows where:
- **Context switching costs are high** (agent needs to load files, understand domain)
- **Dependency chains are deep** (blocked work wastes cycles)
- **Impact varies wildly** (some tasks unblock 5 others, some are leaf nodes)

### The Solution

`/ready` implements a **multi-dimensional scoring system** that ranks work by:

```
readiness_score = (priority × 0.4) + (context_affinity × 0.3) +
                  (dependency_impact × 0.2) + (effort_boost × 0.1)
```

This surfaces work that is:
1. **High-priority** (P0 > P3)
2. **In-context** (related to recent activity)
3. **High-impact** (unblocks downstream chains)
4. **Right-sized** (quick wins when needed)

---

## Architecture

### Data Flow

```
┌─────────────┐
│   User      │
│  /ready     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Agent (Val)                            │
│  ┌────────────────────────────────────┐ │
│  │ 1. Parse Arguments                 │ │
│  │    --quick, --unblock, --context   │ │
│  └────────────┬───────────────────────┘ │
│               │                          │
│               ▼                          │
│  ┌────────────────────────────────────┐ │
│  │ 2. Fetch Candidates                │ │
│  │    bd ready --json --limit 50      │ │
│  └────────────┬───────────────────────┘ │
│               │                          │
│               ▼                          │
│  ┌────────────────────────────────────┐ │
│  │ 3. Score Issues                    │ │
│  │    - Priority weight               │ │
│  │    - Context affinity (git log)    │ │
│  │    - Dependency impact (bd show)   │ │
│  │    - Effort heuristics             │ │
│  └────────────┬───────────────────────┘ │
│               │                          │
│               ▼                          │
│  ┌────────────────────────────────────┐ │
│  │ 4. Rank & Filter                   │ │
│  │    - Sort by composite score       │ │
│  │    - Apply policy (hybrid/quick)   │ │
│  │    - Limit results                 │ │
│  └────────────┬───────────────────────┘ │
│               │                          │
│               ▼                          │
│  ┌────────────────────────────────────┐ │
│  │ 5. Format Output                   │ │
│  │    - Summary table                 │ │
│  │    - Smart recommendations         │ │
│  │    - Quick wins / blockers         │ │
│  └────────────┬───────────────────────┘ │
└───────────────┼─────────────────────────┘
                │
                ▼
         ┌──────────────┐
         │  Markdown    │
         │  Response    │
         └──────────────┘
```

### Scoring Algorithm (Deep Dive)

#### 1. Priority Weight (40% of score)

**Rationale:** Priority is the primary signal from the user/team about importance.

| Priority | Raw Weight | Multiplier | Score Contribution |
|----------|------------|------------|-------------------|
| P0       | 40         | 10x        | 40 (max)          |
| P1       | 30         | 5x         | 30                |
| P2       | 20         | 2x         | 20                |
| P3       | 10         | 1x         | 10                |
| Unset    | 5          | 0.5x       | 5 (min)           |

**Normalization:** Divide raw weight by 40 to get 0-1 range, multiply by 40 to fit 40% weighting.

#### 2. Context Affinity (30% of score)

**Rationale:** Work related to recent activity leverages loaded context (files, domain knowledge).

**Steps:**

1. **Extract recent context:**
   ```bash
   git log -5 --name-only --pretty=format: | sort -u
   ```
   Output: `src/lib/data-manager/DataManager.ts`, `atoms/index.ts`, etc.

2. **Build keyword set:**
   - Filenames: `DataManager`, `atoms`
   - Module paths: `data-manager`, `slider`, `animation`
   - Extensions: `ts`, `tsx` (low weight)

3. **Match against issue:**
   - Tokenize issue title + description
   - Count keyword overlaps
   - Weight by keyword importance:
     - Module name match: 3x
     - Filename match: 2x
     - Generic term: 1x

4. **Calculate affinity:**
   ```
   affinity_pct = (matched_weight / total_possible_weight) * 100
   context_score = (affinity_pct / 100) * 30
   ```

**Boost heuristics:**
- Issue label matches current branch: +10
- Issue assignee is current user: +5

#### 3. Dependency Impact (20% of score)

**Rationale:** Work that unblocks multiple downstream tasks has cascading value.

**Steps:**

1. **Query dependents:**
   ```bash
   bd show <issue-id> --json | jq '.dependents | length'
   ```

2. **Score by count:**

| Dependent Count | Score | Rationale                          |
|-----------------|-------|------------------------------------|
| 0               | 0     | Leaf task, no unblocking           |
| 1-2             | 5     | Unblocks some work                 |
| 3-5             | 10    | Unblocks significant work          |
| 6-10            | 15    | Critical path, many dependencies   |
| 11+             | 20    | Bottleneck, must be cleared        |

**Refinement:** Weight dependents by their priority:
```
weighted_count = Σ(1 + (5 - dependent.priority))
```
A P0 dependent counts as 6, a P3 dependent as 2.

#### 4. Effort Estimation (10% of score)

**Rationale:** Quick wins (low-effort, high-impact) provide momentum and unblock chains faster.

**Heuristics** (no explicit effort field in beads):

| Indicator                        | Effort Level | Boost |
|----------------------------------|--------------|-------|
| Type = `task`, no description    | Low          | +10   |
| Type = `task`, <50 char desc     | Low          | +8    |
| Type = `feature`, long desc      | High         | +0    |
| Has >3 dependents                | High         | +0    |
| Title contains "test"            | Low          | +5    |
| Title contains "architecture"    | High         | +0    |

**Quick win bonus:** If `effort = low` AND `dependent_count > 2`, add +10.

### Sort Policies

#### Default: `hybrid` (balanced)

**Formula:**
```
score = (priority_weight × 0.4) + (context_affinity × 0.3) +
        (dependency_impact × 0.2) + (effort_boost × 0.1)
```

**Tiebreakers:**
1. Most dependents
2. Highest priority
3. Oldest `created_at`

#### Policy: `--quick`

**Goal:** Surface low-effort, high-impact work for momentum.

**Filter:**
- `effort = low` (via heuristics)
- `priority >= P1`

**Sort:**
```
score = (priority_weight × 0.5) + (dependency_impact × 0.5)
```

**Limit:** 5 results

#### Policy: `--unblock`

**Goal:** Clear bottlenecks in dependency chains.

**Filter:**
- `dependent_count >= 2`

**Sort:** Descending by `dependent_count`, then priority.

#### Policy: `--context`

**Goal:** Leverage loaded context, minimize context switching.

**Filter:**
- `context_affinity >= 50%`

**Sort:** Descending by `context_affinity`, then priority.

#### Policy: `--priority`

**Goal:** Pure priority-driven work (classic triage).

**Filter:** Optional `--priority P0` flag.

**Sort:** Priority descending, then `created_at` ascending (oldest first).

---

## Display Formats

### 1. Summary Table (Default)

**Design:**
- Compact, scannable, information-dense
- Visual elements: bars for context affinity
- Color coding (if terminal supports): P0=red, P1=yellow, P2=blue, P3=gray

**Example:**
```
🎯 READY WORK (10 issues, sorted by hybrid score)

┌─────────────┬─────────────────────────────────────────┬──────┬─────┬──────────┬───────┐
│ ID          │ Title                                   │ Pri  │ Dep │ Context  │ Score │
├─────────────┼─────────────────────────────────────────┼──────┼─────┼──────────┼───────┤
│ tmnl-qow    │ DataManager: v1 Production              │ P0   │ 4   │ ████░░░  │ 87    │
│ tmnl-rxa    │ Canvas: Drag Ghost Lifecycle            │ P0   │ 3   │ ██░░░░░  │ 82    │
│ tmnl-wan    │ Unit tests for DataManager service      │ P0   │ 0   │ ████████ │ 78    │
│ tmnl-m9e    │ Streams: Config Bridge                  │ P0   │ 3   │ ███░░░░  │ 75    │
│ tmnl-5no    │ Slider: v2 Blockers                     │ P0   │ 2   │ █░░░░░░  │ 68    │
│ tmnl-65a    │ Tauri: IPC Layer                        │ P0   │ 2   │ ░░░░░░░  │ 65    │
│ tmnl-v7b    │ Layer: v1 Stabilization                 │ P0   │ 0   │ ██░░░░░  │ 62    │
│ tmnl-8pb    │ Animation: v2 Actor Fix                 │ P0   │ 0   │ ███░░░░  │ 60    │
│ tmnl-z6o    │ DataGrid: Test Suite                    │ P0   │ 0   │ █░░░░░░  │ 58    │
│ tmnl-t0l    │ Streams: Engine Integration             │ P0   │ 0   │ ██░░░░░  │ 55    │
└─────────────┴─────────────────────────────────────────┴──────┴─────┴──────────┴───────┘

💡 START HERE: tmnl-qow
   Reason: P0, unblocks 4 issues, strong context match (87%)

🚀 QUICK WINS (finish in <30min)
   1. tmnl-wan  Unit tests for DataManager service       [P0]
   2. tmnl-09t  Ghost shape create/update/destroy tests  [P0]
   3. tmnl-1k7  Complete basic.tsx test suite            [P0]

🔓 BLOCKERS TO CLEAR (unblock multiple chains)
   1. tmnl-qow  DataManager: v1 Production        [unblocks 4]
   2. tmnl-rxa  Canvas: Drag Ghost Lifecycle      [unblocks 3]
   3. tmnl-m9e  Streams: Config Bridge            [unblocks 3]
```

**Columns:**
- **ID:** Beads issue identifier (clickable if terminal supports)
- **Title:** Issue title, truncated to 40 chars
- **Pri:** Priority (P0-P3, or `--` if unset)
- **Dep:** Dependent count (how many issues this unblocks)
- **Context:** Visual bar chart of context affinity (8 blocks = 100%)
- **Score:** Composite readiness score (0-100)

**Visual encoding:**
- Context bar: `█` = 12.5%, `░` = empty space
- Example: `████░░░` = 50% affinity (4/8 blocks)

### 2. Full Details (`--full`)

**Design:**
- Single-issue deep dive
- Acceptance criteria extracted from dependents
- File suggestions for context loading
- Explicit "why this matters" section

**Example:**
```
┌─ tmnl-qow ─────────────────────────────────────────────────────────────┐
│ DataManager: v1 Production                                              │
│                                                                          │
│ Priority:    P0                                                          │
│ Type:        feature                                                     │
│ Status:      open                                                        │
│ Unblocks:    4 issues (tmnl-037, tmnl-wan, tmnl-bp6, tmnl-093)          │
│ Context:     87% match (DataManager.ts, atoms/index.ts)                 │
│                                                                          │
│ Description:                                                             │
│ Complete worker dispatch + tests                                        │
│                                                                          │
│ Acceptance Criteria:                                                    │
│ [ ] Worker pool + Web Worker dispatch implementation (tmnl-037)         │
│ [ ] Unit tests for DataManager service (tmnl-wan)                       │
│ [ ] Unit tests for SearchKernel (tmnl-bp6)                              │
│ [ ] Fix DataManagerTestbed hypothesis validation (tmnl-093)             │
│                                                                          │
│ Why this matters:                                                       │
│ - Unblocks 4 downstream tasks                                           │
│ - High priority (P0) from product roadmap                               │
│ - Active context match: you've edited DataManager recently              │
│ - Completes a critical feature for DataManager v1 release               │
│                                                                          │
│ Dependencies:                                                           │
│ └─> tmnl-c29 (Data Manager) [parent epic, P1]                           │
│                                                                          │
│ Suggested files to load:                                                │
│ 1. src/lib/data-manager/DataManager.ts                                  │
│ 2. src/lib/data-manager/ARCHITECTURE.md                                 │
│ 3. src/lib/data-manager/types.ts                                        │
│ 4. src/lib/data-manager/kernels/SearchKernel.ts                         │
│                                                                          │
│ Next steps:                                                             │
│ 1. Mark as in-progress: bd update tmnl-qow --status in_progress         │
│ 2. Read architecture docs                                               │
│ 3. Implement worker pool dispatch                                       │
│ 4. Write unit tests                                                     │
│ 5. Validate with DataManagerTestbed                                     │
└──────────────────────────────────────────────────────────────────────────┘

Ready to start? I can load the context and begin.
```

### 3. Dependency Graph (`--graph`)

**Design:**
- ASCII tree visualization
- Shows parent dependencies and child dependents
- Priority annotations
- Impact summary at bottom

**Example:**
```
tmnl-qow (DataManager: v1 Production) P0
│
├─ Dependencies (blocks this):
│  └─> tmnl-c29 (Data Manager) [parent epic, P1]
│
└─ Dependents (blocked by this):
   ├─┬─> tmnl-037 (Worker pool + Web Worker dispatch) P0
   │ └─> [implementation needed]
   ├─┬─> tmnl-wan (Unit tests for DataManager service) P0
   │ └─> [test suite]
   ├─┬─> tmnl-bp6 (Unit tests for SearchKernel) P1
   │ └─> [test suite]
   └─┬─> tmnl-093 (Fix DataManagerTestbed hypothesis validation) P2
     └─> [bugfix]

Impact: Completing this unblocks 4 tasks across 3 priority levels
Critical path: tmnl-037 (P0) is highest-priority dependent
```

---

## Smart Recommendations

### "Start Here" Logic

**Goal:** Surface the **single best issue** to work on right now.

**Algorithm:**

1. **Primary sort:** Composite score (descending)
2. **Tiebreaker 1:** Most dependents (unblocks more work)
3. **Tiebreaker 2:** Highest priority (P0 > P1 > ...)
4. **Tiebreaker 3:** Oldest `created_at` (avoid stale work)

**Output format:**
```
💡 START HERE: tmnl-qow
   Reason: P0, unblocks 4 issues, strong context match (87%)
```

**Reasoning examples:**

| Score | Deps | Pri | Reason                                            |
|-------|------|-----|---------------------------------------------------|
| 87    | 4    | P0  | "P0, unblocks 4 issues, strong context match"     |
| 82    | 3    | P0  | "P0, unblocks 3 issues, moderate context match"   |
| 78    | 0    | P0  | "P0, perfect context match, quick win"            |
| 75    | 3    | P1  | "P1, unblocks 3 P0 issues"                        |

**Edge case:** If multiple issues tie on all criteria, pick the one with the **shortest title** (heuristic for simplicity).

### Quick Wins Section

**Goal:** Provide low-friction momentum builders.

**Criteria:**
- Issue type: `task`
- Description: Empty OR <50 characters
- Dependent count: 0 (leaf task, no unblocking pressure)
- Priority: P0 or P1
- Estimated effort: Low (via heuristics)

**Sort:** Priority descending, then by `created_at` ascending (oldest first).

**Limit:** Top 3

**Output format:**
```
🚀 QUICK WINS (finish in <30min)
   1. tmnl-wan  Unit tests for DataManager service       [P0, ~15min]
   2. tmnl-09t  Ghost shape create/update/destroy tests  [P0, ~20min]
   3. tmnl-1k7  Complete basic.tsx test suite            [P0, ~25min]
```

**Rationale in output:**
- **Time estimate:** Based on effort heuristics (low=15-30min, medium=1-2h, high=4-8h)
- **Task clarity:** "Unit tests" = well-defined scope
- **No blockers:** Can start immediately

### Blockers to Clear Section

**Goal:** Identify critical path issues that unblock the most downstream work.

**Criteria:**
- Dependent count >= 3
- Status: `open` (not in-progress)
- Priority: Any (but weighted)

**Sort:** Dependent count descending, then priority descending.

**Limit:** Top 5

**Output format:**
```
🔓 BLOCKERS TO CLEAR (unblock multiple chains)
   1. tmnl-qow  DataManager: v1 Production        [unblocks 4, including 2 P0s]
   2. tmnl-rxa  Canvas: Drag Ghost Lifecycle      [unblocks 3, including 1 P0]
   3. tmnl-m9e  Streams: Config Bridge            [unblocks 3, all P0]
```

**Rationale in output:**
- **Dependent count:** How many issues are blocked
- **Priority breakdown:** How many P0/P1/P2 dependents
- **Critical path:** Highlight if any dependents are P0

---

## Tool Invocations (Implementation Details)

### 1. Fetch Ready Issues

```bash
bd ready --json --limit 50
```

**Output schema:**
```json
[
  {
    "id": "tmnl-qow",
    "title": "DataManager: v1 Production",
    "description": "Complete worker dispatch + tests",
    "status": "open",
    "priority": 0,
    "issue_type": "feature",
    "created_at": "2025-12-08T00:49:19.821325418-05:00",
    "updated_at": "2025-12-08T00:49:19.821325418-05:00",
    "dependency_count": 1,
    "dependent_count": 4
  }
]
```

**Parsing notes:**
- `dependency_count`: How many issues this depends on (should be 0 for "ready" work, but may include parent epics)
- `dependent_count`: How many issues depend on this (key for impact scoring)
- `priority`: 0=P0, 1=P1, 2=P2, 3=P3

### 2. Get Full Issue Details

```bash
bd show <issue-id> --json
```

**Output schema:**
```json
{
  "id": "tmnl-qow",
  "title": "DataManager: v1 Production",
  "description": "Complete worker dispatch + tests",
  "status": "open",
  "priority": 0,
  "issue_type": "feature",
  "created_at": "...",
  "updated_at": "...",
  "dependencies": [
    {
      "id": "tmnl-c29",
      "title": "Data Manager",
      "priority": 1,
      "dependency_type": "parent-child"
    }
  ],
  "dependents": [
    {
      "id": "tmnl-037",
      "title": "Worker pool + Web Worker dispatch",
      "priority": 0,
      "dependency_type": "parent-child"
    },
    {
      "id": "tmnl-wan",
      "title": "Unit tests for DataManager service",
      "priority": 0,
      "dependency_type": "parent-child"
    }
  ]
}
```

**Parsing notes:**
- `dependency_type`: Can be `"parent-child"`, `"blocks"`, `"blocked-by"`
- Use `dependents` array to extract acceptance criteria (child tasks = checkboxes)

### 3. Get Context (Recent Activity)

```bash
git log -5 --name-only --pretty=format: | sort -u
```

**Output example:**
```
src/lib/data-manager/DataManager.ts
src/lib/data-manager/atoms/index.ts
src/lib/data-manager/types.ts
src/lib/data-manager/kernels/SearchKernel.ts
```

**Parsing algorithm:**

1. **Extract keywords:**
   ```typescript
   const files = gitOutput.split('\n').filter(Boolean);
   const keywords = new Set<string>();

   files.forEach(path => {
     // Module name: 'data-manager' from 'src/lib/data-manager/...'
     const moduleName = path.split('/').slice(2, 3)[0];
     if (moduleName) keywords.add(moduleName);

     // Filename: 'DataManager' from 'DataManager.ts'
     const filename = path.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '');
     if (filename) keywords.add(filename);
   });
   ```

2. **Match against issue:**
   ```typescript
   function calculateAffinity(issue: Issue, keywords: Set<string>): number {
     const issueText = `${issue.title} ${issue.description}`.toLowerCase();
     let score = 0;

     keywords.forEach(keyword => {
       const kw = keyword.toLowerCase();
       if (issueText.includes(kw)) {
         // Weight by specificity
         if (keyword.includes('-')) score += 3; // module name (kebab-case)
         else if (keyword[0] === keyword[0].toUpperCase()) score += 2; // PascalCase filename
         else score += 1; // generic term
       }
     });

     return Math.min(100, (score / keywords.size) * 100); // normalize to 0-100%
   }
   ```

### 4. Filter by Priority

```bash
bd ready --priority 0 --json  # P0 only
bd ready --priority 1 --json  # P1 only
bd ready --priority-min 0 --priority-max 1 --json  # P0-P1 range
```

### 5. Filter by Label

```bash
bd ready --label "animation" --json             # AND logic (must have ALL)
bd ready --label-any "animation,slider" --json  # OR logic (must have AT LEAST ONE)
bd ready --label "P0" --label-any "bug,feature" --json  # Combine both
```

### 6. Update Issue Status

```bash
# Mark as in-progress when work begins
bd update <issue-id> --status in_progress

# Mark as done when work completes
bd update <issue-id> --status done

# Reopen if needed
bd update <issue-id> --status open
```

---

## Integration with Workflow

### Workflow: Issue Selection → Execution

```
1. User: /ready
2. Val: [Presents ranked list]
3. User: "Let's do tmnl-qow"
4. Val:
   a. Marks issue as in_progress
   b. Loads context files (from dependencies + git log)
   c. Reads issue details + acceptance criteria
   d. Begins implementation
5. Val: [Implements solution]
6. Val:
   a. Runs tests
   b. Validates acceptance criteria
   c. Marks issue as done
   d. Shows what's now unblocked
```

### Example Session

```
User: /ready

Val: 🎯 READY WORK (10 issues, sorted by hybrid score)

[Table with tmnl-qow at top]

💡 START HERE: tmnl-qow
   Reason: P0, unblocks 4 issues, strong context match (87%)

---

User: Let's do tmnl-qow

Val: Excellent choice. This unblocks 4 downstream tasks.

Marking tmnl-qow as in-progress...
[bd update tmnl-qow --status in_progress]

Loading context files:
- src/lib/data-manager/DataManager.ts
- src/lib/data-manager/ARCHITECTURE.md
- src/lib/data-manager/types.ts

[Reads files]

Acceptance criteria (from dependents):
[ ] Worker pool + Web Worker dispatch (tmnl-037)
[ ] Unit tests for DataManager service (tmnl-wan)
[ ] Unit tests for SearchKernel (tmnl-bp6)
[ ] Fix DataManagerTestbed hypothesis validation (tmnl-093)

Starting with worker pool dispatch...

[Implementation begins]
```

### Post-Completion: Show Unblocked Work

```bash
# After marking tmnl-qow as done, show what's now unblocked
bd list --status open --json | jq '.[] | select(.dependencies | any(.id == "tmnl-qow"))'
```

**Output:**
```
Now unblocked:
- tmnl-037  Worker pool + Web Worker dispatch [P0]
- tmnl-wan  Unit tests for DataManager service [P0]
- tmnl-bp6  Unit tests for SearchKernel [P1]
- tmnl-093  Fix DataManagerTestbed hypothesis validation [P2]

Run /ready again to see updated priorities.
```

---

## Advanced Features (Future Roadmap)

### 1. Effort Estimation via Git History

**Goal:** Replace heuristics with data-driven estimates.

**Approach:**

1. **Analyze similar past issues:**
   ```bash
   # Find closed tasks with similar titles
   bd list --closed-after 2025-11-01 --issue-type task --json \
     | jq -r '.[] | "\(.id),\(.title)"' \
     | grep -i "test" \
     | xargs -I{} sh -c 'git log --all --grep={} --pretty=format:"%H"'
   ```

2. **Extract commit stats:**
   ```bash
   git show --stat <commit-hash> | tail -1
   # Output: "3 files changed, 127 insertions(+), 45 deletions(-)"
   ```

3. **Build effort model:**
   ```typescript
   interface EffortModel {
     task_type: string; // "unit test", "integration", "feature"
     avg_files_changed: number;
     avg_lines_added: number;
     avg_duration_hours: number; // from created_at to closed_at
   }
   ```

4. **Predict effort:**
   ```typescript
   function estimateEffort(issue: Issue, models: EffortModel[]): number {
     const model = models.find(m => issue.title.toLowerCase().includes(m.task_type));
     return model?.avg_duration_hours ?? 2; // default 2 hours
   }
   ```

### 2. Context Affinity via Embeddings

**Goal:** Semantic similarity instead of keyword matching.

**Approach:**

1. **Embed issue descriptions:**
   ```typescript
   import { embed } from '@anthropic/sdk'; // hypothetical

   const issueEmbedding = await embed(issue.title + ' ' + issue.description);
   ```

2. **Embed recent file contents:**
   ```bash
   git log -5 --name-only --pretty=format: | sort -u | xargs cat
   ```
   ```typescript
   const fileEmbedding = await embed(fileContents);
   ```

3. **Compute cosine similarity:**
   ```typescript
   function cosineSimilarity(a: number[], b: number[]): number {
     const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
     const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
     const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
     return dot / (magA * magB);
   }

   const affinity = cosineSimilarity(issueEmbedding, fileEmbedding) * 100;
   ```

**Benefits:**
- Catches semantic relationships ("refactor animations" matches "gsap driver")
- Language-agnostic (works with non-English issues)
- More accurate than keyword matching

### 3. Team Coordination

**Goal:** Avoid duplicate work, suggest complementary tasks.

**Approach:**

1. **Show in-progress work:**
   ```bash
   bd list --status in_progress --json
   ```

2. **Suggest complementary tasks:**
   ```typescript
   // If Alice is working on tmnl-qow (DataManager)
   // Suggest Bob works on tmnl-rxa (Canvas) — different subsystem
   // Avoid suggesting tmnl-wan (DataManager tests) — same subsystem, collision risk
   ```

3. **Highlight unblocking opportunities:**
   ```
   ℹ️  Alice is working on tmnl-qow (DataManager).
       If you complete tmnl-rxa, it won't collide with her work.
       OR: Help her by tackling tmnl-wan (tests) — low collision risk.
   ```

### 4. Calendar Integration

**Goal:** Surface work that fits available time blocks.

**Approach:**

1. **Parse calendar:** "1 hour free until next meeting"
2. **Filter issues:** `estimated_effort <= 1 hour`
3. **Sort by quick wins:**
   ```
   🕐 1 HOUR UNTIL NEXT MEETING — Quick wins:
      1. tmnl-wan  Unit tests (15min)
      2. tmnl-09t  Ghost tests (20min)
      3. tmnl-1k7  Complete test suite (25min)
   ```

### 5. Custom Scoring Functions

**Goal:** Team-specific policies.

**Example:**

```yaml
# .beads/ready-config.yaml
scoring:
  weights:
    priority: 0.5       # Increase priority importance to 50%
    context: 0.2        # Decrease context to 20%
    dependencies: 0.2
    effort: 0.1

  policies:
    frontend-first:     # Custom policy
      filter:
        label: "frontend"
      sort: priority

    backend-first:
      filter:
        label: "backend"
      sort: dependencies  # Unblock backend chains first
```

**Usage:**
```bash
/ready --policy frontend-first
```

---

## Error Handling & Edge Cases

### 1. No Ready Work

**Scenario:** All open issues are blocked.

**Output:**
```
⚠️  No ready work found.

All open issues are blocked or filtered out.

Suggestions:
- Check blocked issues:         bd blocked
- Review in-progress work:      bd list --status in_progress
- Lower priority filter:        /ready --priority P2
- Check if dependencies exist:  bd dep cycles
```

### 2. Stale Data

**Scenario:** JSONL is newer than database.

**Solution:** Auto-import on command start.

**Fallback:**
```bash
bd sync  # Force sync with remote
bd ready --json
```

### 3. Ambiguous Filters

**Scenario:** User types `--priority 1` (unclear if 1=P1 or numeric 1).

**Output:**
```
⚠️  Ambiguous filter: --priority 1

Did you mean:
- --priority P1  (priority level P1)
- --priority 1   (numeric priority 1)

Beads uses: --priority <0-4> or --priority P0-P4
```

**Resolution:** Normalize to numeric 0-4 internally.

### 4. Dependency Cycles

**Scenario:** Issue A depends on B, B depends on A.

**Detection:**
```bash
bd dep cycles
```

**Output:**
```
⚠️  Dependency cycle detected:
    tmnl-abc → tmnl-def → tmnl-abc

These issues will never appear in /ready until the cycle is broken.

Fix by removing one dependency:
    bd dep remove tmnl-abc tmnl-def
```

### 5. Empty Context

**Scenario:** No recent git activity (new branch, fresh clone).

**Fallback:**
- Context score = 0 for all issues
- Sort purely by priority + dependencies
- Suggest: "No recent activity. Showing priority-sorted work."

---

## Performance Considerations

### 1. Caching

**Problem:** `git log` is expensive on large repos (>10k commits).

**Solution:**
- Cache git log output for 5 minutes
- Invalidate on `git commit` (via git hook)
- Store in `.beads/.cache/recent-files.json`:
  ```json
  {
    "timestamp": "2025-12-08T12:34:56Z",
    "files": ["src/lib/data-manager/DataManager.ts", ...],
    "keywords": ["data-manager", "DataManager", ...]
  }
  ```

### 2. Parallel Queries

**Problem:** Fetching full details for 50 issues is slow.

**Solution:**
- Fetch summary first: `bd ready --json --limit 50` (fast)
- Score based on summary data (priority, dependent_count)
- Only fetch full details (`bd show`) for top 10 results

**Pseudocode:**
```typescript
// Stage 1: Fast summary fetch
const candidates = await exec('bd ready --json --limit 50');

// Stage 2: Score based on summary
const scored = candidates.map(issue => ({
  ...issue,
  score: calculateScore(issue, context)
})).sort((a, b) => b.score - a.score);

// Stage 3: Fetch full details for top 10 only
const top10 = scored.slice(0, 10);
const detailed = await Promise.all(
  top10.map(issue => exec(`bd show ${issue.id} --json`))
);
```

### 3. Incremental Updates

**Problem:** Re-scoring all issues on every `/ready` call.

**Solution:**
- Store previous scores in `.beads/.cache/ready-scores.json`
- Only re-score issues that changed since last run:
  ```typescript
  const changedIssues = candidates.filter(issue =>
    issue.updated_at > cache.last_run
  );
  ```

### 4. Pagination

**Problem:** Displaying 50 issues overwhelms the user.

**Solution:**
- Default limit: 10
- Support `--limit N` for custom sizes
- Add `--page` flag for pagination:
  ```bash
  /ready --limit 10 --page 2  # Show results 11-20
  ```

---

## Testing Strategy

### Unit Tests

#### 1. Scoring Algorithm

```typescript
describe('calculateScore', () => {
  it('should prioritize P0 over P1', () => {
    const p0 = { priority: 0, dependent_count: 0, context_affinity: 0 };
    const p1 = { priority: 1, dependent_count: 0, context_affinity: 0 };
    expect(calculateScore(p0)).toBeGreaterThan(calculateScore(p1));
  });

  it('should boost high-dependency issues', () => {
    const lowDep = { priority: 1, dependent_count: 0, context_affinity: 0 };
    const highDep = { priority: 1, dependent_count: 5, context_affinity: 0 };
    expect(calculateScore(highDep)).toBeGreaterThan(calculateScore(lowDep));
  });

  it('should weight priority > context > dependencies', () => {
    const highPri = { priority: 0, dependent_count: 0, context_affinity: 0 };
    const highCtx = { priority: 2, dependent_count: 0, context_affinity: 100 };
    expect(calculateScore(highPri)).toBeGreaterThan(calculateScore(highCtx));
  });
});
```

#### 2. Context Affinity

```typescript
describe('calculateAffinity', () => {
  const keywords = new Set(['data-manager', 'DataManager', 'atoms']);

  it('should match module names in title', () => {
    const issue = { title: 'Fix data-manager bug', description: '' };
    expect(calculateAffinity(issue, keywords)).toBeGreaterThan(50);
  });

  it('should match filenames in description', () => {
    const issue = { title: 'Bug', description: 'Error in DataManager.ts' };
    expect(calculateAffinity(issue, keywords)).toBeGreaterThan(50);
  });

  it('should return 0 for no matches', () => {
    const issue = { title: 'Unrelated task', description: '' };
    expect(calculateAffinity(issue, keywords)).toBe(0);
  });
});
```

### Integration Tests

#### 1. End-to-End Workflow

```typescript
describe('/ready command', () => {
  it('should fetch, score, and format issues', async () => {
    // Mock bd ready output
    mockExec('bd ready --json', mockIssues);
    mockExec('git log -5 --name-only', mockGitLog);

    const result = await runReadyCommand({ args: [] });

    expect(result).toContain('🎯 READY WORK');
    expect(result).toContain('tmnl-qow'); // Top-scored issue
    expect(result).toContain('💡 START HERE');
  });

  it('should handle --quick flag', async () => {
    const result = await runReadyCommand({ args: ['--quick'] });

    expect(result).toContain('🚀 QUICK WINS');
    expect(result).not.toContain('high-effort issue');
  });
});
```

#### 2. Beads CLI Integration

```bash
# Test that bd commands work as expected
bd ready --json | jq '.[] | .id' | head -10
bd show tmnl-qow --json | jq '.dependents | length'
git log -5 --name-only --pretty=format: | sort -u
```

---

## Deployment & Rollout

### Phase 1: MVP (Week 1)

**Scope:**
- Basic scoring algorithm (priority + dependencies only)
- Summary table output
- `--quick` and `--unblock` policies

**Validation:**
- Manual comparison: Does `/ready` output match human intuition?
- A/B test: Do users pick suggested issues vs random?

### Phase 2: Context Affinity (Week 2)

**Scope:**
- Git log parsing
- Keyword matching
- Context score integration

**Validation:**
- Measure context hit rate: % of suggested issues that match recent files
- User feedback: "Was this relevant to your current work?"

### Phase 3: Full Details & Graph (Week 3)

**Scope:**
- `--full` format with acceptance criteria
- `--graph` dependency visualization
- Smart recommendations (start here, quick wins, blockers)

**Validation:**
- User survey: "Did recommendations help prioritize?"
- Metric: Time from `/ready` to starting work (should decrease)

### Phase 4: Advanced Features (Month 2+)

**Scope:**
- Effort estimation via git history
- Context affinity via embeddings
- Team coordination
- Custom scoring policies

**Validation:**
- Long-term metrics: Issue completion rate, cycle time, unblock velocity

---

## Success Metrics

### Primary Metrics

1. **Adoption Rate**
   - % of sessions starting with `/ready`
   - Target: >80% of work sessions

2. **Recommendation Accuracy**
   - % of top-3 suggestions that are selected
   - Target: >60% hit rate

3. **Time to Start Work**
   - Duration from `/ready` to first code change
   - Target: <2 minutes (down from 5-10 min manual triage)

### Secondary Metrics

4. **Unblock Velocity**
   - Avg time from "issue ready" to "issue started"
   - Target: <1 day for P0, <3 days for P1

5. **Context Affinity Hit Rate**
   - % of suggested issues matching recent files
   - Target: >70% for top-3 suggestions

6. **Quick Win Completion**
   - % of quick win suggestions completed within 30min
   - Target: >50%

---

## Appendix: Example Data

### Sample Issues (JSON)

```json
[
  {
    "id": "tmnl-qow",
    "title": "DataManager: v1 Production",
    "description": "Complete worker dispatch + tests",
    "status": "open",
    "priority": 0,
    "issue_type": "feature",
    "created_at": "2025-12-08T00:49:19Z",
    "updated_at": "2025-12-08T00:49:19Z",
    "dependency_count": 1,
    "dependent_count": 4
  },
  {
    "id": "tmnl-wan",
    "title": "Unit tests for DataManager service",
    "description": "",
    "status": "open",
    "priority": 0,
    "issue_type": "task",
    "created_at": "2025-12-08T00:53:59Z",
    "updated_at": "2025-12-08T00:53:59Z",
    "dependency_count": 1,
    "dependent_count": 0
  }
]
```

### Sample Git Log Output

```
src/lib/data-manager/DataManager.ts
src/lib/data-manager/atoms/index.ts
src/lib/data-manager/types.ts
src/lib/data-manager/kernels/SearchKernel.ts
src/components/testbed/DataManagerTestbed.tsx
```

### Sample Scored Issues

```json
[
  {
    "id": "tmnl-qow",
    "title": "DataManager: v1 Production",
    "score": {
      "total": 87,
      "priority_weight": 40,
      "context_affinity": 26,
      "dependency_impact": 20,
      "effort_boost": 1
    },
    "context": {
      "matched_files": ["DataManager.ts", "atoms/index.ts"],
      "matched_keywords": ["data-manager", "DataManager"],
      "affinity_pct": 87
    },
    "impact": {
      "unblocks_count": 4,
      "unblocks_priorities": [0, 0, 1, 2]
    },
    "effort": "medium"
  }
]
```

---

## Changelog

### v1.0 (2025-12-08)

- Initial specification
- Core scoring algorithm
- Summary table, full details, graph formats
- Smart recommendations (start here, quick wins, blockers)
- Integration with beads CLI

### Planned (v1.1)

- Effort estimation via git history
- Context affinity via embeddings
- Team coordination features

---

## Credits

**Author:** Val <val@maidens.ai>
**Inspired by:** Beads CLI (steveyegge/beads), EDIN methodology, lean agentic workflows
**Special thanks:** Prime (user) for collaboration and feedback

---

**End of Specification**
