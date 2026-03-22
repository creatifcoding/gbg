# Conductor Chat RVN Compound Modularization Design v1 (Draft)

Date: 2026-02-11  
Owner: Val  
Status: **Pending intention alignment**

## Why this doc

You asked for a deeper component architecture pass:
- each component in directories,
- compound parts split into separate files,
- assembled via a root composer,
- exported cleanly from `index.ts`.

Before implementation, this document captures the structural proposal and the key intention decisions that should be locked.

---

## Proposed modularization target

## 1) `RvnChatFrame`

### Current
- Single file: `src/lib/rvn/chat/RvnChatFrame.tsx`

### Proposed
- `src/lib/rvn/chat/RvnChatFrame/`
  - `Root.tsx`
  - `Header.tsx`
  - `CommandRail.tsx`
  - `Thread.tsx`
  - `Composer.tsx`
  - `context.ts`
  - `types.ts`
  - `index.ts`

---

## 2) `RvnChatMessage`

### Current
- Single file: `src/lib/rvn/chat/RvnChatMessage.tsx`

### Proposed
- `src/lib/rvn/chat/RvnChatMessage/`
  - `Root.tsx`
  - `Meta.tsx`
  - `Body.tsx`
  - `Footer.tsx`
  - `User.tsx`
  - `Assistant.tsx`
  - `System.tsx`
  - `context.ts`
  - `types.ts`
  - `index.ts`

---

## 3) `RvnComposerContentEditable`

### Current
- Single file: `src/lib/rvn/chat/RvnComposerContentEditable.tsx`

### Proposed
- `src/lib/rvn/chat/RvnComposerContentEditable/`
  - `Root.tsx`
  - `hooks.ts` (selection sync, controlled/uncontrolled helpers)
  - `types.ts`
  - `index.ts`

---

## 4) `RvnStatusChip`

### Current
- Single file: `src/lib/rvn/chat/RvnStatusChip.tsx`

### Proposed
- `src/lib/rvn/chat/RvnStatusChip/`
  - `Root.tsx`
  - `types.ts`
  - `index.ts`

---

## 5) package-level exports

- `src/lib/rvn/chat/index.ts`
  - re-export all feature directories only
- `src/lib/rvn/index.ts`
  - re-export `./chat`

---

## Compound strategy (recommended)

1. **Compound namespace stays intact** for consumer ergonomics:
   - `RvnChatFrame.Root/Header/...`
   - `RvnChatMessage.Root/Meta/Body/Footer/User/Assistant/System`
2. **Each subcomponent in one file** (single-element wrapping rule).
3. **Context per compound family**, with strict usage guard helpers.
4. **No inline style constants** except runtime CSS-variable injection where needed.
5. **Motion wrappers colocated with the component that owns interaction semantics**.

---

## Risks if done without alignment

1. Over-fragmentation (too many files with weak semantic boundaries).
2. Wrong ownership for motion logic (root vs leaf confusion).
3. API churn in `ConductorAgentChat.tsx` while behavior is still stabilizing.
4. Export noise if namespace and direct exports both leak too broadly.

---

## Decision points (must lock before implementation)

1. **Depth preference**: strict one-slot-per-file vs grouped sub-slots.
2. **Motion ownership**: root-only vs leaf-level micro-interactions.
3. **API shape**: namespace-only vs namespace + direct named exports.
4. **Composer contract**: controlled-only vs controllable.
5. **Styling ownership**: shared `rvn-chat*.css` vs per-component css modules.
6. **Migration strategy**: big-bang or phased component swap in `ConductorAgentChat`.

---

## Execution plan after alignment

Once intention is confirmed, implementation proceeds in this order:

1. Directory scaffolding + types/context extraction.
2. Move subcomponents file-by-file with no behavior changes.
3. Recompose root compound exports via local `index.ts`.
4. Keep existing tests green after each family migration.
5. Re-run focused checks only (`tsc`, conductor regression + hardcut tests).

---

## Decision lock (questionnaire run: `conductor-chat-rvn-modularization-intent-v1`)

Resolved:

1. **File-splitting depth:** `strict-slot-per-file`
   - Rationale: extension-first clarity and high-speed slot-level iteration.
2. **Motion ownership:** `leaf-owned`
   - Leaf components own micro-interactions; shared animation helpers allowed.
3. **API shape:** `namespace-only`
   - Example: `RvnChatMessage.Meta`.
4. **Composer contract:** `controllable`
   - `value/defaultValue/onValueChange`.
5. **Styling ownership:** `hybrid-styles`
   - Shared base styles + component overlays.
6. **Migration strategy:** `big-bang`
   - Full swap instead of phased migration.

Non-negotiables (now provided):

- Port `react-app.js` component language near-verbatim.
- Enhance where needed.
- Make it truly usable in the real runtime (not static demo-only).

Unanswered / requires explicit follow-up:

- Composer IME/selection strict requirements (if any special constraints beyond current behavior).

## Alignment status

**Locked for execution.** Structural strategy + non-negotiable mission constraints are now explicit.
