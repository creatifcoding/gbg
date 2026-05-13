# metaskill — Utils & Verification Tools

> up: SKILL.md
> prereqs: none
> provides: audit-commands, verification-scripts, diagnostic-tools
> children: none
> meta: true — executable tools for skill governance

All commands assume cwd is `packages/tmnl`. Adjust if running from repo root.

---

## util:audit-single

Audit one skill for governance compliance.

```bash
SKILL=.pi/skills/<name>
echo "=== $SKILL ==="
echo "Files: $(find $SKILL -name '*.md' | wc -l)"
echo "Governed: $(grep -q 'governed-by: metaskill' $SKILL/SKILL.md 2>/dev/null && echo '✓' || echo '✗')"
echo "Changelog: $(test -f $SKILL/CHANGELOG.md && echo '✓' || echo '✗')"
echo "Graph: $(test -f $SKILL/GRAPH.md && echo '✓' || echo '✗')"
echo ""
echo "Frontmatter gaps:"
for f in $(find $SKILL -name '*.md' | sort); do
  head -6 "$f" | grep -qP '> (up|prereqs|provides|governed-by|meta):' || echo "  MISSING: $f"
done
echo ""
echo "Router coverage:"
for f in $(find $SKILL/references -name '*.md' 2>/dev/null | sort); do
  base=$(basename "$f")
  grep -q "$base" $SKILL/SKILL.md || echo "  NOT ROUTED: $f"
done
```

---

## util:audit-all

Bulk audit every skill in the workspace.

```bash
printf "%-35s %s  %5s  %s  %s\n" "SKILL" "GOV" "FILES" "CL" "FM_MISS"
printf "%-35s %s  %5s  %s  %s\n" "-----" "---" "-----" "--" "-------"
for skill in .pi/skills/*/SKILL.md; do
  dir=$(dirname "$skill")
  name=$(basename "$dir")
  files=$(find "$dir" -name '*.md' | wc -l)
  gov=$(grep -q 'governed-by: metaskill' "$skill" 2>/dev/null && echo "✓" || echo "✗")
  cl=$(test -f "$dir/CHANGELOG.md" && echo "✓" || echo "✗")
  fm_miss=0
  for f in $(find "$dir" -name '*.md'); do
    head -6 "$f" | grep -qP '> (up|prereqs|provides|governed-by|meta):' || fm_miss=$((fm_miss + 1))
  done
  printf "%-35s  %s   %4d   %s   %d\n" "$name" "$gov" "$files" "$cl" "$fm_miss"
done
```

---

## util:frontmatter-check

Check all files in a skill for frontmatter compliance.

```bash
SKILL=.pi/skills/<name>
for f in $(find $SKILL -name '*.md' | sort); do
  fields=$(head -6 "$f" | grep -cP '> (up|prereqs|provides|children|governed-by|meta|cross):')
  echo "$fields fields  $f"
done
```

---

## util:orphan-check

Find files that exist in a skill but aren't referenced in any INDEX.md's children or SKILL.md's router.

```bash
SKILL=.pi/skills/<name>
for f in $(find $SKILL -name '*.md' | sort); do
  base=$(basename "$f")
  [ "$base" = "SKILL.md" ] && continue
  found=0
  grep -rq "$base" $SKILL/SKILL.md && found=1
  grep -rq "$base" $SKILL/**/INDEX.md 2>/dev/null && found=1
  grep -rq "$base" $SKILL/references/**/INDEX.md 2>/dev/null && found=1
  [ $found -eq 0 ] && echo "ORPHAN: $f"
done
```

---

## util:dead-link-check

Find frontmatter references to files that don't exist.

```bash
SKILL=.pi/skills/<name>
for f in $(find $SKILL -name '*.md' | sort); do
  dir=$(dirname "$f")
  # Extract paths from prereqs and children lines
  for ref in $(head -8 "$f" | grep -P '> (prereqs|children):' | sed 's/.*: //' | tr ',' '\n' | tr -d ' '); do
    [ "$ref" = "none" ] && continue
    target="$dir/$ref"
    [ ! -f "$target" ] && echo "DEAD: $f → $ref (expected $target)"
  done
done
```

---

## util:changelog-coverage

Verify CHANGELOG accounts for every file in the skill.

```bash
SKILL=.pi/skills/<name>
CL=$SKILL/CHANGELOG.md
[ ! -f "$CL" ] && echo "NO CHANGELOG" && exit 1
for f in $(find $SKILL -name '*.md' | sort); do
  rel=${f#$SKILL/}
  [ "$rel" = "CHANGELOG.md" ] && continue
  grep -q "$rel\|$(basename $f)" "$CL" || echo "NOT IN CHANGELOG: $rel"
done
```

---

## util:graph-sync

Verify GRAPH.md accounts for every file in the skill (skills that have GRAPH.md).

```bash
SKILL=.pi/skills/<name>
GRAPH=$SKILL/GRAPH.md
[ ! -f "$GRAPH" ] && echo "NO GRAPH.md (skill may not need one)" && exit 0
for f in $(find $SKILL -name '*.md' | sort); do
  base=$(basename "$f")
  [ "$base" = "GRAPH.md" ] && continue
  [ "$base" = "CHANGELOG.md" ] && continue
  grep -q "$base" "$GRAPH" || echo "NOT IN GRAPH: $base ($f)"
done
```

---

## util:governance-adopt

Add governance to an ungoverned skill.

```bash
SKILL=.pi/skills/<name>
# Check if already governed
grep -q 'governed-by: metaskill' $SKILL/SKILL.md && echo "Already governed" && exit 0

# Add governance line after the last frontmatter field
# Find the last '>' line in the first 10 lines, insert after it
LINE=$(head -10 $SKILL/SKILL.md | grep -n '^>' | tail -1 | cut -d: -f1)
if [ -n "$LINE" ]; then
  sed -i "${LINE}a > governed-by: metaskill" $SKILL/SKILL.md
  echo "Added governance to $SKILL/SKILL.md after line $LINE"
else
  # No frontmatter — add after title
  sed -i '1a\\n> governed-by: metaskill' $SKILL/SKILL.md
  echo "Added governance to $SKILL/SKILL.md (no existing frontmatter)"
fi
```

---

## util:full-health

Run all checks on a single skill. The comprehensive diagnostic.

```bash
SKILL=.pi/skills/<name>
echo "╔══════════════════════════════════════╗"
echo "║  HEALTH CHECK: $(basename $SKILL)"
echo "╚══════════════════════════════════════╝"
echo ""
echo "── Files ──"
find $SKILL -name '*.md' | sort
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
  head -6 "$f" | grep -qP '> (up|prereqs|provides|governed-by|meta):' || { echo "✗ MISSING: $f"; clean=false; }
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
```
