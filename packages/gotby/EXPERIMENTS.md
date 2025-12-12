# Ravyn + ADK Integration Experiments

## Experiment 1: Multi-Agent Workflow with Observable Coordination

**Goal**: Use ADK's `SequentialAgent` to orchestrate multiple sub-agents, with Ravyn Observables coordinating state transitions and side effects between them.

**Architecture**:

- `StoryAgent` (LlmAgent) - Generates a short story
- `CriticAgent` (LlmAgent) - Reviews the story
- `RevisionAgent` (BaseAgent) - Custom agent that uses Ravyn observables to trigger external revisions

**Ravyn Integration**:

- Observable: `story_generated` - emitted when StoryAgent completes
- Observable: `critique_completed` - emitted when CriticAgent finishes
- Listeners: Log events, update external state, trigger notifications

**Files to Create**:

- `src/agents/story_workflow/agent.py`
- `src/agents/story_workflow/ravyn_events.py`

---

## Experiment 2: Tool-Based Event Emission

**Goal**: Create ADK tools that emit Ravyn events, allowing the LLM to trigger observable side effects during execution.

**Architecture**:

- `ResearchAgent` (LlmAgent) with custom tools
- Tools:
  - `search_database(query: str)` - Emits `search_performed` event
  - `save_findings(data: str)` - Emits `findings_saved` event
- Ravyn listeners react to these events (logging, webhooks, etc.)

**Ravyn Integration**:

- Tools decorated with `@observable(send=["event_name"])`
- Multiple listeners for each event demonstrate decoupling

**Files to Create**:

- `src/agents/research_agent/agent.py`
- `src/agents/research_agent/tools.py`
- `src/agents/research_agent/ravyn_listeners.py`

---

## Experiment 3: Session State Synchronization via Observables

**Goal**: Use Ravyn to broadcast ADK session state changes across multiple agent invocations, demonstrating reactive state management.

**Architecture**:

- `TaskCoordinator` (BaseAgent) - Manages task queue via session state
- `WorkerAgent` (BaseAgent) - Processes tasks and emits completion events
- Ravyn observables synchronize state across invocations

**Ravyn Integration**:

- Observable: `task_added` - When new task enters queue
- Observable: `task_completed` - When worker finishes
- Observable: `state_synced` - Broadcast state updates
- Listeners update shared state, trigger next worker

**Files to Create**:

- `src/agents/task_system/coordinator.py`
- `src/agents/task_system/worker.py`
- `src/agents/task_system/state_manager.py`

---

## Research Required

### ADK Documentation to Review:

1. **Tools**: https://google.github.io/adk-docs/tools/
2. **SequentialAgent**: Already viewed in `sequential_agent.py`
3. **Session State Management**: https://google.github.io/adk-docs/runtime/#session-state

### Ravyn Documentation to Review:

1. **Observables Advanced**: https://www.ravyn.dev/observables/
2. **Background Tasks**: https://www.ravyn.dev/background-tasks/
3. **Event Dispatcher internals**: How to emit events programmatically

## Implementation Order

1. Start with **Experiment 2** (Tool-based) - Simplest integration point
2. Then **Experiment 1** (Multi-agent) - Builds on SequentialAgent knowledge
3. Finally **Experiment 3** (State sync) - Most complex, requires understanding both systems deeply
