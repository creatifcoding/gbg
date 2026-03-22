# Document Reconciler Architecture

> **ADR-RECONCILER-001** | Status: IMPLEMENTED | Phase: R.1–R.5 Complete

## Executive Summary

Custom React renderer bridging AI SDK streaming output to ProseMirror documents via react-reconciler. Achieves minimal-diff document mutations through LCS-based smart merge algorithm.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT RECONCILER SYSTEM                               │
│                                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │   AI SDK    │───▶│  Streaming  │───▶│   Smart     │───▶│  Transform  │──┐    │
│  │   6.0       │    │  Reconciler │    │   Merge     │    │   Bridge    │  │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │    │
│        │                   │                  │                  │          │    │
│        │                   │                  │                  │          │    │
│        ▼                   ▼                  ▼                  ▼          │    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │    │
│  │ Effect      │    │ Token       │    │ LCS         │    │ PM          │  │    │
│  │ Schema      │    │ Buffer      │    │ Algorithm   │    │ Transaction │  │    │
│  │ (Standard)  │    │ (JSON acc)  │    │ (O(n*m))    │    │ Steps       │  │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │    │
│                                                                             │    │
│  ┌─────────────────────────────────────────────────────────────────────────┼──┐ │
│  │                         react-reconciler                                │  │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │  │ │
│  │  │ PMHostConfig │───▶│ Instance     │───▶│ Operation    │──────────────┼──┘ │
│  │  │ (HostConfig) │    │ Tree         │    │ Queue        │              │    │
│  │  └──────────────┘    └──────────────┘    └──────────────┘              │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                             ▼    │
│                                                                   ┌─────────────┐│
│                                                                   │ EditorView  ││
│                                                                   │ (ProseMirror││
│                                                                   └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MODULE DEPENDENCIES                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │     index.ts    │ ◀── Public API
                              │   (barrel)      │
                              └────────┬────────┘
                                       │
         ┌──────────────┬──────────────┼──────────────┬──────────────┐
         │              │              │              │              │
         ▼              ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Document    │ │ Streaming   │ │ Transform   │ │ SmartMerge  │ │ components/ │
│ Reconciler  │ │ Reconciler  │ │ Bridge      │ │ .ts         │ │ index.tsx   │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │               │               │
       │               │               │               │               │
       ▼               │               │               │               │
┌─────────────┐        │               │               │               │
│ PMHostConfig│◀───────┼───────────────┼───────────────┘               │
└──────┬──────┘        │               │                               │
       │               │               ▼                               │
       │               │        ┌─────────────┐                        │
       │               └───────▶│ SmartMerge  │◀───────────────────────┘
       │                        └──────┬──────┘
       │                               │
       ▼                               ▼
┌─────────────┐                 ┌─────────────┐
│  types.ts   │◀────────────────│ schemas.ts  │
│ (core types)│                 │ (Effect.    │
└─────────────┘                 │  Schema)    │
                                └─────────────┘

LEGEND:
  ───▶  imports from
  ◀───  exports to
```

---

## 3. Data Flow Pipeline (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         END-TO-END DATA FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

  PHASE 1: INGESTION          PHASE 2: PARSING           PHASE 3: DIFFING
 ════════════════════        ════════════════════       ════════════════════

 ┌─────────────────┐         ┌─────────────────┐        ┌─────────────────┐
 │   AI SDK 6.0    │         │   TokenBuffer   │        │   SmartMerge    │
 │                 │         │                 │        │                 │
 │ streamText() ───┼────────▶│ Accumulate JSON │───────▶│ computeLCS()    │
 │ streamObject()  │  tokens │ Track depth     │ blocks │ computeMergeOps │
 │                 │         │ Detect complete │        │                 │
 └─────────────────┘         └─────────────────┘        └────────┬────────┘
                                                                 │
       ┌─────────────────────────────────────────────────────────┘
       │
       ▼
  PHASE 4: TRANSFORM          PHASE 5: COMMIT           PHASE 6: RENDER
 ════════════════════        ════════════════════       ════════════════════

 ┌─────────────────┐         ┌─────────────────┐        ┌─────────────────┐
 │ TransformBridge │         │   Transaction   │        │   EditorView    │
 │                 │         │                 │        │                 │
 │ jsonNodeToPM()  │────────▶│ tr.insert()     │───────▶│ view.dispatch() │
 │ applyMergeOps() │  steps  │ tr.delete()     │   tr   │ DOM update      │
 │                 │         │ tr.setNodeMarkup│        │                 │
 └─────────────────┘         └─────────────────┘        └─────────────────┘


                         DATA TRANSFORMATIONS
 ═══════════════════════════════════════════════════════════════════════════

   string     ──▶  JSONNode[]  ──▶  MergeOp[]  ──▶  Step[]  ──▶  Transaction
   (tokens)        (parsed)         (diff ops)      (PM ops)     (atomic)

```

---

## 4. Streaming Reconciler Sequence Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    STREAMING RECONCILER SEQUENCE                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

  AI_SDK          StreamingReconciler    TokenBuffer    SmartMerge    EditorView
    │                     │                   │             │             │
    │  pushToken(t1)      │                   │             │             │
    │────────────────────▶│                   │             │             │
    │                     │  push(t1)         │             │             │
    │                     │──────────────────▶│             │             │
    │                     │  []               │             │             │
    │                     │◀──────────────────│             │             │
    │                     │                   │             │             │
    │  pushToken(t2)      │                   │             │             │
    │────────────────────▶│                   │             │             │
    │                     │  push(t2)         │             │             │
    │                     │──────────────────▶│             │             │
    │                     │  [jsonStr]        │ ◀── complete object      │
    │                     │◀──────────────────│             │             │
    │                     │                   │             │             │
    │                     │  safeParseJSON()  │             │             │
    │                     │───────────────────┼────▶        │             │
    │                     │  JSONNode         │             │             │
    │                     │◀──────────────────┼─────        │             │
    │                     │                   │             │             │
    │                     │  pendingBlocks.push(node)       │             │
    │                     │─────────────────────────────────│             │
    │                     │                   │             │             │
    │                     │       ┌───────────────────────┐ │             │
    │                     │       │  BATCH TIMER (50ms)   │ │             │
    │                     │       └───────────────────────┘ │             │
    │                     │                   │             │             │
    │                     │  ══════ TIMER FIRES ══════     │             │
    │                     │                   │             │             │
    │                     │  mergeDocuments() │             │             │
    │                     │──────────────────────────────▶│             │
    │                     │  MergeResult      │             │             │
    │                     │◀──────────────────────────────│             │
    │                     │                   │             │             │
    │                     │  mergeIntoEditor()│             │             │
    │                     │────────────────────────────────────────────▶│
    │                     │                   │             │   dispatch()│
    │                     │◀────────────────────────────────────────────│
    │                     │                   │             │             │
    │  complete()         │                   │             │             │
    │────────────────────▶│                   │             │             │
    │                     │  flush remaining  │             │             │
    │                     │──────────────────────────────────────────▶│
    │  ReconcileResult    │                   │             │             │
    │◀────────────────────│                   │             │             │
    │                     │                   │             │             │

  LEGEND:
    ────▶  sync call
    ═════  async boundary / timer
```

---

## 5. Reconciler Lifecycle State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    STREAMING RECONCILER STATE MACHINE                            │
└─────────────────────────────────────────────────────────────────────────────────┘


                            ┌─────────────────┐
                            │                 │
                            │     IDLE        │ ◀─────────────────────────────┐
                            │                 │                               │
                            └────────┬────────┘                               │
                                     │                                        │
                                     │ createStreamingReconciler()            │
                                     ▼                                        │
                            ┌─────────────────┐                               │
                            │                 │                               │
                            │   BUFFERING     │◀──────────────┐               │
                            │                 │               │               │
                            └────────┬────────┘               │               │
                                     │                        │               │
                    ┌────────────────┼────────────────┐       │               │
                    │                │                │       │               │
                    ▼                ▼                │       │               │
         ┌──────────────┐  ┌──────────────┐          │       │               │
         │ pushToken()  │  │ maxBlocks    │          │       │               │
         │ (accumulate) │  │ reached      │          │       │               │
         └──────┬───────┘  └──────┬───────┘          │       │               │
                │                 │                   │       │               │
                │                 ▼                   │       │               │
                │        ┌─────────────────┐          │       │               │
                │        │                 │          │       │               │
                └───────▶│   BATCHING      │──────────┘       │               │
                         │  (timer armed)  │                  │               │
                         └────────┬────────┘                  │               │
                                  │                           │               │
                    ┌─────────────┼─────────────┐             │               │
                    │             │             │             │               │
                    ▼             ▼             ▼             │               │
         ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │               │
         │ timer fires  │ │ more tokens  │ │ cancel()     │   │               │
         │              │ │              │ │              │   │               │
         └──────┬───────┘ └──────┬───────┘ └──────┬───────┘   │               │
                │                │                │           │               │
                ▼                │                ▼           │               │
       ┌─────────────────┐       │       ┌─────────────────┐  │               │
       │                 │       │       │                 │  │               │
       │   APPLYING      │       └──────▶│   CANCELLED     │──┼───────────────┘
       │  (mergeInto)    │               │                 │  │
       └────────┬────────┘               └─────────────────┘  │
                │                                             │
                ▼                                             │
       ┌─────────────────┐                                    │
       │  success/error  │────────────────────────────────────┤
       └────────┬────────┘                                    │
                │                                             │
                ▼                                             │
       ┌─────────────────┐                                    │
       │                 │                                    │
       │   COMPLETE      │ ◀──── complete() ──────────────────┘
       │                 │
       └─────────────────┘


  STATES:
    IDLE       ─  No reconciler active
    BUFFERING  ─  Accumulating tokens into JSONNodes
    BATCHING   ─  Timer armed, collecting batch
    APPLYING   ─  Executing mergeIntoEditor()
    COMPLETE   ─  Stream ended, final stats available
    CANCELLED  ─  User cancelled, cleanup done

  GUARDS:
    pendingBlocks.length >= maxBlocksPerBatch  →  force immediate batch
    batchTimer expires                         →  apply current batch
    tokenBuffer.depth === 0                    →  complete JSON object
```

---

## 6. SmartMerge LCS Algorithm

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    LCS-BASED SMART MERGE ALGORITHM                               │
└─────────────────────────────────────────────────────────────────────────────────┘

  INPUT:
    oldNodes: [A, B, C, D, E]     (current document)
    newNodes: [A, C, F, D]        (AI-generated)

  STEP 1: COMPUTE BLOCK HASHES
  ═══════════════════════════════════════════════════════════════════════════════

    A ──▶ "paragraph:{}:text"     hash_A
    B ──▶ "heading:{level:1}:"    hash_B
    C ──▶ "codeBlock:{lang:ts}:"  hash_C
    D ──▶ "paragraph:{}:text"     hash_D
    E ──▶ "mapBlock:{...}:"       hash_E
    F ──▶ "scene3dBlock:{...}:"   hash_F


  STEP 2: BUILD DP TABLE
  ═══════════════════════════════════════════════════════════════════════════════

              ""    A    C    F    D
         ┌─────┬─────┬─────┬─────┬─────┐
      "" │  0  │  0  │  0  │  0  │  0  │
         ├─────┼─────┼─────┼─────┼─────┤
      A  │  0  │  1  │  1  │  1  │  1  │  ◀── A matches
         ├─────┼─────┼─────┼─────┼─────┤
      B  │  0  │  1  │  1  │  1  │  1  │
         ├─────┼─────┼─────┼─────┼─────┤
      C  │  0  │  1  │  2  │  2  │  2  │  ◀── C matches
         ├─────┼─────┼─────┼─────┼─────┤
      D  │  0  │  1  │  2  │  2  │  3  │  ◀── D matches
         ├─────┼─────┼─────┼─────┼─────┤
      E  │  0  │  1  │  2  │  2  │  3  │
         └─────┴─────┴─────┴─────┴─────┘

    LCS = [A, C, D]  (length 3)


  STEP 3: BACKTRACK & CLASSIFY
  ═══════════════════════════════════════════════════════════════════════════════

    OLD        NEW         CLASSIFICATION
    ───        ───         ──────────────
    A    ◀───▶ A           NOOP (or UPDATE if attrs differ)
    B          ─           DELETE (not in LCS, not in new)
    C    ◀───▶ C           NOOP
    ─          F           INSERT (not in LCS, in new)
    D    ◀───▶ D           NOOP
    E          ─           DELETE


  STEP 4: DETECT MOVES (hash matching across positions)
  ═══════════════════════════════════════════════════════════════════════════════

    If hash(deleted_node) === hash(inserted_node):
      ──▶ MOVE instead of DELETE + INSERT

    (In this example: no moves detected)


  STEP 5: EMIT MERGE OPS
  ═══════════════════════════════════════════════════════════════════════════════

    MergeOps = [
      { type: 'DELETE', index: 1 },        // Remove B
      { type: 'DELETE', index: 4 },        // Remove E
      { type: 'INSERT', index: 2, node: F }, // Insert F after C
      { type: 'NOOP',   index: 0 },        // A unchanged
      { type: 'NOOP',   index: 1 },        // C unchanged (new index)
      { type: 'NOOP',   index: 3 },        // D unchanged
    ]

    Sorted by: DELETE → MOVE → INSERT → UPDATE → NOOP


  COMPLEXITY:
    Time:  O(n * m)  where n, m are document lengths
    Space: O(n * m)  for DP table

```

---

## 7. react-reconciler Integration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PMHostConfig INTERFACE                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

  HostConfig<
    Type,           // string ("paragraph", "heading", etc.)
    Props,          // { attrs?, marks?, content?, text? }
    Container,      // { view, state, schema, transaction }
    Instance,       // { node: PMNode, type, props, position, children, parent }
    TextInstance,   // { text, position, parent }
    ...             // 9 more type params for React internals
  >


  RENDER PHASE (parallel tree construction)
  ═══════════════════════════════════════════════════════════════════════════════

    React Tree                          Instance Tree
    ──────────                          ─────────────
    <Doc>                               Instance { type: 'doc' }
      <Heading level={1}>        ──▶      Instance { type: 'heading', attrs: {level:1} }
        <Text>Hello</Text>       ──▶        TextInstance { text: 'Hello' }
      </Heading>
      <Paragraph>                ──▶      Instance { type: 'paragraph' }
        <Text>World</Text>       ──▶        TextInstance { text: 'World' }
      </Paragraph>
    </Doc>

    Key Methods:
      createInstance(type, props)     →  new Instance with PMNode
      createTextInstance(text)        →  new TextInstance
      appendInitialChild(parent, c)   →  parent.children.push(c)


  COMMIT PHASE (transaction construction)
  ═══════════════════════════════════════════════════════════════════════════════

    prepareForCommit(container)
      │
      │  container.transaction = container.state.tr
      ▼
    [mutation methods called]
      │
      │  appendChild()    ──▶  queueOperation({ type: 'appendChild', ... })
      │  removeChild()    ──▶  queueOperation({ type: 'removeChild', ... })
      │  commitUpdate()   ──▶  queueOperation({ type: 'setNodeMarkup', ... })
      │  commitTextUpdate ──▶  queueOperation({ type: 'updateText', ... })
      ▼
    resetAfterCommit(container)
      │
      │  ops = clearPendingOperations()
      │  applyOperations(container, ops)
      │  if (tr.docChanged) view.dispatch(tr)
      ▼
    [ProseMirror document updated]


  OPERATION QUEUE
  ═══════════════════════════════════════════════════════════════════════════════

    pendingOperations: PendingOperation[] = []

    ┌────────────────────────────────────────────────┐
    │ { type: 'appendChild',  parent, child }        │
    │ { type: 'removeChild',  parent, child }        │
    │ { type: 'insertBefore', parent, child, before }│
    │ { type: 'setNodeMarkup', instance, attrs }     │
    │ { type: 'updateText',   instance, text }       │
    └────────────────────────────────────────────────┘

    Applied to transaction in order:
      1. DELETE (high to low index to preserve positions)
      2. UPDATE (setNodeMarkup)
      3. INSERT (low to high index)

```

---

## 8. Type Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         TYPE HIERARCHY                                           │
└─────────────────────────────────────────────────────────────────────────────────┘

  CORE TYPES (types.ts)
  ═══════════════════════════════════════════════════════════════════════════════

    JSONDocument ─────────────────────────────────────────────────────────────┐
      │ type: 'doc'                                                           │
      │ content: JSONNode[]                                                   │
      │                                                                       │
      └───▶ JSONNode ─────────────────────────────────────────────────────┐   │
              │ type: string                                              │   │
              │ attrs?: Record<string, unknown>                           │   │
              │ content?: JSONNode[]  ◀──── recursive                     │   │
              │ text?: string                                             │   │
              │ marks?: JSONMark[]                                        │   │
              │                                                           │   │
              └───▶ JSONMark                                              │   │
                      │ type: string                                      │   │
                      │ attrs?: Record<string, unknown>                   │   │
                                                                          │   │
                                                                          │   │
  RECONCILER TYPES                                                        │   │
  ═══════════════════════════════════════════════════════════════════════ │ ══│══

    Container                                                             │   │
      │ view: EditorView                                                  │   │
      │ state: EditorState                                                │   │
      │ schema: PMSchema                                                  │   │
      │ transaction: Transaction | null                                   │   │
                                                                          │   │
    Instance ─────────────────────────────────────────────────────────────┤   │
      │ node: PMNode                                                      │   │
      │ type: string  ◀───────────────────────────────────────────────────┼───┘
      │ props: Props                                                      │
      │ position: number                                                  │
      │ children: Instance[]                                              │
      │ parent: Instance | null                                           │
                                                                          │
    TextInstance                                                          │
      │ text: string  ◀───────────────────────────────────────────────────┘
      │ position: number
      │ parent: Instance | null


  MERGE TYPES (SmartMerge.ts)
  ═══════════════════════════════════════════════════════════════════════════════

    MergeResult
      │ ops: MergeOp[]
      │ stats: MergeStats
      │
      └───▶ MergeOp (discriminated union)
              │ INSERT  { type, node: JSONNode, index }
              │ DELETE  { type, index }
              │ UPDATE  { type, index, from: JSONNode, to: JSONNode }
              │ MOVE    { type, fromIndex, toIndex }
              │ NOOP    { type, index }

    MergeStats
      │ inserted: number
      │ deleted: number
      │ updated: number
      │ moved: number
      │ unchanged: number


  STREAMING TYPES (StreamingReconciler.ts)
  ═══════════════════════════════════════════════════════════════════════════════

    StreamingConfig
      │ batchIntervalMs: number   (default: 50)
      │ maxBlocksPerBatch: number (default: 10)
      │ skipHistory: boolean      (default: false)

    StreamingReconcilerHandle
      │ pushToken(token: string): void
      │ complete(): Promise<ReconcileResult>
      │ cancel(): void
      │ getStats(): StreamingStats

    StreamingStats
      │ tokensReceived: number
      │ blocksProcessed: number
      │ batchesApplied: number
      │ errors: number
      │ isComplete: boolean


  SCHEMA TYPES (schemas.ts) ─── Effect.Schema
  ═══════════════════════════════════════════════════════════════════════════════

    JSONDocumentStandard ◀──── Schema.standardSchemaV1(JSONDocument)
                               ↓
                         StandardSchema (AI SDK 6.0 compatible)

    Block Schemas (TaggedStruct):
      ├── ParagraphBlockSchema
      ├── HeadingBlockSchema
      ├── CodeBlockSchema
      ├── BulletListSchema
      ├── OrderedListSchema
      ├── ListItemSchema
      ├── BlockquoteSchema
      ├── HorizontalRuleSchema
      ├── MapBlockSchema        ◀── TMNL custom
      ├── Scene3DBlockSchema    ◀── TMNL custom
      └── DataGridBlockSchema   ◀── TMNL custom

```

---

## 9. Error Handling & Edge Cases

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING STRATEGY                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

  LAYER 1: TOKEN PARSING
  ═══════════════════════════════════════════════════════════════════════════════

    TokenBuffer.push(token)
      │
      ├── Malformed JSON fragment
      │     └── Buffer accumulates, waits for more tokens
      │
      ├── Unbalanced brackets
      │     └── depth tracking prevents premature extraction
      │
      └── Complete but invalid JSON
            └── safeParseJSON() returns null, block skipped


  LAYER 2: SCHEMA VALIDATION
  ═══════════════════════════════════════════════════════════════════════════════

    Effect.Schema.decode(JSONNode)
      │
      ├── Unknown node type
      │     └── Warn + skip (console.warn in PMHostConfig)
      │
      ├── Invalid attrs shape
      │     └── Schema refinement fails, node rejected
      │
      └── Missing required fields
            └── Schema fails, ReconcilerError thrown


  LAYER 3: PM NODE CREATION
  ═══════════════════════════════════════════════════════════════════════════════

    jsonNodeToPMNode(schema, json)
      │
      ├── Unknown nodeType in schema
      │     └── console.warn + return null
      │
      ├── createAndFill() throws
      │     └── catch + warn + return null
      │
      └── Invalid content for parent
            └── PM schema validation rejects


  LAYER 4: TRANSACTION APPLICATION
  ═══════════════════════════════════════════════════════════════════════════════

    mergeIntoEditor(view, doc)
      │
      ├── Position out of bounds
      │     └── Transaction step fails, caught in applyBatch
      │
      ├── Selection mapping fails
      │     └── try/catch resets selection to doc start
      │
      └── tr.docChanged === false
            └── No dispatch, no-op


  LAYER 5: STREAMING LIFECYCLE
  ═══════════════════════════════════════════════════════════════════════════════

    StreamingReconciler
      │
      ├── Token after complete()
      │     └── Ignored (isComplete check)
      │
      ├── cancel() during batch
      │     └── Timer cleared, no more batches
      │
      └── Error during applyBatch()
            └── stats.errors++, continue processing

```

---

## 10. Performance Characteristics

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PERFORMANCE ANALYSIS                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

  COMPLEXITY
  ═══════════════════════════════════════════════════════════════════════════════

    Operation                    Time           Space         Notes
    ─────────────────────────────────────────────────────────────────────────────
    TokenBuffer.push()           O(t)           O(b)          t=token len, b=buffer
    computeLCS()                 O(n*m)         O(n*m)        n,m = doc lengths
    computeMergeOps()            O(n+m)         O(n+m)        Post-LCS processing
    jsonNodeToPMNode()           O(d)           O(d)          d = subtree depth
    applyMergeResult()           O(k*log(n))    O(1)          k = ops, PM mapping


  BATCHING TRADEOFFS
  ═══════════════════════════════════════════════════════════════════════════════

    batchIntervalMs    Latency    CPU Load    Visual Smoothness
    ─────────────────────────────────────────────────────────────
    10ms               Very Low   High        Choppy (60 updates/s)
    50ms (default)     Low        Medium      Smooth (20 updates/s)
    100ms              Medium     Low         Noticeable delay
    250ms              High       Very Low    Laggy feel


  MEMORY PROFILE
  ═══════════════════════════════════════════════════════════════════════════════

    Component             Retained Memory              When Released
    ─────────────────────────────────────────────────────────────────────────────
    TokenBuffer           O(max_incomplete_json)       On complete object
    pendingBlocks[]       O(batch_size)                After batch apply
    accumulatedBlocks[]   O(total_doc_blocks)          On complete()
    Instance tree         O(doc_size)                  Each render cycle
    LCS DP table          O(n*m)                       After computeLCS()


  RECOMMENDED CONFIGURATION
  ═══════════════════════════════════════════════════════════════════════════════

    Use Case                       batchIntervalMs    maxBlocksPerBatch
    ─────────────────────────────────────────────────────────────────────────────
    Real-time collab (fast LLM)    30                 5
    Standard streaming             50                 10
    Slow network / large docs      100                20
    Batch import (no streaming)    0                  Infinity

```

---

## 11. API Quick Reference

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PUBLIC API SURFACE                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

  STREAMING (most common usage)
  ═══════════════════════════════════════════════════════════════════════════════

    // Push tokens from AI stream
    const handle = createStreamingReconciler(view, { batchIntervalMs: 100 })
    for await (const token of aiStream) { handle.pushToken(token) }
    const result = await handle.complete()

    // Or use Effect wrapper
    const result = yield* processAIStream(view, textStream, config)


  DIRECT MERGE (non-streaming)
  ═══════════════════════════════════════════════════════════════════════════════

    // Merge JSON document directly
    import { mergeIntoEditor } from './reconciler'
    const result = mergeIntoEditor(view, jsonDocument, { addToHistory: true })


  REACT RECONCILER (programmatic JSX)
  ═══════════════════════════════════════════════════════════════════════════════

    import { DocumentReconciler, Doc, Heading, Paragraph, Text } from './reconciler'

    const reconciler = DocumentReconciler.create(view)
    await reconciler.render(
      <Doc>
        <Heading level={1}><Text>Title</Text></Heading>
        <Paragraph><Text>Content</Text></Paragraph>
      </Doc>
    )
    reconciler.unmount()


  SCHEMA FOR AI SDK
  ═══════════════════════════════════════════════════════════════════════════════

    import { JSONDocumentStandard } from './reconciler'
    import { streamObject } from 'ai'

    // Drop-in replacement for Zod schema
    const result = streamObject({
      model: anthropic('claude-3-5-sonnet'),
      schema: JSONDocumentStandard,  // ← Effect.Schema with StandardSchemaV1
      prompt: 'Generate a document...'
    })


  LOW-LEVEL UTILITIES
  ═══════════════════════════════════════════════════════════════════════════════

    // Compute diff without applying
    const { ops, stats } = computeMergeOps(oldNodes, newNodes)

    // Convert JSON to PM nodes
    const pmNode = jsonNodeToPMNode(schema, jsonNode)

    // Convert PM to JSON
    const json = pmNodeToJSON(pmNode)

    // Apply merge result manually
    const { transaction, applied } = applyMergeResult(state, mergeResult)
    if (applied) view.dispatch(transaction)

```

---

## Revision History

| Version | Date       | Author | Changes                                    |
|---------|------------|--------|--------------------------------------------|
| 1.0     | 2025-12-30 | Val    | Initial architecture, Phases R.1–R.5      |
