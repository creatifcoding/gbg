defmodule Maiden.LineRuntime.LineStrategyBoundaryTest do
  use ExUnit.Case, async: false

  alias Maiden.LineRuntime.Agent
  alias Maiden.LineRuntime.Boundaries.{JobQueue, LineStore}
  alias Maiden.LineRuntime.LineFactory
  alias Maiden.LineRuntime.Strategies.SignalFsm

  defmodule LineStoreProbe do
    @behaviour LineStore

    @impl true
    def persist_transition(event, metadata, opts) do
      if pid = Application.get_env(:maiden_line_runtime, :boundary_probe_pid) do
        send(pid, {:persist_transition, event, metadata, opts})
      end

      :ok
    end
  end

  defmodule JobQueueProbe do
    @behaviour JobQueue

    @impl true
    def enqueue_transition(event, opts) do
      if pid = Application.get_env(:maiden_line_runtime, :boundary_probe_pid) do
        send(pid, {:enqueue_transition, event, opts})
      end

      :ok
    end
  end

  setup do
    flush_mailbox()

    old_store = Application.get_env(:maiden_line_runtime, :line_store_adapter)
    old_queue = Application.get_env(:maiden_line_runtime, :job_queue_adapter)
    old_probe = Application.get_env(:maiden_line_runtime, :boundary_probe_pid)

    Application.put_env(:maiden_line_runtime, :line_store_adapter, LineStoreProbe)
    Application.put_env(:maiden_line_runtime, :job_queue_adapter, JobQueueProbe)
    Application.put_env(:maiden_line_runtime, :boundary_probe_pid, self())

    on_exit(fn ->
      restore_env(:line_store_adapter, old_store)
      restore_env(:job_queue_adapter, old_queue)
      restore_env(:boundary_probe_pid, old_probe)
    end)

    :ok
  end

  test "strategy emits boundary directives for successful transition" do
    agent =
      Agent.new(
        id: "line-agent-boundary-001",
        state:
          LineFactory.new_line(
            slug: "boundary-001",
            name: "Boundary Line",
            status: "idle",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    {:ok, next_agent, unresolved} =
      Agent.apply_signal_sync(agent, "line.transition.running", %{
        "line_id" => agent.state.line_id,
        "from" => "idle",
        "to" => "running",
        "at" => "2026-02-24T03:05:00Z",
        "reason" => "order_released",
        "initiated_by" => "operator-b"
      })

    assert next_agent.state.status == "running"
    assert unresolved == []

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "running"
    assert event.line_id == agent.state.line_id
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, job_event, job_opts}, 1_000
    assert job_event.to == "running"
    assert Keyword.get(job_opts, :queue) == :line_runtime_transition
  end

  test "directive executors are registered for boundary directives" do
    persist_impl =
      Jido.AgentServer.DirectiveExec.impl_for(%Maiden.LineRuntime.Directives.PersistTransition{
        event: %{},
        metadata: %{}
      })

    enqueue_impl =
      Jido.AgentServer.DirectiveExec.impl_for(%Maiden.LineRuntime.Directives.EnqueueTransitionJob{
        event: %{},
        opts: []
      })

    assert persist_impl != nil
    assert enqueue_impl != nil
  end

  test "illegal transitions do not emit boundary directives" do
    agent =
      Agent.new(
        id: "line-agent-boundary-illegal",
        state:
          LineFactory.new_line(
            slug: "boundary-illegal",
            name: "Illegal Boundary Line",
            status: "running",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    assert {:error, %{validator: :fsm}} =
             Agent.apply_signal_sync(agent, "line.transition.decommissioned", %{
               "line_id" => agent.state.line_id,
               "from" => "running",
               "to" => "decommissioned",
               "at" => "2026-02-24T03:20:00Z"
             })

    refute_receive {:persist_transition, _, _, _}, 200
    refute_receive {:enqueue_transition, _, _}, 200
  end

  test "strategy routes reserve high priority for orchestration signals" do
    routes = SignalFsm.signal_routes(%{agent_module: Agent, strategy_opts: []})

    assert {"line.runtime.strategy.tick", {:strategy_tick}, tick_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "line.runtime.strategy.tick" end)

    assert {"line.runtime.persist.flush", {:strategy_cmd, :flush_persistence}, flush_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "line.runtime.persist.flush" end)

    assert tick_priority >= 50
    assert flush_priority >= 50
  end

  defp restore_env(key, nil), do: Application.delete_env(:maiden_line_runtime, key)
  defp restore_env(key, value), do: Application.put_env(:maiden_line_runtime, key, value)

  defp flush_mailbox do
    receive do
      _ -> flush_mailbox()
    after
      0 -> :ok
    end
  end
end
