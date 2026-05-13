# util:orphan-check

> up: INDEX.md
> prereqs: none
> provides: unreachable-file-detection
> children: none

Find files that exist in a skill but aren't referenced in any INDEX.md children, SKILL.md router, or sibling utils/INDEX.md.

```bash
SKILL=.pi/skills/<name>
for f in $(find $SKILL -name '*.md' | sort); do
  base=$(basename "$f")
  [ "$base" = "SKILL.md" ] && continue
  found=0
  grep -rq "$base" $SKILL/SKILL.md 2>/dev/null && found=1
  grep -rq "$base" $SKILL/references/ 2>/dev/null && found=1
  grep -rq "$base" $SKILL/utils/ 2>/dev/null && found=1
  [ $found -eq 0 ] && echo "ORPHAN: $f"
done
```

## Output

**Pass:** No output — every file is reachable.

**Fail:** `ORPHAN: <path>` for each unreachable file. Fix by adding it to the nearest INDEX.md children or SKILL.md router.
