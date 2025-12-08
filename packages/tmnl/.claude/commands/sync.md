# /sync - Session Synchronization Command

Synchronize beads and git state without closing the session. Lighter-weight than `/close-session`.

## Arguments

The user invoked `/sync` with: $ARGUMENTS

Parse arguments for sync mode:
- **`/sync`** or **`/sync full`** → Full sync (beads + git)
- **`/sync quick`** → Beads sync only (no git operations)
- **`/sync status`** → Show sync status without changes
- **`/sync beads`** → Beads-only sync (alias for `quick`)
- **`/sync git`** → Git-only sync (skip beads)
- **`/sync resolve`** → Conflict resolution mode
- **`/sync help`** → Show this documentation

---

## Sync Modes

### Full Sync (Default)

Execute both beads and git synchronization in one operation.

**Sequence**:
```
1. bd sync --squash     (export pending, don't commit yet)
2. git add .beads/      (stage beads files)
3. git add -u           (stage tracked changes)
4. git commit           (create sync commit)
5. git pull --rebase    (get remote changes)
6. git push             (push local changes)
7. bd sync --import-only (import any remote changes)
```

**When to use**:
- Mid-session checkpoint
- Before switching tasks
- After significant code changes
- Regular sync cadence (every 30-60 min)

---

### Quick Sync (Beads Only)

Synchronize beads state without touching git.

**Sequence**:
```
1. bd sync --flush-only   (export to JSONL)
2. (no git operations)
```

**When to use**:
- Rapid beads updates
- Testing beads changes
- When git state is already clean
- Avoiding git commit noise

---

### Status Check

Show current sync state without making changes.

**Sequence**:
```
1. bd sync --status        (beads sync status)
2. git status --porcelain  (working tree status)
3. git log --oneline HEAD..origin/<branch> (behind)
4. git log --oneline origin/<branch>..HEAD (ahead)
```

**When to use**:
- Before starting work
- After pulling remote changes
- Investigating sync issues
- Understanding current state

---

### Git-Only Sync

Synchronize git without touching beads.

**Sequence**:
```
1. git add -u           (stage tracked changes)
2. git commit           (create sync commit)
3. git pull --rebase    (get remote changes)
4. git push             (push local changes)
```

**When to use**:
- Beads is broken/unavailable
- Only code changes, no issues changed
- Emergency sync needed

---

### Conflict Resolution Mode

Handle sync conflicts interactively.

**Sequence**:
```
1. bd sync --status        (identify conflicts)
2. Show conflict summary   (user decides resolution)
3. Apply resolution        (keep local, keep remote, or merge)
4. bd sync                 (re-sync after resolution)
5. git push                (push resolved state)
```

**When to use**:
- After failed sync with conflicts
- Multiple clones diverged
- Beads database conflicts

---

## Implementation: Full Sync

### Step 1: Pre-Sync Checks

```bash
# Check for uncommitted changes
git status --porcelain

# Check beads daemon status
bd info

# Check current branch
git rev-parse --abbrev-ref HEAD
```

**Output**:
```
═══════════════════════════════════════════════════════════
  SYNC: PRE-FLIGHT CHECKS
═══════════════════════════════════════════════════════════

Branch: feat/tldraw-drag-reticles
Uncommitted: 8 files
Beads: 3 pending changes

Status: READY
═══════════════════════════════════════════════════════════
```

**If on main/master**:
- Warn strongly: "Syncing on main branch. Continue? (y/n)"
- Recommend using feature branch

**If merge conflicts**:
- Abort with error
- User must resolve conflicts manually first

---

### Step 2: Beads Export

```bash
bd sync --squash --message "sync: $(date +%Y-%m-%d-%H%M)"
```

**Expected output**:
```
Exported 3 pending changes to JSONL
Changes accumulated (squashed), run 'bd sync' to commit
```

**If worktree error**:
```
Error: .beads/ is in a git worktree
```

**Recovery**:
```bash
bd sync --flush-only  # Export without git ops
git add .beads/*.jsonl .beads/beads.db .beads/.meta.json
```

**Output**:
```
═══════════════════════════════════════════════════════════
  SYNC: BEADS EXPORT
═══════════════════════════════════════════════════════════

Exported: 3 changes to JSONL
  - 1 issue created
  - 2 issues updated

Files updated:
  .beads/issues.jsonl
  .beads/beads.db
  .beads/.meta.json

Status: EXPORTED
═══════════════════════════════════════════════════════════
```

---

### Step 3: Git Staging

```bash
# Stage beads files
git add .beads/*.jsonl .beads/beads.db .beads/.meta.json

# Stage tracked changes
git add -u

# Show what's staged
git diff --cached --stat
```

**Prompt user with AskUserQuestion**:
```
Stage all tracked changes for sync commit?

Options:
- [x] All tracked changes (git add -u)
- [ ] Beads files only
- [ ] Custom selection

Selected files (12):
  M  .beads/issues.jsonl
  M  .beads/beads.db
  M  src/lib/animation/Animatable.ts
  M  src/components/splash/Splash.tsx
  ... (8 more)

Continue? (y/n)
```

**Output**:
```
═══════════════════════════════════════════════════════════
  SYNC: GIT STAGING
═══════════════════════════════════════════════════════════

Staged:
  Beads: 3 files
  Source: 8 files
  Docs: 1 file
  Total: 12 files

  342 insertions(+), 18 deletions(-)

Status: STAGED
═══════════════════════════════════════════════════════════
```

---

### Step 4: Git Commit

Create sync commit with auto-generated message:

```bash
git commit -m "$(cat <<'EOF'
sync: session checkpoint $(date +%Y-%m-%d %H:%M)

Synchronized beads and code changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Val <val@maidens.ai>
EOF
)"
```

**OR** allow user to provide custom message via **AskUserQuestion**:
```
Provide sync commit message (or press Enter for auto-generated):

[                                                    ]

Default: sync: session checkpoint 2025-12-08 14:45
```

**Verify commit**:
```bash
git log -1 --format='[%h] %s'
git show --stat HEAD
```

**Output**:
```
═══════════════════════════════════════════════════════════
  SYNC: GIT COMMIT
═══════════════════════════════════════════════════════════

Commit: [a1b2c3d] sync: session checkpoint 2025-12-08 14:45
Author: Val <val@maidens.ai>

  12 files changed, 342 insertions(+), 18 deletions(-)

Status: COMMITTED
═══════════════════════════════════════════════════════════
```

---

### Step 5: Git Pull (Rebase)

```bash
git fetch origin $(git rev-parse --abbrev-ref HEAD)
git log --oneline HEAD..origin/$(git rev-parse --abbrev-ref HEAD)
```

**If remote has commits**:
```bash
git pull --rebase origin $(git rev-parse --abbrev-ref HEAD)
```

**If no conflicts**:
```
Successfully rebased and updated refs/heads/feat/tldraw-drag-reticles
```

**If conflicts occur**:
```
CONFLICT (content): Merge conflict in src/lib/animation/Animatable.ts
```

**Conflict handling**:
1. Show conflict summary
2. Abort rebase: `git rebase --abort`
3. Switch to `/sync resolve` mode
4. User must resolve manually

**Output (no conflicts)**:
```
═══════════════════════════════════════════════════════════
  SYNC: GIT PULL
═══════════════════════════════════════════════════════════

Fetched: origin/feat/tldraw-drag-reticles
Remote commits: 2
Local commits: 1

Rebase: ✓ Success
  Applied: [a1b2c3d] sync: session checkpoint

Status: REBASED
═══════════════════════════════════════════════════════════
```

---

### Step 6: Git Push

```bash
git push origin $(git rev-parse --abbrev-ref HEAD)
```

**If fast-forward**:
```
To github.com:user/repo.git
   old_sha..new_sha  feat/tldraw-drag-reticles -> feat/tldraw-drag-reticles
```

**If rejected**:
- Re-run Step 5 (pull/rebase)
- Retry push
- If still fails, abort with manual intervention required

**Output**:
```
═══════════════════════════════════════════════════════════
  SYNC: GIT PUSH
═══════════════════════════════════════════════════════════

Pushed: feat/tldraw-drag-reticles
Remote: origin

  1 commit pushed
  Local:  a1b2c3d
  Remote: a1b2c3d

Status: SYNCED
═══════════════════════════════════════════════════════════
```

---

### Step 7: Beads Import

```bash
bd sync --import-only
```

Import any changes that came from remote (in case another clone pushed).

**Expected output**:
```
Imported 0 changes from JSONL (already up to date)
```

**OR (if remote had changes)**:
```
Imported 2 changes from JSONL
  - 1 issue created
  - 1 issue updated
```

**Output**:
```
═══════════════════════════════════════════════════════════
  SYNC: BEADS IMPORT
═══════════════════════════════════════════════════════════

Imported: 2 changes from remote
  - 1 issue created (#GBG-116)
  - 1 issue updated (#GBG-042)

Database updated: .beads/beads.db

Status: IMPORTED
═══════════════════════════════════════════════════════════
```

---

### Step 8: Final Verification

```bash
# Verify remote sync
git rev-parse HEAD
git rev-parse origin/$(git rev-parse --abbrev-ref HEAD)

# Verify working tree
git status --porcelain

# Verify beads sync
bd sync --status
```

**Output**:
```
═══════════════════════════════════════════════════════════
  SYNC: VERIFICATION
═══════════════════════════════════════════════════════════

Git Status:
  Local:  a1b2c3d
  Remote: a1b2c3d
  ✓ Exact match

Working Tree:
  ✓ Clean

Beads:
  ✓ Sync branch up to date with main

═══════════════════════════════════════════════════════════
  SYNC COMPLETED
═══════════════════════════════════════════════════════════

Summary:
  - Beads: 3 changes exported, 2 imported
  - Git: 1 commit pushed
  - Status: All synchronized

Next Sync: Recommended in 30-60 minutes
═══════════════════════════════════════════════════════════
```

---

## Implementation: Quick Sync (Beads Only)

### Step 1: Beads Export Only

```bash
bd sync --flush-only
```

**Output**:
```
═══════════════════════════════════════════════════════════
  QUICK SYNC: BEADS ONLY
═══════════════════════════════════════════════════════════

Exported: 3 changes to JSONL
  - 1 issue created
  - 2 issues updated

Files updated:
  .beads/issues.jsonl
  .beads/beads.db
  .beads/.meta.json

Note: Changes exported to JSONL but NOT committed to git.
Run `/sync full` or `/close-session` to commit.

Status: EXPORTED (uncommitted)
═══════════════════════════════════════════════════════════
```

**No git operations performed.**

---

## Implementation: Status Check

### Step 1: Beads Status

```bash
bd sync --status
```

**Output**:
```
Sync branch: up to date with main
Pending changes: 3
```

---

### Step 2: Git Status

```bash
git status --porcelain
git log --oneline HEAD..origin/$(git rev-parse --abbrev-ref HEAD)  # Behind
git log --oneline origin/$(git rev-parse --abbrev-ref HEAD)..HEAD  # Ahead
```

**Output**:
```
═══════════════════════════════════════════════════════════
  SYNC STATUS
═══════════════════════════════════════════════════════════

Beads:
  Pending changes: 3
  Sync branch: up to date with main

Git:
  Branch: feat/tldraw-drag-reticles
  Uncommitted: 8 files
  Ahead of remote: 0 commits
  Behind remote: 2 commits

  Remote has commits you don't have:
    b1c2d3e fix(tmnl): correct animation timing
    c2d3e4f docs(tmnl): update CLAUDE.md

Recommendation:
  Run `/sync full` to:
    1. Pull remote changes (rebase)
    2. Push local changes
    3. Sync beads state

═══════════════════════════════════════════════════════════
```

---

## Implementation: Git-Only Sync

### Step 1: Git Operations Only

Skip beads entirely, execute:
1. git add -u
2. git commit
3. git pull --rebase
4. git push

**Output**:
```
═══════════════════════════════════════════════════════════
  GIT-ONLY SYNC
═══════════════════════════════════════════════════════════

Note: Beads sync SKIPPED

Git Operations:
  ✓ Staged 8 tracked files
  ✓ Committed [a1b2c3d]
  ✓ Pulled (no conflicts)
  ✓ Pushed to remote

Status: SYNCED (git only)

Warning: Beads changes NOT synchronized.
Run `/sync quick` or `/sync full` to sync beads.
═══════════════════════════════════════════════════════════
```

---

## Implementation: Conflict Resolution Mode

### Step 1: Detect Conflicts

```bash
bd sync --status
git status --porcelain | grep "^UU"
```

**Types of conflicts**:

1. **Beads conflicts** - Multiple clones modified same issue
2. **Git conflicts** - Code changes conflicted during rebase
3. **Mixed conflicts** - Both beads and git

---

### Step 2: Show Conflict Summary

```
═══════════════════════════════════════════════════════════
  CONFLICT RESOLUTION
═══════════════════════════════════════════════════════════

Detected Conflicts:

Beads:
  - Issue #GBG-042: Modified on both local and remote
    Local:  Title: "Add animation system"
    Remote: Title: "Add animation framework"

Git:
  - src/lib/animation/Animatable.ts: Content conflict

Resolution Required:
  1. Beads conflicts: Choose local, remote, or manual merge
  2. Git conflicts: Resolve in editor

═══════════════════════════════════════════════════════════
```

---

### Step 3: Resolve Conflicts

Use **AskUserQuestion** to guide resolution:

**For beads conflicts**:
```
How to resolve Issue #GBG-042?

Options:
  1. Keep local version
  2. Keep remote version
  3. Manual merge (open in editor)
  4. Skip (leave conflicted)

Selection: [  ]
```

**Apply resolution**:
```bash
# Keep local
bd edit #GBG-042 --title "Add animation system"

# Keep remote
bd sync --import-only --force

# Manual merge
bd edit #GBG-042  # Opens in $EDITOR
```

**For git conflicts**:
```
Git conflict in: src/lib/animation/Animatable.ts

Actions:
  1. Open in editor to resolve
  2. Keep local version (checkout --ours)
  3. Keep remote version (checkout --theirs)
  4. Abort rebase

Selection: [  ]
```

**Apply resolution**:
```bash
# Open editor
$EDITOR src/lib/animation/Animatable.ts

# Keep local
git checkout --ours src/lib/animation/Animatable.ts
git add src/lib/animation/Animatable.ts

# Keep remote
git checkout --theirs src/lib/animation/Animatable.ts
git add src/lib/animation/Animatable.ts

# Abort
git rebase --abort
```

---

### Step 4: Re-Sync After Resolution

```bash
# Continue rebase if needed
git rebase --continue

# Re-sync beads
bd sync

# Push resolved state
git push origin $(git rev-parse --abbrev-ref HEAD)
```

**Output**:
```
═══════════════════════════════════════════════════════════
  CONFLICTS RESOLVED
═══════════════════════════════════════════════════════════

Beads:
  ✓ Issue #GBG-042 resolved (kept local)

Git:
  ✓ src/lib/animation/Animatable.ts resolved
  ✓ Rebase completed
  ✓ Pushed to remote

Status: SYNCED (conflicts resolved)
═══════════════════════════════════════════════════════════
```

---

## Relationship to /close-session

`/sync` is a **lighter-weight checkpoint** within a session:

| Feature | /sync | /close-session |
|---------|-------|----------------|
| **Beads sync** | Optional (can skip) | Always (unless quick mode) |
| **Git commit** | Auto-generated sync message | User-provided structured message |
| **Git push** | Always | Always |
| **Session journal** | Not updated | Updated with close timestamp |
| **Verification** | Basic SHA check | Full 5-phase verification |
| **Use case** | Mid-session checkpoint | End of work session |

**Typical workflow**:
1. Start session
2. Work for 30-60 min
3. `/sync` (checkpoint)
4. Work for 30-60 min
5. `/sync` (checkpoint)
6. Work complete
7. `/close-session` (final commit with detailed message)

---

## Auto-Sync Configuration

Configure automatic sync intervals (optional):

```bash
# In .claude/config.json or user config
{
  "auto_sync": {
    "enabled": true,
    "interval_minutes": 30,
    "mode": "quick"  // "quick" or "full"
  }
}
```

When enabled, Val will remind:
```
⏰ Auto-sync reminder: Last sync was 31 minutes ago.
Run `/sync` to checkpoint current progress?
```

---

## Error Recovery

| Error | Command | Recovery |
|-------|---------|----------|
| **Worktree error on bd sync** | `/sync` | Switch to git-only mode, manual .beads/ staging |
| **Push rejected** | `/sync` | Auto-retry with rebase |
| **Rebase conflicts** | `/sync` | Switch to `/sync resolve` mode |
| **Beads conflicts** | `/sync` | Switch to `/sync resolve` mode |
| **Network failure** | `/sync` | Retry 3x with backoff, then abort |
| **No changes to sync** | `/sync` | Exit gracefully (no-op) |

---

## Notes

- **Quick sync is non-destructive** - only exports to JSONL, no git commits
- **Full sync creates commit noise** - use sparingly (30-60 min intervals)
- **Status check is always safe** - read-only, no modifications
- **Conflict resolution requires user input** - cannot auto-resolve
- **Git-only mode is emergency fallback** - when beads is broken
- **AskUserQuestion required** for staging selection and conflict resolution
- **Auto-sync is optional** - configure per-user preference

---

## Signature

All sync commits include:

```
Co-Authored-By: Val <val@maidens.ai>
```

## Related Commands

- `/close-session` - Full session termination with verification
- `/journal log` - Quick journal entry
- `/maintain archive` - Snapshot CLAUDE.md
