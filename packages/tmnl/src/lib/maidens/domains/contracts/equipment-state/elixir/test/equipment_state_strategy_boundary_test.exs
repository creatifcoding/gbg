defmodule Maiden.EquipmentStateRuntime.StrategyBoundaryTest do
  use ExUnit.Case, async: false

  @jido_instance Maiden.EquipmentStateRuntime.StrategyBoundaryTest.Jido

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.EquipmentStateRuntime.Agent
  alias Maiden.EquipmentStateRuntime.Boundaries.{EquipmentStateStore, JobQueue}
  alias Maiden.EquipmentStateRuntime.EquipmentStateId
  alias Maiden.EquipmentStateRuntime.Strategies.SignalFsm

  defmodule EquipmentStateStoreProbe do
    @behaviour EquipmentStateStore

    @impl true
    def persist_transition(event, metadata, opts) do
      if pid = Application.get_env(:maiden_equipment_state_runtime, :boundary_probe_pid) do
        send(pid, {:persist_transition, event, metadata, opts})
      end

      :ok
    end
  end

  defmodule JobQueueProbe do
    @behaviour JobQueue

    @impl true
    def enqueue_transition(event, opts) do
      if pid = Application.get_env(:maiden_equipment_state_runtime, :boundary_probe_pid) do
        send(pid, {:enqueue_transition, event, opts})
      end

      :ok
    end
  end

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start(name: @jido_instance) do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  setup do
    flush_mailbox()

    old_store = Application.get_env(:maiden_equipment_state_runtime, :equipment_state_store_adapter)
    old_queue = Application.get_env(:maiden_equipment_state_runtime, :job_queue_adapter)
    old_probe = Application.get_env(:maiden_equipment_state_runtime, :boundary_probe_pid)

    Application.put_env(
      :maiden_equipment_state_runtime,
      :equipment_state_store_adapter,
      EquipmentStateStoreProbe
    )

    Application.put_env(:maiden_equipment_state_runtime, :job_queue_adapter, JobQueueProbe)
    Application.put_env(:maiden_equipment_state_runtime, :boundary_probe_pid, self())

    on_exit(fn ->
      restore_env(:equipment_state_store_adapter, old_store)
      restore_env(:job_queue_adapter, old_queue)
      restore_env(:boundary_probe_pid, old_probe)
    end)

    :ok
  end

  test "strategy emits boundary directives for successful transition" do
    agent =
      Agent.new(
        id: "equipment-state-agent-boundary-001",
        state: %{
          equipment_state_id: equipment_state_id("EST-BOUNDARY-001"),
          machine_id: "MCH-B-001",
          state: "running",
          reason: "production",
          started_at: "2026-02-24T03:00:00Z",
          ended_at: nil,
          operator_id: "operator-b",
          notes: nil,
          metadata: %{}
        }
      )

    {:ok, next_agent, unresolved} =
      Agent.apply_signal_sync(agent, "equipment_state.transition.idle", %{
        "equipment_state_id" => equipment_state_id("EST-BOUNDARY-001"),
        "machine_id" => "MCH-B-001",
        "from" => "running",
        "to" => "idle",
        "at" => "2026-02-24T03:05:00Z",
        "reason" => "no_order",
        "operator_id" => "operator-b"
      })

    assert next_agent.state.state == "idle"
    assert unresolved == []

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "idle"
    assert event.equipment_state_id == equipment_state_id("EST-BOUNDARY-001")
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, job_event, job_opts}, 1_000
    assert job_event.to == "idle"
    assert Keyword.get(job_opts, :queue) == :equipment_state_runtime_transition
  end

  test "agent server executes boundary directive handlers on sensor signal path" do
    agent_id = "equipment-state-agent-boundary-server-#{System.unique_integer([:positive])}"

    {:ok, agent_server_pid} =
      AgentServer.start_link(
        jido: @jido_instance,
        agent: Agent,
        id: agent_id,
        initial_state: %{
          equipment_state_id: equipment_state_id("EST-BOUNDARY-002"),
          machine_id: "MCH-B-002",
          state: "idle",
          reason: "no_operator",
          started_at: "2026-02-24T03:00:00Z",
          ended_at: nil,
          operator_id: "operator-c",
          notes: nil,
          metadata: %{}
        }
      )

    on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

    {:ok, sensor_pid} =
      SensorRuntime.start_link(
        sensor: Maiden.EquipmentStateRuntime.Sensors.TransitionSensor,
        config: %{source: "/sensor/equipment-state-boundary"},
        context: %{agent_ref: agent_server_pid},
        id: "sensor-boundary-#{System.unique_integer([:positive])}"
      )

    on_exit(fn -> Process.exit(sensor_pid, :normal) end)

    :ok =
      SensorRuntime.event(sensor_pid, %{
        "equipment_state_id" => equipment_state_id("EST-BOUNDARY-002"),
        "machine_id" => "MCH-B-002",
        "from" => "idle",
        "to" => "planned_downtime",
        "at" => "2026-02-24T03:10:00Z",
        "reason" => "scheduled_maintenance"
      })

    {:ok, server_state} =
      await_agent_server_state(agent_server_pid, fn state ->
        state.agent.state.state == "planned_downtime" and
          state.agent.state.reason == "scheduled_maintenance"
      end)

    assert server_state.agent.state.state == "planned_downtime"

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "planned_downtime"
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, event, opts}, 1_000
    assert event.to == "planned_downtime"
    assert Keyword.get(opts, :queue) == :equipment_state_runtime_transition
  end

  test "illegal transitions do not emit boundary directives" do
    agent =
      Agent.new(
        id: "equipment-state-agent-boundary-illegal",
        state: %{
          equipment_state_id: equipment_state_id("EST-BOUNDARY-ILLEGAL"),
          machine_id: "MCH-B-ILLEGAL",
          state: "running",
          reason: "production",
          started_at: "2026-02-24T03:00:00Z",
          ended_at: nil,
          operator_id: nil,
          notes: nil,
          metadata: %{}
        }
      )

    assert {:error, %{validator: :fsm}} =
             Agent.apply_signal_sync(agent, "equipment_state.transition.running", %{
               "equipment_state_id" => equipment_state_id("EST-BOUNDARY-ILLEGAL"),
               "machine_id" => "MCH-B-ILLEGAL",
               "from" => "running",
               "to" => "running",
               "at" => "2026-02-24T03:20:00Z",
               "reason" => "production"
             })

    refute_receive {:persist_transition, _, _, _}, 200
    refute_receive {:enqueue_transition, _, _}, 200
  end

  test "strategy routes reserve high priority for orchestration signals" do
    routes = SignalFsm.signal_routes(%{agent_module: Agent, strategy_opts: []})

    assert {"equipment_state.runtime.strategy.tick", {:strategy_tick}, tick_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "equipment_state.runtime.strategy.tick" end)

    assert {"equipment_state.runtime.persist.flush", {:strategy_cmd, :flush_persistence},
            flush_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "equipment_state.runtime.persist.flush" end)

    assert tick_priority >= 50
    assert flush_priority >= 50
  end

  defp restore_env(key, nil), do: Application.delete_env(:maiden_equipment_state_runtime, key)

  defp restore_env(key, value),
    do: Application.put_env(:maiden_equipment_state_runtime, key, value)

  defp equipment_state_id(slug) do
    EquipmentStateId.make(slug, deterministic_uuid(slug))
  end

  defp deterministic_uuid(slug) do
    hash = :crypto.hash(:sha256, slug) |> Base.encode16(case: :lower)

    <<a::binary-size(8), b::binary-size(4), c::binary-size(3), d::binary-size(3),
      e::binary-size(12), _::binary>> = hash

    "#{a}-#{b}-4#{c}-8#{d}-#{e}"
  end

  defp await_agent_server_state(agent_server_pid, predicate, attempts \\ 20)

  defp await_agent_server_state(_agent_server_pid, _predicate, 0), do: {:error, :timeout}

  defp await_agent_server_state(agent_server_pid, predicate, attempts) do
    case AgentServer.state(agent_server_pid) do
      {:ok, state} ->
        if predicate.(state) do
          {:ok, state}
        else
          Process.sleep(50)
          await_agent_server_state(agent_server_pid, predicate, attempts - 1)
        end

      error ->
        error
    end
  end

  defp flush_mailbox do
    receive do
      _ -> flush_mailbox()
    after
      0 -> :ok
    end
  end
end
