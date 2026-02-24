defmodule Maiden.DeviceRuntime.StrategyBoundaryTest do
  use ExUnit.Case, async: false

  alias Maiden.DeviceRuntime.Agent
  alias Maiden.DeviceRuntime.Boundaries.{DeviceStore, JobQueue}
  alias Maiden.DeviceRuntime.DeviceFactory
  alias Maiden.DeviceRuntime.Strategies.SignalFsm

  defmodule DeviceStoreProbe do
    @behaviour DeviceStore

    @impl true
    def persist_transition(event, metadata, opts) do
      if pid = Application.get_env(:maiden_device_runtime, :boundary_probe_pid) do
        send(pid, {:persist_transition, event, metadata, opts})
      end

      :ok
    end
  end

  defmodule JobQueueProbe do
    @behaviour JobQueue

    @impl true
    def enqueue_transition(event, opts) do
      if pid = Application.get_env(:maiden_device_runtime, :boundary_probe_pid) do
        send(pid, {:enqueue_transition, event, opts})
      end

      :ok
    end
  end

  setup do
    ensure_jido_started()
    flush_mailbox()

    old_store = Application.get_env(:maiden_device_runtime, :device_store_adapter)
    old_queue = Application.get_env(:maiden_device_runtime, :job_queue_adapter)
    old_probe = Application.get_env(:maiden_device_runtime, :boundary_probe_pid)

    Application.put_env(:maiden_device_runtime, :device_store_adapter, DeviceStoreProbe)
    Application.put_env(:maiden_device_runtime, :job_queue_adapter, JobQueueProbe)
    Application.put_env(:maiden_device_runtime, :boundary_probe_pid, self())

    on_exit(fn ->
      restore_env(:device_store_adapter, old_store)
      restore_env(:job_queue_adapter, old_queue)
      restore_env(:boundary_probe_pid, old_probe)
    end)

    :ok
  end

  test "strategy emits boundary directives for successful transition" do
    agent =
      Agent.new(
        id: "device-agent-boundary-001",
        state:
          DeviceFactory.new_device(
            slug: "boundary-001",
            name: "Boundary Device",
            status: "provisioned",
            device_type: "motor",
            machine_id: "MCH-boundary-1",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    {:ok, next_agent, unresolved} =
      Agent.apply_signal_sync(agent, "device.transition.online", %{
        "device_id" => agent.state.device_id,
        "from" => "provisioned",
        "to" => "online",
        "action" => "GoOnline",
        "at" => "2026-02-24T03:05:00Z",
        "reason" => "order_released",
        "initiated_by" => "operator-b"
      })

    assert next_agent.state.status == "online"
    assert unresolved == []

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "online"
    assert event.device_id == agent.state.device_id
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, job_event, job_opts}, 1_000
    assert job_event.to == "online"
    assert Keyword.get(job_opts, :queue) == :device_runtime_transition
  end

  test "directive executors are registered for boundary directives" do
    persist_impl =
      Jido.AgentServer.DirectiveExec.impl_for(%Maiden.DeviceRuntime.Directives.PersistTransition{
        event: %{},
        metadata: %{}
      })

    enqueue_impl =
      Jido.AgentServer.DirectiveExec.impl_for(%Maiden.DeviceRuntime.Directives.EnqueueTransitionJob{
        event: %{},
        opts: []
      })

    assert persist_impl != nil
    assert enqueue_impl != nil
  end

  test "illegal transitions do not emit boundary directives" do
    agent =
      Agent.new(
        id: "device-agent-boundary-illegal",
        state:
          DeviceFactory.new_device(
            slug: "boundary-illegal",
            name: "Illegal Boundary Device",
            status: "online",
            device_type: "motor",
            machine_id: "MCH-boundary-2",
            created_at: "2026-02-24T03:00:00Z"
          )
      )

    assert {:error, %{validator: :fsm}} =
             Agent.apply_signal_sync(agent, "device.transition.decommissioned", %{
               "device_id" => agent.state.device_id,
               "from" => "online",
               "to" => "decommissioned",
               "at" => "2026-02-24T03:20:00Z"
             })

    refute_receive {:persist_transition, _, _, _}, 200
    refute_receive {:enqueue_transition, _, _}, 200
  end

  test "strategy routes reserve high priority for orchestration signals" do
    routes = SignalFsm.signal_routes(%{agent_module: Agent, strategy_opts: []})

    assert {"device.runtime.strategy.tick", {:strategy_tick}, tick_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "device.runtime.strategy.tick" end)

    assert {"device.runtime.persist.flush", {:strategy_cmd, :flush_persistence}, flush_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "device.runtime.persist.flush" end)

    assert tick_priority >= 50
    assert flush_priority >= 50
  end

  defp ensure_jido_started do
    Application.ensure_all_started(:jido)

    if Process.whereis(Jido.Default.Registry) == nil do
      case Jido.start() do
        {:ok, _pid} -> :ok
        {:error, {:already_started, _pid}} -> :ok
      end
    else
      :ok
    end
  end

  defp restore_env(key, nil), do: Application.delete_env(:maiden_device_runtime, key)
  defp restore_env(key, value), do: Application.put_env(:maiden_device_runtime, key, value)

  defp flush_mailbox do
    receive do
      _ -> flush_mailbox()
    after
      0 -> :ok
    end
  end
end
