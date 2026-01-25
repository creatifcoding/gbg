# Skill Activation from Hook and CLI Output

When hooks or CLI tools output skill recommendations, **immediately invoke the listed skills** using the Skill tool.

## Hook Output Pattern

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CRITICAL SKILLS:
  → skill-name

📚 RECOMMENDED SKILLS:
  → another-skill

ACTION: Use Skill tool BEFORE responding
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Required Action

| Hook Signal | Action |
|-------------|--------|
| `⚠️ CRITICAL SKILLS` | **MUST** invoke immediately via Skill tool |
| `📚 RECOMMENDED SKILLS` | **SHOULD** invoke unless clearly irrelevant to task |
| No skills listed | Proceed normally |

## Invocation Protocol

1. **See hook output** → Check for skill recommendations
2. **Invoke Skill tool** → `Skill(skill: "skill-name")`
3. **Apply skill context** → Use the skill's guidance in your response
4. **Then respond** → Address user's request with skill knowledge

## Relevance Check

Before dismissing a recommended skill, ask:
- Does this skill relate to the domain I'm working in?
- Would the skill's patterns help with this task?
- Is there any overlap between skill and current work?

If yes to any → **Invoke the skill**

## Anti-Pattern

```
❌ WRONG:
   Hook: "RECOMMENDED SKILLS: → spike-testing"
   Claude: *sees it, ignores it, writes response*

✅ CORRECT:
   Hook: "RECOMMENDED SKILLS: → spike-testing"
   Claude: *invokes Skill tool with skill="spike-testing"*
   Claude: *applies spike methodology to response*
```

## Why This Matters

Skills encode distilled expertise. The hook's pattern matching identifies relevant skills you might miss. Ignoring recommendations:
- Wastes accumulated knowledge
- Risks reinventing solved patterns
- Reduces response quality

**When in doubt, invoke the skill.**

## CLI Steering Messages

CLI tools (like `bun spike`) emit structured steering messages:

```html
<!-- SPIKE_STEERING
{"action":"CREATE_SPIKE","suggestedName":"...",
 "hypotheses":[...],"nextCommand":"...",
 "skills":["spike-testing"]}
-->
```

When you see a `<!-- SPIKE_STEERING ... -->` block:

1. **Parse the JSON** inside the HTML comment
2. **Invoke listed skills** from the `skills` array
3. **Follow the suggested action** in `nextCommand`
4. **Use hypothesis context** for implementation

Example response after seeing steering:
```
I see the spike CLI suggests creating a spike with these hypotheses.
Let me invoke the spike-testing skill for methodology guidance.

[Invokes Skill tool with skill="spike-testing"]
```

## Steering Actions

| Action | Meaning | Next Step |
|--------|---------|-----------|
| `CREATE_SPIKE` | Generate new spike | Run `nextCommand` to init |
| `IMPLEMENT_SPIKE` | Fill in spike logic | Open file, implement H1-H4 |
| `RUN_SPIKE` | Execute spike | Run spike with --verbose |
| `LEARN_SPIKE` | Extract learning | Run learn command |
