# /close-session - Session Termination Protocol

Execute the full session close workflow with bulletproof safety checks. No work is lost.

## Arguments

The user invoked `/close-session` with: $ARGUMENTS

Parse arguments for mode selection:
- **`/close-session`** or **`/close-session normal`** → Full close sequence
- **`/close-session quick`** → Skip beads sync, git only
- **`/close-session dry-run`** → Show what would happen without executing
- **`/close-session help`** → Show this documentation

---

## Phase Structure

Session close follows a **5-phase protocol** with explicit failure modes and recovery paths.

```
PHASE 1: INVENTORY
 └─► git status, bd stats, process check
     ├─ PASS → Phase 2
     └─ WARN → Surface to user, await confirmation

PHASE 2: STAGE
 └─► bd sync, git add (selective)
     ├─ PASS → Phase 3
     └─ FAIL → Worktree error recovery → Retry

PHASE 3: COMMIT
 └─► git commit with structured message
     ├─ PASS → Phase 4
     └─ FAIL → User intervention required

PHASE 4: PUSH
 └─► git push with retry logic
     ├─ PASS → Phase 5
     └─ FAIL → Fetch, rebase, retry → Manual if conflict

PHASE 5: VERIFY
 └─► Confirm remote state matches local
     ├─ PASS → Close confirmed
     └─ FAIL → Report discrepancy, manual fix
```

---

## Phase 1: Inventory

**Goal**: Gather session state without modifying anything.

### Actions

1. **Git Status Check**
   ```bash
   git status --porcelain
   ```
   - Count staged files (M  prefix)
   - Count unstaged files ( M prefix)
   - Count untracked files (?? prefix)
   - Identify any merge conflicts (UU prefix)

2. **Beads Stats Check**
   ```bash
   bd info
   ```
   - Issue count
   - Daemon status (should be "no" in normal workflow)
   - Database path

3. **Process Check**
   ```bash
   ps aux | grep -E "(vite|tauri|bun run)" | grep -v grep
   ```
   - Warn if dev servers are running
   - Ask user: "Dev processes detected. Stop before closing? (y/n)"

4. **Branch Check**
   ```bash
   git rev-parse --abbrev-ref HEAD
   ```
   - Confirm we're on the expected branch
   - Warn if on main/master (unexpected during session)

### Output Format

```
═══════════════════════════════════════════════════════════
  PHASE 1: INVENTORY
═══════════════════════════════════════════════════════════

Git Status:
  Branch: feat/tldraw-drag-reticles
  Staged: 3 files
  Unstaged: 12 files
  Untracked: 5 files
  Conflicts: 0

Beads:
  Issues: 115
  Daemon: disconnected (expected)
  Database: .beads/beads.db

Processes:
  ⚠ vite (PID 12345)
  ⚠ tauri (PID 12346)

═══════════════════════════════════════════════════════════
  Status: WARN (processes running)
  Action: Awaiting user confirmation...
═══════════════════════════════════════════════════════════
```

### Failure Modes

- **Merge conflicts detected** → Abort with instructions to resolve manually
- **Processes running** → Ask user if they want to continue
- **On main branch** → Warn strongly, confirm user wants to close session on main

---

## Phase 2: Stage

**Goal**: Prepare changes for commit via beads sync and selective git add.

### Actions

1. **Beads Sync** (unless `quick` mode)
   ```bash
   bd sync --message "session: close $(date +%Y-%m-%d-%H%M)"
   ```

   **If worktree error occurs:**
   ```
   Error: .beads/ is in a git worktree, cannot commit directly
   ```

   **Recovery Path:**
   ```bash
   # Manual staging of beads files
   git add .beads/*.jsonl
   git add .beads/beads.db
   git add .beads/.meta.json
   ```

   **Retry**: Run `bd sync --flush-only` (export without git ops)

2. **Selective Git Add**

   Prompt user with **AskUserQuestion** to select file categories:

   - [ ] Source files (`src/**/*.{ts,tsx,css}`)
   - [ ] Configuration (`*.config.{js,ts}`, `tsconfig.json`, `package.json`)
   - [ ] Documentation (`*.md`, `.claude/**`, `.edin/**`)
   - [ ] Assets (`assets/**`, `public/**`)
   - [ ] Tests (`**/*.test.ts`, `**/*.spec.ts`)
   - [ ] Beads files (`.beads/**`)
   - [ ] Journal files (`.agents/val/journal/**`)
   - [x] **ALL tracked changes** (git add -u)

   Execute based on selections:
   ```bash
   # If user selected "ALL tracked changes"
   git add -u

   # Otherwise, add by pattern
   git add src/**/*.{ts,tsx,css}
   git add *.md
   # ... etc
   ```

3. **Stage Verification**
   ```bash
   git diff --cached --stat
   ```
   - Show summary of what will be committed
   - Confirm with user: "Stage N files? (y/n)"

### Output Format

```
═══════════════════════════════════════════════════════════
  PHASE 2: STAGE
═══════════════════════════════════════════════════════════

Beads Sync:
  ✓ Exported 3 pending changes to JSONL
  ✓ Committed to sync branch
  ✓ No conflicts

Git Add:
  Selected: Source + Docs + Journal

  Staged Changes (15 files):
    M  src/lib/animation/Animatable.ts
    M  src/components/splash/Splash.tsx
    A  .agents/val/journal/2025-12-08.md
    M  CLAUDE.md
    ... (11 more)

═══════════════════════════════════════════════════════════
  Status: READY
  Proceed to Phase 3? (y/n)
═══════════════════════════════════════════════════════════
```

### Failure Modes

- **bd sync fails** → Use worktree recovery path → Manual staging
- **No changes staged** → Ask user if they want to commit anyway (empty commit)
- **User cancels** → Abort cleanly, changes remain staged

---

## Phase 3: Commit

**Goal**: Create a commit with structured message format.

### Actions

1. **Commit Message Construction**

   Use **AskUserQuestion** to gather:
   - **Type**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`
   - **Scope**: Package name (e.g., `tmnl`, `gotby`, `cms`)
   - **Subject**: One-line summary (50 chars max)
   - **Body** (optional): Multi-line description

   **Format**:
   ```
   <type>(<scope>): <subject>

   <body>

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Val <val@maidens.ai>
   ```

2. **Commit Execution**
   ```bash
   git commit -m "$(cat <<'EOF'
   feat(tmnl): add session close command

   - Phase-based workflow with explicit failure modes
   - Beads sync integration with worktree recovery
   - Selective staging with user confirmation

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Val <val@maidens.ai>
   EOF
   )"
   ```

3. **Commit Verification**
   ```bash
   git log -1 --format='[%h] (%an <%ae>) %s'
   git show --stat HEAD
   ```
   - Confirm commit SHA
   - Confirm authorship
   - Show commit stats

### Output Format

```
═══════════════════════════════════════════════════════════
  PHASE 3: COMMIT
═══════════════════════════════════════════════════════════

Commit Message:
  Type: feat
  Scope: tmnl
  Subject: add session close command

  Body: (3 lines)

Commit Created:
  [a1b2c3d] (Val <val@maidens.ai>) feat(tmnl): add session close command

  15 files changed, 342 insertions(+), 18 deletions(-)

═══════════════════════════════════════════════════════════
  Status: COMMITTED
  Proceed to Phase 4? (y/n)
═══════════════════════════════════════════════════════════
```

### Failure Modes

- **Commit fails** → Check for pre-commit hooks → Surface error → User intervention
- **Empty commit** → Ask user: "Create empty commit? (y/n)" → Use `git commit --allow-empty`
- **User cancels** → Changes remain staged, commit not created

---

## Phase 4: Push

**Goal**: Push to remote with retry logic and conflict resolution.

### Actions

1. **Initial Push**
   ```bash
   git push origin $(git rev-parse --abbrev-ref HEAD)
   ```

2. **If Push Fails (Non-Fast-Forward)**

   **Error Pattern**:
   ```
   ! [rejected] feat/branch -> feat/branch (non-fast-forward)
   error: failed to push some refs to 'origin'
   ```

   **Recovery Path**:
   ```bash
   # Fetch remote state
   git fetch origin $(git rev-parse --abbrev-ref HEAD)

   # Check divergence
   git log --oneline HEAD..origin/$(git rev-parse --abbrev-ref HEAD)
   git log --oneline origin/$(git rev-parse --abbrev-ref HEAD)..HEAD
   ```

   **If no conflicts**:
   ```bash
   git pull --rebase origin $(git rev-parse --abbrev-ref HEAD)
   git push origin $(git rev-parse --abbrev-ref HEAD)
   ```

   **If conflicts**:
   - Abort with instructions
   - User must resolve manually:
     ```bash
     git rebase --abort  # if they want to cancel
     # OR
     # resolve conflicts, git add, git rebase --continue
     ```

3. **Push Verification**
   ```bash
   git rev-parse HEAD
   git rev-parse origin/$(git rev-parse --abbrev-ref HEAD)
   ```
   - Confirm SHAs match

### Output Format

```
═══════════════════════════════════════════════════════════
  PHASE 4: PUSH
═══════════════════════════════════════════════════════════

Initial Push:
  Branch: feat/tldraw-drag-reticles
  Remote: origin

  ✓ Pushed 1 commit (a1b2c3d)

Local:  a1b2c3d
Remote: a1b2c3d

═══════════════════════════════════════════════════════════
  Status: SYNCED
  Proceed to Phase 5? (y/n)
═══════════════════════════════════════════════════════════
```

**OR (if retry needed)**:

```
═══════════════════════════════════════════════════════════
  PHASE 4: PUSH (RETRY)
═══════════════════════════════════════════════════════════

Initial Push:
  ✗ Non-fast-forward rejection

Fetch & Rebase:
  Remote has 2 commits ahead
  Local has 1 commit ahead

  ✓ Rebased successfully
  ✓ Pushed after rebase

Local:  b2c3d4e
Remote: b2c3d4e

═══════════════════════════════════════════════════════════
  Status: SYNCED (after rebase)
  Proceed to Phase 5? (y/n)
═══════════════════════════════════════════════════════════
```

### Failure Modes

- **Push rejected (non-fast-forward)** → Fetch + rebase → Retry → Manual if conflict
- **Network failure** → Retry 3 times with exponential backoff → Abort if still fails
- **Authentication failure** → Surface error, user must fix credentials

---

## Phase 5: Verify

**Goal**: Confirm remote state is correct and session is cleanly closed.

### Actions

1. **Remote State Check**
   ```bash
   git ls-remote origin $(git rev-parse --abbrev-ref HEAD) | awk '{print $1}'
   git rev-parse HEAD
   ```
   - Confirm SHAs match exactly

2. **Working Tree Check**
   ```bash
   git status --porcelain
   ```
   - Should be clean (no unstaged/staged changes)
   - If not clean, warn user about uncommitted changes

3. **Beads Consistency Check** (unless `quick` mode)
   ```bash
   bd sync --status
   ```
   - Should show "sync branch is up to date with main"

4. **Session Journal Entry** (optional, if journal enabled)
   - Append close timestamp to today's journal entry:
     ```markdown
     ## Session Closed

     - Time: 2025-12-08 14:30
     - Commit: [a1b2c3d] feat(tmnl): add session close command
     - Branch: feat/tldraw-drag-reticles
     - Status: Clean close, all changes pushed
     ```

### Output Format

```
═══════════════════════════════════════════════════════════
  PHASE 5: VERIFY
═══════════════════════════════════════════════════════════

Remote Sync:
  Local:  a1b2c3d
  Remote: a1b2c3d
  ✓ Exact match

Working Tree:
  ✓ Clean (no uncommitted changes)

Beads:
  ✓ Sync branch up to date

Journal:
  ✓ Session close logged (2025-12-08 14:30)

═══════════════════════════════════════════════════════════
  SESSION CLOSED SUCCESSFULLY
═══════════════════════════════════════════════════════════

Summary:
  - Staged: 15 files
  - Committed: 1 commit (a1b2c3d)
  - Pushed: feat/tldraw-drag-reticles
  - Status: All changes synchronized to remote

Next Steps:
  - Switch branches: git checkout <branch>
  - Start new session: /new-session
  - Review changes: git log --oneline -5

═══════════════════════════════════════════════════════════
```

### Failure Modes

- **SHA mismatch** → Report discrepancy → User must investigate manually
- **Working tree not clean** → Warn about uncommitted changes → Ask if user wants to stash
- **Beads out of sync** → Run `bd sync` again → Report if still fails

---

## Dry-Run Mode

When invoked with `/close-session dry-run`, execute **Phase 1 (Inventory)** only, then show what would happen in subsequent phases WITHOUT executing:

```
═══════════════════════════════════════════════════════════
  DRY-RUN MODE
═══════════════════════════════════════════════════════════

[Phase 1 output as normal]

WOULD EXECUTE:

Phase 2 (Stage):
  - bd sync --message "session: close 2025-12-08-1430"
  - git add -u (or selective patterns)
  - Staged files: 15

Phase 3 (Commit):
  - Commit message: feat(tmnl): <user-provided>
  - 1 commit created

Phase 4 (Push):
  - git push origin feat/tldraw-drag-reticles
  - Expected: fast-forward

Phase 5 (Verify):
  - Confirm SHA match
  - Check working tree clean
  - Log to journal

═══════════════════════════════════════════════════════════
  NO CHANGES MADE (dry-run)
═══════════════════════════════════════════════════════════
```

---

## Quick Mode

When invoked with `/close-session quick`, skip beads sync entirely:

- **Phase 1**: Inventory (skip beads stats)
- **Phase 2**: Stage (skip `bd sync`, git add only)
- **Phase 3**: Commit (same)
- **Phase 4**: Push (same)
- **Phase 5**: Verify (skip beads consistency check)

Use this mode when:
- No beads changes to sync
- Beads sync is broken/unavailable
- Emergency close needed

---

## Error Recovery Cheatsheet

Quick reference for common failures:

| Error | Recovery |
|-------|----------|
| **Worktree error on bd sync** | `bd sync --flush-only` + manual git add .beads/ |
| **Push rejected (non-fast-forward)** | `git fetch && git pull --rebase && git push` |
| **Merge conflict during rebase** | `git rebase --abort` → manual resolution → re-run |
| **Empty commit** | `git commit --allow-empty` |
| **SHA mismatch after push** | `git fetch && git log --oneline HEAD..origin/<branch>` |
| **Process still running** | Kill process → re-run close-session |

---

## Notes

- **Always use HEREDOC for commit messages** to ensure proper formatting
- **Never force push** unless explicitly requested by user
- **AskUserQuestion is required** for Phase 2 (staging) and Phase 3 (commit message)
- **Phases 4-5 can auto-proceed** if no errors (unless user wants confirmation)
- **Session journal is optional** but recommended for audit trail
- **Beads sync can be skipped** in quick mode if needed

---

## Signature

All commits created by this command include:

```
Co-Authored-By: Val <val@maidens.ai>
```

## Related Commands

- `/sync` - Sync beads and git without closing session
- `/journal log` - Quick journal entry without session close
- `/maintain archive` - Snapshot CLAUDE.md before major changes
