# Ravyn & ADK Integration Guide

This guide details the integration of **Ravyn** (specifically its Observables pattern) with **Google Agent Development Kit (ADK)** to build reactive, agent-driven applications.

## 1. Ravyn Overview

[Ravyn](https://www.ravyn.dev/) is a modern Python web framework built on top of Lilya and Pydantic. It emphasizes design patterns like **Observables** to create decoupled, scalable architectures.

### Key Concepts

- **Gateways**: Define routes and endpoints (similar to other frameworks).
- **Controllers**: Class-based views for organizing related endpoints.
- **Observables**: A pattern to decouple event emission from handling.
  - `@observable(send=["event_name"])`: Decorates a function to emit an event upon completion.
  - `@observable(listen=["event_name"])`: Decorates a function to execute when an event is emitted.
  - **EventDispatcher**: Manages the async execution of listeners using `anyio.create_task_group()`.

## 2. ADK Integration Pattern

The integration follows a **Trigger-Event-Action** loop:

1.  **Agent Action**: An ADK Agent performs a task (e.g., "Analyze user data").
2.  **Event Emission**: The agent's tool or the wrapping API endpoint triggers a Ravyn `@observable` event (e.g., `analysis_completed`).
3.  **Side Effects**: Multiple independent listeners react to this event:
    - Log the activity.
    - Update a database.
    - Trigger another agent.

This architecture allows you to add new behaviors (side effects) without modifying the core agent logic.

## 3. Demo Application

We have provided a `demo.py` script in `src/python/demo.py` that demonstrates this integration and includes a stress test.

### Running the Demo

Ensure you have `uv` installed.

```bash
cd packages/gotby
uv run src/python/demo.py
```

### What the Demo Does

1.  **Starts a Ravyn App**: Sets up a minimal API with Observables.
2.  **Defines an Agent**: Uses ADK to define a simple agent (mocked if no API key).
3.  **Triggers Events**: The agent "executes" a task, which hits an endpoint decorated with `@observable`.
4.  **Stress Test**: Fires a high volume of concurrent requests to demonstrate Ravyn's non-blocking event handling capabilities.

## 4. Ping/Pong Interruption Demo (Bidi Simulation)

The `src/python/demo_ping_pong.py` script demonstrates a more advanced pattern: **Interruption**.

### Scenario

1.  **Ping Agent** starts a streaming task (simulating a Bidi stream like audio generation).
2.  **Pong Agent** listens to the stream via Observables.
3.  **Interruption**: When the Pong Agent decides it has heard enough (after 3 pings), it triggers an interruption event.
4.  **Reaction**: The system handles this event and signals the Ping Agent's stream to stop immediately.

### Running the Demo

```bash
cd src/agents
adk run ping_pong_agent
```

**Web Interface:**

You can also interact with the agent via the ADK web UI:

```bash
cd src/agents
adk web --port 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

Alternatively, you can run the programmatic wrapper (useful for automated testing):

```bash
uv run src/python/demo_ping_pong.py
```

### Key Takeaway

This pattern shows how Ravyn Observables can be used to build **reactive control planes** for AI agents, allowing them to interrupt and influence each other's execution flows in real-time.

## 5. Code Structure

- `src/python/demo.py`: Basic integration and stress test.
- `src/python/demo_ping_pong.py`: Bidi streaming and interruption demo.
- `pyproject.toml`: Manages dependencies (`ravyn`, `google-adk`).

## 6. Further Reading

- [Ravyn Observables](https://www.ravyn.dev/observables/)
- [Ravyn Background Tasks](https://www.ravyn.dev/background-tasks/)
- [Google ADK](https://github.com/google/google-adk)
