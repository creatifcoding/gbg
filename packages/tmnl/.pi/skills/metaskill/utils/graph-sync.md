# util:graph-sync

> up: INDEX.md
> prereqs: none
> provides: graph-completeness-check
> children: none

Verify GRAPH.md accounts for every file in the skill. Only runs on skills that have a GRAPH.md.

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

## Output

**Pass:** No output (or "NO GRAPH.md" which is acceptable for small skills).

**Fail:** `NOT IN GRAPH: <file>` for each file missing from the topology. Fix by adding the node to GRAPH.md.
