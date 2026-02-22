#!/usr/bin/env bash
# Integration test: verify richAnswerIndex via pi --json -p in tmux
# MUST run pi from the tmnl package root so .pi/extensions/ are discovered
set -euo pipefail

# pi must launch from the tmnl package root for extension discovery
PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
LOGDIR="/tmp/pi-rich-index-test"
SESSION="pi-rich-test"
PASS=0
FAIL=0
TOTAL=0

mkdir -p "$LOGDIR"
rm -f "$LOGDIR"/*.log

# Kill stale session
tmux kill-session -t "$SESSION" 2>/dev/null || true

run_pi() {
  local name="$1"
  local prompt="$2"
  local logfile="$LOGDIR/${name}.log"
  local timeout=120
  local elapsed=0

  echo "  launching pi from $PROJECT_ROOT ..."

  tmux new-session -d -s "$SESSION" -c "$PROJECT_ROOT"
  # Escape single quotes in prompt by ending/reopening quote
  tmux send-keys -t "$SESSION" "pi --mode json -p --provider anthropic --model claude-sonnet-4-20250514 \"${prompt}\" > '${logfile}' 2>&1; echo '__PI_DONE__' >> '${logfile}'" Enter

  # Spin until __PI_DONE__ appears or timeout
  while [ $elapsed -lt $timeout ]; do
    sleep 3
    elapsed=$((elapsed + 3))
    if [ -f "$logfile" ] && grep -q "__PI_DONE__" "$logfile" 2>/dev/null; then
      break
    fi
  done

  tmux kill-session -t "$SESSION" 2>/dev/null || true

  if [ $elapsed -ge $timeout ]; then
    echo "  TIMEOUT after ${timeout}s"
    [ -f "$logfile" ] && echo "  last 3 lines:" && tail -3 "$logfile"
    return 1
  fi

  echo "  completed in ~${elapsed}s ($(wc -c < "$logfile") bytes)"
}

assert_contains() {
  local label="$1"
  local file="$2"
  local pattern="$3"
  TOTAL=$((TOTAL + 1))

  if grep -qi "$pattern" "$file" 2>/dev/null; then
    echo "  ✅ $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label (pattern not found: $pattern)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Rich Answer Index Integration Test ==="
echo "Project root: $PROJECT_ROOT"
echo "Log dir: $LOGDIR"
echo ""

# ─── Test 1: Patch dry run ───────────────────────────────────────────────
echo "── Test 1: patch-surveys (dry run) ──"

run_pi "patch-dry" \
  'Call the patch-surveys tool with dryRun set to true. Return the result verbatim.'
LOGFILE="$LOGDIR/patch-dry.log"

if [ -f "$LOGFILE" ] && [ -s "$LOGFILE" ]; then
  assert_contains "tool was invoked" "$LOGFILE" "patch\|Patch\|tool_use"
  assert_contains "reports counts" "$LOGFILE" "dry\|skip\|would\|patch\|enrich\|result"
else
  echo "  ❌ no output"; FAIL=$((FAIL + 2)); TOTAL=$((TOTAL + 2))
fi
echo ""

# ─── Test 2: Patch live ─────────────────────────────────────────────────
echo "── Test 2: patch-surveys (live) ──"

run_pi "patch-live" \
  'Call the patch-surveys tool with dryRun set to false. Return the result verbatim.'
LOGFILE="$LOGDIR/patch-live.log"

if [ -f "$LOGFILE" ] && [ -s "$LOGFILE" ]; then
  assert_contains "executed" "$LOGFILE" "patch\|enrich\|success\|skip\|Patch"
else
  echo "  ❌ no output"; FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1))
fi
echo ""

# ─── Test 3: Query compound scoping results ─────────────────────────────
echo "── Test 3: query-surveys (compound scoping) ──"

run_pi "query-scoping" \
  'Call the query-surveys tool with tags ["compound","scoping"] and status "completed". Return the full result.'
LOGFILE="$LOGDIR/query-scoping.log"

if [ -f "$LOGFILE" ] && [ -s "$LOGFILE" ]; then
  assert_contains "has question prompt text" "$LOGFILE" "topology\|linked questionnaire\|routing"
  assert_contains "has answer value" "$LOGFILE" "Hybrid\|hybrid\|Configurable"
  assert_contains "tagged compound" "$LOGFILE" "compound"
else
  echo "  ❌ no output"; FAIL=$((FAIL + 3)); TOTAL=$((TOTAL + 3))
fi
echo ""

# ─── Test 4: Query deep-dive results ────────────────────────────────────
echo "── Test 4: query-surveys (compound deep-dive) ──"

run_pi "query-deepdive" \
  'Call the query-surveys tool with tags ["compound","deep-dive"] and status "completed". Return the full result.'
LOGFILE="$LOGDIR/query-deepdive.log"

if [ -f "$LOGFILE" ] && [ -s "$LOGFILE" ]; then
  assert_contains "has deep-dive prompt text" "$LOGFILE" "accumulator\|recipe\|fork\|parallel"
  assert_contains "has answer content" "$LOGFILE" "EDIN\|edin\|emergent\|STM\|fiber"
else
  echo "  ❌ no output"; FAIL=$((FAIL + 2)); TOTAL=$((TOTAL + 2))
fi
echo ""

# ─── Summary ─────────────────────────────────────────────────────────────
echo "==========================================="
echo "Results: $PASS/$TOTAL passed, $FAIL failed"
echo "==========================================="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Log files:"
  ls -lh "$LOGDIR"/*.log 2>/dev/null
  echo ""
  echo "Inspect: cat /tmp/pi-rich-index-test/<name>.log | grep text_end"
  exit 1
fi

echo "All tests passed ✓"
