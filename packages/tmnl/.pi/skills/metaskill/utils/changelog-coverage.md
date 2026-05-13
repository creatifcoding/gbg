# util:changelog-coverage

> up: INDEX.md
> prereqs: none
> provides: changelog-completeness-check
> children: none

Verify CHANGELOG.md accounts for every file in the skill.

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

## Output

**Pass:** No output — every file has a changelog entry.

**Fail:** `NOT IN CHANGELOG: <path>` for each undocumented file. Fix by adding the file to the latest version entry.
