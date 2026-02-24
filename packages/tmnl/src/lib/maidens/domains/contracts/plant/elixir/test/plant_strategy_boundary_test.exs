defmodule Maiden.PlantRuntime.StrategyBoundaryTest do
  use ExUnit.Case, async: false

  alias Maiden.PlantRuntime.Agent
  alias Maiden.PlantRuntime.Boundaries.{JobQueue, PlantStore}
  alias Maiden.PlantRuntime.PlantFactory
  alias Maiden.PlantRuntime.Strategies.SignalFsm

  defmodule PlantStoreProbe do
    @behaviour PlantStore

    @impl true
    def persist_transition(event, metadata, opts) do
      if pid = Application.get_env(:maiden_plant_runtime, :boundary_probe_pid) do
        send(pid, {:persist_transition, event, metadata, opts})
      end

      :ok
    end
  end

  defmodule JobQueueProbe do
    @behaviour JobQueue

    @impl true
    def enqueue_transition(event, opts) do
      if pid = Application.get_env(:maiden_plant_runtime, :boundary_probe_pid) do
        send(pid, {:enqueue_transition, event, opts})
      end

      :ok
    end
  end

  setup do
    flush_mailbox()

    old_store = Application.get_env(:maiden_plant_runtime, :plant_store_adapter)
    old_queue = Application.get_env(:maiden_plant_runtime, :job_queue_adapter)
    old_probe = Application.get_env(:maiden_plant_runtime, :boundary_probe_pid)

    Application.put_env(:maiden_plant_runtime, :plant_store_adapter, PlantStoreProbe)
    Application.put_env(:maiden_plant_runtime, :job_queue_adapter, JobQueueProbe)
    Application.put_env(:maiden_plant_runtime, :boundary_probe_pid, self())

    on_exit(fn ->
      restore_env(:plant_store_adapter, old_store)
      restore_env(:job_queue_adapter, old_queue)
      restore_env(:boundary_probe_pid, old_probe)
    end)

    :ok
  end

  test "strategy emits boundary directives for successful transition" do
    agent =
      Agent.new(
        id: "plant-agent-boundary-001",
        state:
          PlantFactory.new_plant(
            slug: "boundary-001",
            name: "Boundary Plant",
            status: "commissioning",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    {:ok, next_agent, unresolved} =
      Agent.apply_signal_sync(agent, "plant.transition.operational", %{
        "plant_id" => agent.state.plant_id,
        "from" => "commissioning",
        "to" => "operational",
        "at" => "2026-02-24T03:05:00Z",
        "reason" => "commission_complete",
        "initiated_by" => "operator-b"
      })

    assert next_agent.state.status == "operational"
    assert unresolved == []

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "operational"
    assert event.plant_id == agent.state.plant_id
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, job_event, job_opts}, 1_000
    assert job_event.to == "operational"
    assert Keyword.get(job_opts, :queue) == :plant_runtime_transition
  end

  test "directive executors are registered for boundary directives" do
    persist_impl =
      Jido.AgentServer.DirectiveExec.impl_for(%Maiden.PlantRuntime.Directives.PersistTransition{
        event: %{},
        metadata: %{}
      })

    enqueue_impl =
      Jido.AgentServer.DirectiveExec.impl_for(%Maiden.PlantRuntime.Directives.EnqueueTransitionJob{
        event: %{},
        opts: []
      })

    assert persist_impl != nil
    assert enqueue_impl != nil
  end

  test "illegal transitions do not emit boundary directives" do
    agent =
      Agent.new(
        id: "plant-agent-boundary-illegal",
        state:
          PlantFactory.new_plant(
            slug: "boundary-illegal",
            name: "Illegal Boundary Plant",
            status: "commissioning",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    assert {:error, %{validator: :fsm}} =
             Agent.apply_signal_sync(agent, "plant.transition.decommissioned", %{
               "plant_id" => agent.state.plant_id,
               "from" => "commissioning",
               "to" => "decommissioned",
               "at" => "2026-02-24T03:20:00Z"
             })

    refute_receive {:persist_transition, _, _, _}, 200
    refute_receive {:enqueue_transition, _, _}, 200
  end

  test "strategy routes reserve high priority for orchestration signals" do
    routes = SignalFsm.signal_routes(%{agent_module: Agent, strategy_opts: []})

    assert {"plant.runtime.strategy.tick", {:strategy_tick}, tick_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "plant.runtime.strategy.tick" end)

    assert {"plant.runtime.persist.flush", {:strategy_cmd, :flush_persistence}, flush_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "plant.runtime.persist.flush" end)

    assert tick_priority >= 50
    assert flush_priority >= 50
  end

  defp restore_env(key, nil), do: Application.delete_env(:maiden_plant_runtime, key)
  defp restore_env(key, value), do: Application.put_env(:maiden_plant_runtime, key, value)

  defp flush_mailbox do
    receive do
      _ -> flush_mailbox()
    after
      0 -> :ok
    end
  end
end
