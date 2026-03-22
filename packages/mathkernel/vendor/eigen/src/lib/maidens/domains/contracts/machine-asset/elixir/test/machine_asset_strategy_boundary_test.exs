defmodule Maiden.MachineAssetRuntime.StrategyBoundaryTest do
  use ExUnit.Case, async: false

  alias Maiden.MachineAssetRuntime.Agent
  alias Maiden.MachineAssetRuntime.Boundaries.{JobQueue, MachineAssetStore}
  alias Maiden.MachineAssetRuntime.MachineAssetFactory
  alias Maiden.MachineAssetRuntime.Strategies.SignalFsm

  defmodule MachineAssetStoreProbe do
    @behaviour MachineAssetStore

    @impl true
    def persist_transition(event, metadata, opts) do
      if pid = Application.get_env(:maiden_machine_asset_runtime, :boundary_probe_pid) do
        send(pid, {:persist_transition, event, metadata, opts})
      end

      :ok
    end
  end

  defmodule JobQueueProbe do
    @behaviour JobQueue

    @impl true
    def enqueue_transition(event, opts) do
      if pid = Application.get_env(:maiden_machine_asset_runtime, :boundary_probe_pid) do
        send(pid, {:enqueue_transition, event, opts})
      end

      :ok
    end
  end

  setup do
    flush_mailbox()

    old_store = Application.get_env(:maiden_machine_asset_runtime, :machine_asset_store_adapter)
    old_queue = Application.get_env(:maiden_machine_asset_runtime, :job_queue_adapter)
    old_probe = Application.get_env(:maiden_machine_asset_runtime, :boundary_probe_pid)

    Application.put_env(:maiden_machine_asset_runtime, :machine_asset_store_adapter, MachineAssetStoreProbe)
    Application.put_env(:maiden_machine_asset_runtime, :job_queue_adapter, JobQueueProbe)
    Application.put_env(:maiden_machine_asset_runtime, :boundary_probe_pid, self())

    on_exit(fn ->
      restore_env(:machine_asset_store_adapter, old_store)
      restore_env(:job_queue_adapter, old_queue)
      restore_env(:boundary_probe_pid, old_probe)
    end)

    :ok
  end

  test "strategy emits boundary directives for successful transition" do
    agent =
      Agent.new(
        id: "machine-asset-agent-boundary-001",
        state:
          MachineAssetFactory.new_machine_asset(
            slug: "boundary-001",
            name: "Boundary Machine",
            status: "commissioned",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    {:ok, next_agent, unresolved} =
      Agent.apply_signal_sync(agent, "machine_asset.transition.operational", %{
        "machine_id" => agent.state.machine_id,
        "from" => "commissioned",
        "to" => "operational",
        "at" => "2026-02-24T03:05:00Z",
        "reason" => "commissioning_complete",
        "initiated_by" => "technician-a"
      })

    assert next_agent.state.status == "operational"
    assert unresolved == []

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "operational"
    assert event.machine_id == agent.state.machine_id
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, job_event, job_opts}, 1_000
    assert job_event.to == "operational"
    assert Keyword.get(job_opts, :queue) == :machine_asset_runtime_transition
  end

  test "directive executors are registered for boundary directives" do
    persist_impl =
      Jido.AgentServer.DirectiveExec.impl_for(%Maiden.MachineAssetRuntime.Directives.PersistTransition{
        event: %{},
        metadata: %{}
      })

    enqueue_impl =
      Jido.AgentServer.DirectiveExec.impl_for(%Maiden.MachineAssetRuntime.Directives.EnqueueTransitionJob{
        event: %{},
        opts: []
      })

    assert persist_impl != nil
    assert enqueue_impl != nil
  end

  test "illegal transitions do not emit boundary directives" do
    agent =
      Agent.new(
        id: "machine-asset-agent-boundary-illegal",
        state:
          MachineAssetFactory.new_machine_asset(
            slug: "boundary-illegal",
            name: "Illegal Boundary Machine",
            status: "operational",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    assert {:error, %{validator: :fsm}} =
             Agent.apply_signal_sync(agent, "machine_asset.transition.decommissioned", %{
               "machine_id" => agent.state.machine_id,
               "from" => "operational",
               "to" => "decommissioned",
               "at" => "2026-02-24T03:20:00Z"
             })

    refute_receive {:persist_transition, _, _, _}, 200
    refute_receive {:enqueue_transition, _, _}, 200
  end

  test "strategy routes reserve high priority for orchestration signals" do
    routes = SignalFsm.signal_routes(%{agent_module: Agent, strategy_opts: []})

    assert {"machine_asset.runtime.strategy.tick", {:strategy_tick}, tick_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "machine_asset.runtime.strategy.tick" end)

    assert {"machine_asset.runtime.persist.flush", {:strategy_cmd, :flush_persistence},
            flush_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "machine_asset.runtime.persist.flush" end)

    assert tick_priority >= 50
    assert flush_priority >= 50
  end

  defp restore_env(key, nil), do: Application.delete_env(:maiden_machine_asset_runtime, key)
  defp restore_env(key, value), do: Application.put_env(:maiden_machine_asset_runtime, key, value)

  defp flush_mailbox do
    receive do
      _ -> flush_mailbox()
    after
      0 -> :ok
    end
  end
end
