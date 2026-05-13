# util:governance-adopt

> up: INDEX.md
> prereqs: none
> provides: governance-line-injection
> children: none

Add `governed-by: metaskill` to an ungoverned skill's SKILL.md frontmatter.

```bash
SKILL=.pi/skills/<name>
grep -q 'governed-by: metaskill' $SKILL/SKILL.md && echo "Already governed" && exit 0

LINE=$(head -10 $SKILL/SKILL.md | grep -n '^>' | tail -1 | cut -d: -f1)
if [ -n "$LINE" ]; then
  sed -i "${LINE}a > governed-by: metaskill" $SKILL/SKILL.md
  echo "Added governance after line $LINE"
else
  sed -i '1a\\n> governed-by: metaskill' $SKILL/SKILL.md
  echo "Added governance (no existing frontmatter found)"
fi
```

## Output

**Already governed:** `Already governed` — no change made.

**Success:** `Added governance after line N` — line was injected after the last frontmatter field. Follow up with `util:full-health` to check the rest of the skill's compliance.
