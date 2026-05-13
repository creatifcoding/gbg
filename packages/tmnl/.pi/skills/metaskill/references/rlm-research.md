---
up: references/INDEX.md
governed-by: metaskill
update-strategy: refresh when DSPy RLM API changes or new RLM papers drop
update-trigger: DSPy release with RLM changes, new arxiv RLM papers
update-status: current
---

# RLM Research — Recursive Language Models

Synthesized from Zhang et al. (2025), DSPy source (stanfordnlp/dspy), Prime Intellect ablations.

## What RLM Is

An inference paradigm where an LLM recursively calls itself or other LLMs through a persistent REPL environment. The LLM never sees the full context in its token window — instead, context is stored as REPL variables that the LLM inspects programmatically via code execution.

**Key insight**: Separates the *variable space* (information stored in the REPL) from the *token space* (what the LLM processes). This eliminates context rot because no single LM call handles the full context.

**Results**: RLM(GPT-5-mini) outperforms GPT-5 by 114% on OOLONG benchmark. Handles 10M+ tokens. Cheaper per query.

Paper: https://arxiv.org/abs/2512.24601
Code: https://github.com/alexzhang13/rlm
Minimal: https://github.com/alexzhang13/rlm-minimal

## Core Architecture

```
User Query
    │
    ▼
┌─────────────────────────────┐
│ Root LM (depth=0)           │
│  - receives QUERY only      │
│  - writes code to explore   │
│  - never sees full context  │
└─────────┬───────────────────┘
          │ writes code
          ▼
┌─────────────────────────────┐
│ REPL Environment            │
│  - context stored as var    │
│  - state persists between   │
│    iterations               │
│  - executes LM-written code │
│  - provides: llm_query,     │
│    llm_query_batched,       │
│    print, SUBMIT            │
└─────────┬───────────────────┘
          │ spawns
          ▼
┌─────────────────────────────┐
│ Sub-LM Calls (depth=1)     │
│  - fresh context per call   │
│  - can use tools            │
│  - returns text to REPL     │
│  - parallelizable           │
└─────────────────────────────┘
```

## Emergent Strategies (from Zhang et al.)

| Strategy | What the LM does | When |
|---|---|---|
| **Peeking** | Grabs first N chars of context to observe structure | Always first — LM doesn't know what it's looking at |
| **Grepping** | Regex/keyword search to narrow context | When looking for specific facts |
| **Partition + Map** | Chunks context, spawns sub-LM per chunk | Semantic tasks over large context |
| **Summarization** | Sub-LMs summarize subsets, root aggregates | Long documents, synthesis tasks |
| **Programmatic** | Writes code to solve the problem directly (diffs, math) | When task is computable |

## DSPy Implementation (`dspy.RLM`)

**Status**: Experimental module in DSPy. API may change.

### Constructor

```python
rlm = dspy.RLM(
    signature="context, query -> answer",  # DSPy signature
    max_iterations=15,       # max REPL turns
    max_llm_calls=50,        # cap on sub-LM calls
    max_output_chars=8192,   # truncation per REPL output
    sub_lm=cheap_lm,         # cheaper model for sub-queries
    tools=[custom_fn],       # additional callable tools
    interpreter=None,        # custom CodeInterpreter (default: PythonInterpreter/Deno+Pyodide)
    verbose=False,
)
```

### Execution Flow

1. **`forward()`** validates inputs, builds `REPLVariable` list from args
2. **Loop** up to `max_iterations`:
   a. `_execute_iteration()` → LM generates reasoning + Python code
   b. Code executed in sandboxed `CodeInterpreter`
   c. If `SUBMIT(output)` called → parse into signature outputs → return `Prediction`
   d. Else → append to `REPLHistory`, continue
3. **Fallback**: If max_iterations hit, `_extract_fallback()` tries to synthesize answer from current state

### Key Classes

| Class | Purpose |
|---|---|
| `RLM` | Main module. Extends `dspy.Module`. |
| `REPLHistory` | Immutable list of `REPLEntry` (reasoning, code, output). Append returns new instance. |
| `REPLVariable` | Metadata about a REPL variable: name, type, length, preview. Created via `from_value()`. |
| `CodeInterpreter` | ABC for sandboxed execution. Default: `PythonInterpreter` (Deno/Pyodide WASM). |
| `FinalOutput` | Returned when SUBMIT called. Parsed into `Prediction`. |

### Built-in REPL Tools

| Tool | Signature | Purpose |
|---|---|---|
| `llm_query(prompt)` | `str → str` | Single sub-LM call (up to 500K chars) |
| `llm_query_batched(prompts)` | `list[str] → list[str]` | Parallel sub-LM calls via ThreadPoolExecutor |
| `print()` | standard | See REPL output (truncated to max_output_chars) |
| `SUBMIT(...)` | `*args → FinalOutput` | Signal completion, return answer |

### State Persistence

The same `CodeInterpreter` instance is reused across all iterations within a single `forward()` call. Variables defined in iteration N are available in iteration N+1. This is how the LM builds up answers incrementally.

**Important**: State does NOT persist across `forward()` calls. Each invocation starts fresh. Cross-session persistence is not part of DSPy's RLM.

### Sub-LM Mechanics

- `_make_llm_tools()` creates `llm_query` and `llm_query_batched`
- Thread-safe call counter enforces `max_llm_calls`
- `sub_lm` parameter allows cheaper model for bulk sub-queries
- Sub-LMs can be given tools (only sub-LMs, not root LM — keeps root context clean)
- `llm_query_batched` uses `ThreadPoolExecutor` for parallelism

### Variables Info

`variables_info` is a formatted string list providing metadata (not content) about REPL variables:
- Variable name
- Type (str, list, dict, etc.)
- Total length (chars)
- Preview (first N chars, truncated)
- Description and constraints from signature

The LM sees this metadata and decides what to `print()` or process.

## Mapping to ms Tool

| DSPy RLM | ms equivalent | Status |
|---|---|---|
| Python REPL | JS eval loop (`new Function('ms', code)`) | ✅ exists |
| `llm_query()` | `ms.llm(prompt)` | ❌ missing |
| `llm_query_batched()` | `ms.llm_batch(prompts)` | ❌ missing |
| `SUBMIT(output)` | `return { _v: '...', ... }` (primitive return) | ✅ exists |
| `REPLHistory` | Not tracked — each ms call is independent | ❌ missing |
| `REPLVariable` (metadata) | `ms.discover()` / `ms.inspect()` (read-only) | ✅ partial |
| `CodeInterpreter` state persistence | No state between ms calls | ❌ missing |
| `variables_info` (preview) | Could be `ms.context` summary | ❌ missing |
| Custom tools | `ms.*` API functions | ✅ exists |
| Cross-call persistence | Not in DSPy either — this is our innovation | ❌ missing |

## What DSPy Doesn't Do (Our Opportunity)

1. **Cross-session persistence**: DSPy state dies after `forward()`. We persist across sessions.
2. **Knowledge accumulation**: DSPy starts cold every call. We compound findings.
3. **Typed collections**: DSPy variables are untyped Python objects. We can use Effect Schema.
4. **Governance integration**: Our stored objects can be governed, versioned, health-checked.
5. **Primitive rendering**: DSPy returns text. We return structured primitives for rich TUI.

## Re-Acquisition Protocol

```bash
# Paper
curl -sL https://arxiv.org/abs/2512.24601 | head -50

# DSPy source
gh api repos/stanfordnlp/dspy/contents/dspy/predict/rlm.py | jq -r .content | base64 -d | head -200

# DSPy docs
curl -sL https://raw.githubusercontent.com/stanfordnlp/dspy/main/docs/docs/api/modules/RLM.md

# Prime Intellect blog (context folding + ablations)
# https://www.primeintellect.ai/blog/rlm

# Minimal implementation
gh repo clone alexzhang13/rlm-minimal -- --depth 1
```
