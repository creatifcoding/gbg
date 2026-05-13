# util:dead-link-check

> up: INDEX.md
> prereqs: none
> provides: broken-frontmatter-reference-detection
> children: none

Find frontmatter prereqs/children references that point to files that don't exist.

```bash
SKILL=.pi/skills/<name>
for f in $(find $SKILL -name '*.md' | sort); do
  dir=$(dirname "$f")
  for ref in $(head -8 "$f" | grep -P '> (prereqs|children):' | sed 's/.*: //' | tr ',' '\n' | tr -d ' '); do
    [ "$ref" = "none" ] && continue
    target="$dir/$ref"
    [ ! -f "$target" ] && echo "DEAD: $f → $ref (expected $target)"
  done
done
```

## Output

**Pass:** No output — all references resolve.

**Fail:** `DEAD: <source> → <ref> (expected <resolved-path>)` for each broken link. Fix by updating the frontmatter or creating the missing file.
