---
name: questionnaire
description: Generic questionnaire engine with conditional branching. Effect Schema specs, effect-atom state, pi TUI rendering. Use when you need structured user input with branching logic.
---

# Questionnaire Extension

Generic questionnaire engine with conditional branching, powered by Effect Schema + effect-atom + pi TUI.

## Quick Reference

### As a Tool (LLM invokes)

```
questionnaire({ spec: "<JSON string>" })
```

The `spec` parameter is a JSON string matching the `Questionnaire` schema.

### As a Command (user invokes)

```
/survey path/to/questionnaire.json
```

### As a Library (other extensions import)

```typescript
import { runQuestionnaire, Questionnaire } from '../questionnaire/index.ts'
import { Schema } from 'effect'

const spec = Schema.decodeUnknownSync(Questionnaire)({ ... })
const result = await runQuestionnaire(ctx, spec)
```

## Questionnaire Schema

```json
{
  "id": "unique-id",
  "title": "Display Title",
  "description": "Optional subtitle",
  "startId": "first-question-id",
  "questions": [
    {
      "id": "q1",
      "prompt": "Your question text",
      "type": "select|input|confirm|multi-select",
      "options": [
        { "value": "opt1", "label": "Option 1", "description": "Help text" }
      ],
      "allowOther": false,
      "next": "q2",
      "nextHook": {
        "hookId": "clarify-stack",
        "toolName": "pi-agent.dynamic-next",
        "when": ["backend", "other"],
        "mode": "either",
        "metaPrompt": "Generate a better follow-up question for architecture scope."
      }
    }
  ]
}
```

### Dynamic Branch Microagent (`nextHook`)

Optional per-question runtime hook for inline next-question mutation.

- `hookId`: stable audit ID
- `toolName`: `pi-agent.dynamic-next` (required built-in resolver namespace)
- `when`: `"*" | "value" | string[]` branch discriminator
- `mode`: `inject | modify | either`
- `targetId`: optional modify target (defaults to static next)
- `metaPrompt`, `model`, `temperature`, `payload`: microagent controls

Mutations are captured in `QuestionnaireResult.dynamicTrace` for replay/audit.

## Branching

The `next` field controls flow:

| Value | Behavior |
|-------|----------|
| `"q2"` | Always go to q2 |
| `{ "yes": "q3", "no": "q4" }` | Branch by answer value |
| `{ "a": "q2", "*": "q3" }` | `*` = default branch |
| *(omitted)* | End questionnaire |

## Question Types

| Type | Interaction | Options Required |
|------|-------------|-----------------|
| `select` | ↑↓ navigate, Enter select | Yes |
| `confirm` | Auto-generates Yes/No | No |
| `input` | Free text entry | No |
| `multi-select` | ↑↓ + space toggle | Yes |

## Keyboard

| Key | Action |
|-----|--------|
| `↑/k` | Move cursor up |
| `↓/j` | Move cursor down |
| `Enter` | Confirm selection |
| `←` | Go back |
| `Esc` | Cancel (or exit input mode) |

## Architecture

```
atoms.ts     — Registry-backed state (stateAtom, progressAtom)
engine.ts    — Branching logic, navigation, answer collection
renderer.ts  — TUI component (subscribe → requestRender)
schema.ts    — Effect Schema definitions (Questionnaire, Question, Answer, Result)
index.ts     — Extension entry + library exports
```

State flow: `Engine.answer()` → `set(stateAtom)` → `Registry.subscribe` callback → `tui.requestRender()` → `render(width)`
