# util:full-health

> up: INDEX.md
> prereqs: none
> provides: comprehensive-skill-diagnostic
> children: none

Comprehensive single-skill health check. Composes: governance, frontmatter, orphans, dead links, children sync, cross-reference symmetry.

```bash
SKILL=.pi/skills/<name>
echo "╔══════════════════════════════════════╗"
echo "║  HEALTH CHECK: $(basename $SKILL)"
echo "╚══════════════════════════════════════╝"
echo ""
echo "── Files ──"
find $SKILL -name '*.md' | sort
echo "Total: $(find $SKILL -name '*.md' | wc -l)"
echo ""

echo "── Governance ──"
grep -q 'governed-by: metaskill' $SKILL/SKILL.md 2>/dev/null && echo "✓ Governed" || echo "✗ UNGOVERNED"
echo ""

echo "── Changelog ──"
test -f $SKILL/CHANGELOG.md && echo "✓ Exists" || echo "✗ MISSING"
echo ""

echo "── Frontmatter ──"
clean=true
for f in $(find $SKILL -name '*.md' | sort); do
  has=$(head -6 "$f" | grep -cP '> (up|prereqs|provides|governed-by|meta|children|cross):')
  if [ $has -eq 0 ]; then
    echo "✗ NONE: $f"; clean=false
  fi
done
$clean && echo "✓ All files have frontmatter"
echo ""

echo "── Orphans ──"
clean=true
for f in $(find $SKILL -name '*.md' | sort); do
  base=$(basename "$f")
  [ "$base" = "SKILL.md" ] && continue
  found=0
  grep -rq "$base" $SKILL/SKILL.md 2>/dev/null && found=1
  grep -rq "$base" $SKILL/references/ 2>/dev/null && found=1
  grep -rq "$base" $SKILL/utils/ 2>/dev/null && found=1
  [ $found -eq 0 ] && { echo "✗ ORPHAN: $f"; clean=false; }
done
$clean && echo "✓ No orphans"
echo ""

echo "── Dead Links ──"
clean=true
for f in $(find $SKILL -name '*.md' | sort); do
  dir=$(dirname "$f")
  for ref in $(head -8 "$f" | grep -P '> (prereqs|children):' | sed 's/.*: //' | tr ',' '\n' | tr -d ' '); do
    [ "$ref" = "none" ] && continue
    target="$dir/$ref"
    [ ! -f "$target" ] && { echo "✗ DEAD: $f → $ref"; clean=false; }
  done
done
$clean && echo "✓ No dead links"
echo ""

echo "── Children Sync ──"
clean=true
for idx in $(find $SKILL -name 'INDEX.md' | sort); do
  dir=$(dirname "$idx")
  declared=$(head -8 "$idx" | grep '> children:' | sed 's/> children: //' | tr ',' '\n' | tr -d ' ')
  for f in $(ls "$dir"/*.md 2>/dev/null | sort); do
    base=$(basename "$f")
    [ "$base" = "INDEX.md" ] && continue
    echo "$declared" | grep -q "$base" || { echo "✗ EXISTS NOT DECLARED: $base in $idx"; clean=false; }
  done
  for child in $declared; do
    [ "$child" = "none" ] && continue
    [ ! -f "$dir/$child" ] && { echo "✗ DECLARED NOT EXISTS: $child in $idx"; clean=false; }
  done
done
$clean && echo "✓ INDEX children match actual files"
echo ""

echo "── Cross-Reference Symmetry ──"
clean=true
for f in $(find $SKILL -name '*.md' | sort); do
  cross=$(head -8 "$f" | grep '> cross:' | sed 's/> cross: //' | tr ',' '\n' | tr -d ' ')
  [ -z "$cross" ] && continue
  dir=$(dirname "$f")
  base=$(basename "$f")
  parent=$(basename "$dir")
  for ref in $cross; do
    target="$dir/$ref"
    [ ! -f "$target" ] && { echo "✗ $base cross: $ref — file missing"; clean=false; continue; }
    grep -qP "cross:.*($base|$parent/)" "$target" || { echo "⚠ $base → $ref — not reciprocal"; clean=false; }
  done
done
$clean && echo "✓ All cross-references symmetric"
```

## Output

**Pass:** Every section shows ✓.

**Fail:** Any ✗ or ⚠ line identifies the file and failure. Fix, then re-run.
