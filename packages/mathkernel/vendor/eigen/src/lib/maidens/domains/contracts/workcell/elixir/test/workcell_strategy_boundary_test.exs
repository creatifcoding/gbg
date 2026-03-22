defmodule Maiden.WorkcellRuntime.StrategyBoundaryTest do
  use ExUnit.Case, async: false

  alias Maiden.WorkcellRuntime.Agent
  alias Maiden.WorkcellRuntime.Boundaries.{JobQueue, WorkcellStore}
  alias Maiden.WorkcellRuntime.Strategies.SignalFsm
  alias Maiden.WorkcellRuntime.WorkcellFactory

  defmodule WorkcellStoreProbe do
    @behaviour WorkcellStore

    @impl true
    def persist_transition(event, metadata, opts) do
      if pid = Application.get_env(:maiden_workcell_runtime, :boundary_probe_pid) do
        send(pid, {:persist_transition, event, metadata, opts})
      end

      :ok
    end
  end

  defmodule JobQueueProbe do
    @behaviour JobQueue

    @impl true
    def enqueue_transition(event, opts) do
      if pid = Application.get_env(:maiden_workcell_runtime, :boundary_probe_pid) do
        send(pid, {:enqueue_transition, event, opts})
      end

      :ok
    end
  end

  setup do
    flush_mailbox()

    old_store = Application.get_env(:maiden_workcell_runtime, :workcell_store_adapter)
    old_queue = Application.get_env(:maiden_workcell_runtime, :job_queue_adapter)
    old_probe = Application.get_env(:maiden_workcell_runtime, :boundary_probe_pid)

    Application.put_env(:maiden_workcell_runtime, :workcell_store_adapter, WorkcellStoreProbe)
    Application.put_env(:maiden_workcell_runtime, :job_queue_adapter, JobQueueProbe)
    Application.put_env(:maiden_workcell_runtime, :boundary_probe_pid, self())

    on_exit(fn ->
      restore_env(:workcell_store_adapter, old_store)
      restore_env(:job_queue_adapter, old_queue)
      restore_env(:boundary_probe_pid, old_probe)
    end)

    :ok
  end

  test "strategy emits boundary directives for successful transition" do
    agent =
      Agent.new(
        id: "workcell-agent-boundary-001",
        state:
          WorkcellFactory.new_workcell(
            slug: "boundary-001",
            line_id: "LIN-main-01",
            name: "Boundary Cell",
            status: "idle",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    {:ok, next_agent, unresolved} =
      Agent.apply_signal_sync(agent, "workcell.transition.setup", %{
        "workcell_id" => agent.state.workcell_id,
        "from" => "idle",
        "to" => "setup",
        "at" => "2026-02-24T03:05:00Z",
        "reason" => "changeover_start",
        "initiated_by" => "operator-b"
      })

    assert next_agent.state.status == "setup"
    assert unresolved == []

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "setup"
    assert event.workcell_id == agent.state.workcell_id
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, job_event, job_opts}, 1_000
    assert job_event.to == "setup"
    assert Keyword.get(job_opts, :queue) == :workcell_runtime_transition
  end

  test "illegal transitions do not emit boundary directives" do
    agent =
      Agent.new(
        id: "workcell-agent-boundary-illegal",
        state:
          WorkcellFactory.new_workcell(
            slug: "boundary-illegal",
            line_id: "LIN-main-01",
            name: "Illegal Boundary Cell",
            status: "running",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    assert {:error, %{validator: :fsm}} =
             Agent.apply_signal_sync(agent, "workcell.transition.running", %{
               "workcell_id" => agent.state.workcell_id,
               "from" => "running",
               "to" => "running",
               "at" => "2026-02-24T03:20:00Z",
               "reason" => "no_change"
             })

    refute_receive {:persist_transition, _, _, _}, 200
    refute_receive {:enqueue_transition, _, _}, 200
  end

  test "strategy routes reserve high priority for orchestration signals" do
    routes = SignalFsm.signal_routes(%{agent_module: Agent, strategy_opts: []})

    assert {"workcell.runtime.strategy.tick", {:strategy_tick}, tick_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "workcell.runtime.strategy.tick" end)

    assert {"workcell.runtime.persist.flush", {:strategy_cmd, :flush_persistence}, flush_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "workcell.runtime.persist.flush" end)

    assert tick_priority >= 50
    assert flush_priority >= 50
  end

  defp restore_env(key, nil), do: Application.delete_env(:maiden_workcell_runtime, key)
  defp restore_env(key, value), do: Application.put_env(:maiden_workcell_runtime, key, value)

  defp flush_mailbox do
    receive do
      _ -> flush_mailbox()
    after
      0 -> :ok
    end
  end
end
