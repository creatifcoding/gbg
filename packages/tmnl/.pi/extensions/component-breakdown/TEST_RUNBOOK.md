# Verification Runbook — component-breakdown

## 1) Install dependencies

```bash
cd .pi/extensions/component-breakdown
bun install
```

## 2) Run extension tests

```bash
bun test
```

Expected: all tests pass.

## 3) Tool-only smoke test (no questionnaire dependency path)

```bash
bun -e "import ext from './index.ts'; const tools=[]; ext({registerTool:(t)=>tools.push(t), registerCommand:()=>{}}); const tpl=tools.find(t=>t.name==='component_breakdown_templates'); const state=tools.find(t=>t.name==='component_breakdown_state'); await tpl.execute('t1',{componentName:'SmokeSurface'}); const out=await state.execute('t2',{}); console.log(out.content[0].text);"
```

Expected:
- status = `done`
- runs = `1`
- for full payload, call state tool with `{ "view": "full" }`

## 4) Interactive pi smoke test

From project root:

1. Start pi
2. Run `/reload`
3. Ask LLM to call `component_breakdown_templates` with a component name
4. Ask LLM to call `component_breakdown_state`

Expected:
- tool output contains all template sections
- state tool shows latest request/bundle

## 5) Interactive questionnaire path

Command:

```text
/component-breakdown
```

Expected:
- questionnaire opens (if questionnaire extension is installed)
- completion triggers successful generation notification

If questionnaire extension is missing, expected graceful error message describing install requirement.
