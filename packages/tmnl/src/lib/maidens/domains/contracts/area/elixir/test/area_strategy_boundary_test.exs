defmodule Maiden.AreaRuntime.StrategyBoundaryTest do
  use ExUnit.Case, async: false

  alias Maiden.AreaRuntime.Agent
  alias Maiden.AreaRuntime.AreaFactory
  alias Maiden.AreaRuntime.Boundaries.{AreaStore, JobQueue}
  alias Maiden.AreaRuntime.Strategies.SignalFsm

  defmodule AreaStoreProbe do
    @behaviour AreaStore

    @impl true
    def persist_transition(event, metadata, opts) do
      if pid = Application.get_env(:maiden_area_runtime, :boundary_probe_pid) do
        send(pid, {:persist_transition, event, metadata, opts})
      end

      :ok
    end
  end

  defmodule JobQueueProbe do
    @behaviour JobQueue

    @impl true
    def enqueue_transition(event, opts) do
      if pid = Application.get_env(:maiden_area_runtime, :boundary_probe_pid) do
        send(pid, {:enqueue_transition, event, opts})
      end

      :ok
    end
  end

  setup do
    flush_mailbox()

    old_store = Application.get_env(:maiden_area_runtime, :area_store_adapter)
    old_queue = Application.get_env(:maiden_area_runtime, :job_queue_adapter)
    old_probe = Application.get_env(:maiden_area_runtime, :boundary_probe_pid)

    Application.put_env(:maiden_area_runtime, :area_store_adapter, AreaStoreProbe)
    Application.put_env(:maiden_area_runtime, :job_queue_adapter, JobQueueProbe)
    Application.put_env(:maiden_area_runtime, :boundary_probe_pid, self())

    on_exit(fn ->
      restore_env(:area_store_adapter, old_store)
      restore_env(:job_queue_adapter, old_queue)
      restore_env(:boundary_probe_pid, old_probe)
    end)

    :ok
  end

  test "strategy emits boundary directives for successful transition" do
    agent =
      Agent.new(
        id: "area-agent-boundary-001",
        state:
          AreaFactory.new_area(
            slug: "boundary-001",
            name: "Boundary Area",
            status: "active",
            enterprise_id: "ENT-acme",
            site_id: "SIT-cleveland",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    {:ok, next_agent, unresolved} =
      Agent.apply_signal_sync(agent, "area.transition.restricted", %{
        "area_id" => agent.state.area_id,
        "from" => "active",
        "to" => "restricted",
        "at" => "2026-02-24T03:05:00Z",
        "reason" => "inventory_lock",
        "by" => "operator-b"
      })

    assert next_agent.state.status == "restricted"
    assert unresolved == []

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "restricted"
    assert event.area_id == agent.state.area_id
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, job_event, job_opts}, 1_000
    assert job_event.to == "restricted"
    assert Keyword.get(job_opts, :queue) == :area_runtime_transition
  end

  test "directive executors are registered for boundary directives" do
    persist_impl =
      Jido.AgentServer.DirectiveExec.impl_for(%Maiden.AreaRuntime.Directives.PersistTransition{
        event: %{},
        metadata: %{}
      })

    enqueue_impl =
      Jido.AgentServer.DirectiveExec.impl_for(%Maiden.AreaRuntime.Directives.EnqueueTransitionJob{
        event: %{},
        opts: []
      })

    assert persist_impl != nil
    assert enqueue_impl != nil
  end

  test "illegal transitions do not emit boundary directives" do
    agent =
      Agent.new(
        id: "area-agent-boundary-illegal",
        state:
          AreaFactory.new_area(
            slug: "boundary-illegal",
            name: "Illegal Boundary Area",
            status: "restricted",
            enterprise_id: "ENT-acme",
            site_id: "SIT-cleveland",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    assert {:error, %{validator: :fsm}} =
             Agent.apply_signal_sync(agent, "area.transition.decommissioned", %{
               "area_id" => agent.state.area_id,
               "from" => "restricted",
               "to" => "decommissioned",
               "at" => "2026-02-24T03:20:00Z"
             })

    refute_receive {:persist_transition, _, _, _}, 200
    refute_receive {:enqueue_transition, _, _}, 200
  end

  test "strategy routes reserve high priority for orchestration signals" do
    routes = SignalFsm.signal_routes(%{agent_module: Agent, strategy_opts: []})

    assert {"area.runtime.strategy.tick", {:strategy_tick}, tick_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "area.runtime.strategy.tick" end)

    assert {"area.runtime.persist.flush", {:strategy_cmd, :flush_persistence}, flush_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "area.runtime.persist.flush" end)

    assert tick_priority >= 50
    assert flush_priority >= 50
  end

  defp restore_env(key, nil), do: Application.delete_env(:maiden_area_runtime, key)
  defp restore_env(key, value), do: Application.put_env(:maiden_area_runtime, key, value)

  defp flush_mailbox do
    receive do
      _ -> flush_mailbox()
    after
      0 -> :ok
    end
  end
end
