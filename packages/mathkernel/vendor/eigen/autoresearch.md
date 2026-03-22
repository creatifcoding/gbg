# Autoresearch: Effect v4 Stack VM (Domain A1)

## Goal
Research and spike an Effect-native Stack VM where `eval` accepts either:
1. A **string** (algebraic expression compiled to StackIR)
2. An **Effect program** that returns type-conformant `StackValue`

The Effect program approach should leverage Effect v4 modules deeply:
- Schema: Opcodes as validated tagged unions
- Match: Pattern dispatch on opcode types
- Stream: Execution as lazy trail stream
- TxRef/STM: Transactional stack operations
- Fiber: Cancellable execution with deadlines
- Channel/PubSub: Live trail observation
- ServiceMap.Service: VM as proper Effect service

## Metric
- **Primary**: Wall clock time (ms) to run the spike test suite
- **Direction**: Lower is better (performance regression = bad)
- Tests must all pass — crashes are `crash` status

## Benchmark Command
```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/datagrid && npx vitest run test/spike-f1b-effect-stack-vm.test.ts --reporter=verbose 2>&1
```

## Constraints
- Must use Effect v4 (from submodules/effect-smol)
- Must NOT break existing spike-f1 tests
- Must demonstrate type-safe eval accepting Effect<StackValue> | string
- Must show at least 3 Effect v4 module integrations per iteration
- Do not overfit to benchmarks — focus on design quality
- Effect programs passed to eval MUST return Schema-conformant types

## Iteration Strategy
1. Baseline: Port minimal VM to Effect service, run same ops
2. Add Schema-validated opcodes + Effect program eval
3. Add Stream-based trail + Channel observation
4. Add TxRef transactional stack + fiber cancellation
5. Add Match-based dispatch + Optic stack access
6. Performance pass: ensure Effect overhead is bounded

## Key Files
- Spike: `packages/datagrid/test/spike-f1b-effect-stack-vm.test.ts`
- Existing VM: `packages/datagrid/test/spike-f1-stack-vm.test.ts`
- Effect v4 source: `submodules/effect-smol/packages/effect/src/`
- Datagrid services: `packages/datagrid/src/services/`
