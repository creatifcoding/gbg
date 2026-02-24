defmodule Maiden.AlarmRuntime.StrategyBoundaryTest do
  use ExUnit.Case, async: false

  @jido_instance Maiden.AlarmRuntime.StrategyBoundaryTest.Jido

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.AlarmRuntime.Agent
  alias Maiden.AlarmRuntime.Boundaries.{AlarmStore, JobQueue}
  alias Maiden.AlarmRuntime.AlarmId
  alias Maiden.AlarmRuntime.Strategies.SignalFsm

  defmodule AlarmStoreProbe do
    @behaviour AlarmStore

    @impl true
    def persist_transition(event, metadata, opts) do
      if pid = Application.get_env(:maiden_alarm_runtime, :boundary_probe_pid) do
        send(pid, {:persist_transition, event, metadata, opts})
      end

      :ok
    end
  end

  defmodule JobQueueProbe do
    @behaviour JobQueue

    @impl true
    def enqueue_transition(event, opts) do
      if pid = Application.get_env(:maiden_alarm_runtime, :boundary_probe_pid) do
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

    old_store = Application.get_env(:maiden_alarm_runtime, :alarm_store_adapter)
    old_queue = Application.get_env(:maiden_alarm_runtime, :job_queue_adapter)
    old_probe = Application.get_env(:maiden_alarm_runtime, :boundary_probe_pid)

    Application.put_env(:maiden_alarm_runtime, :alarm_store_adapter, AlarmStoreProbe)
    Application.put_env(:maiden_alarm_runtime, :job_queue_adapter, JobQueueProbe)
    Application.put_env(:maiden_alarm_runtime, :boundary_probe_pid, self())

    on_exit(fn ->
      restore_env(:alarm_store_adapter, old_store)
      restore_env(:job_queue_adapter, old_queue)
      restore_env(:boundary_probe_pid, old_probe)
    end)

    :ok
  end

  test "strategy emits boundary directives for successful transition" do
    agent =
      Agent.new(
        id: "alarm-agent-boundary-001",
        state: %{
          alarm_id: alarm_id("ALM-BOUNDARY-001"),
          device_id: "TMP-B-001",
          asset_id: nil,
          severity: "warning",
          state: "unacknowledged",
          message: "warning",
          triggered_at: "2026-02-24T03:00:00Z",
          acknowledged_at: nil,
          acknowledged_by: nil,
          cleared_at: nil,
          shelved_until: nil,
          suppression_reason: nil
        }
      )

    {:ok, next_agent, unresolved} =
      Agent.apply_signal_sync(agent, "alarm.transition.acknowledged", %{
        "alarm_id" => alarm_id("ALM-BOUNDARY-001"),
        "from" => "unacknowledged",
        "to" => "acknowledged",
        "at" => "2026-02-24T03:05:00Z",
        "by" => "operator-b"
      })

    assert next_agent.state.state == "acknowledged"
    assert unresolved == []

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "acknowledged"
    assert event.alarm_id == alarm_id("ALM-BOUNDARY-001")
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, job_event, job_opts}, 1_000
    assert job_event.to == "acknowledged"
    assert Keyword.get(job_opts, :queue) == :alarm_runtime_transition
  end

  test "agent server executes boundary directive handlers on sensor signal path" do
    agent_id = "alarm-agent-boundary-server-#{System.unique_integer([:positive])}"

    {:ok, agent_server_pid} =
      AgentServer.start_link(
        jido: @jido_instance,
        agent: Agent,
        id: agent_id,
        initial_state: %{
          alarm_id: alarm_id("ALM-BOUNDARY-002"),
          device_id: "TMP-B-002",
          asset_id: nil,
          severity: "critical",
          state: "acknowledged",
          message: "critical",
          triggered_at: "2026-02-24T03:00:00Z",
          acknowledged_at: "2026-02-24T03:01:00Z",
          acknowledged_by: "operator-c",
          cleared_at: nil,
          shelved_until: nil,
          suppression_reason: nil
        }
      )

    on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

    {:ok, sensor_pid} =
      SensorRuntime.start_link(
        sensor: Maiden.AlarmRuntime.Sensors.TransitionSensor,
        config: %{source: "/sensor/alarm-boundary"},
        context: %{agent_ref: agent_server_pid},
        id: "sensor-boundary-#{System.unique_integer([:positive])}"
      )

    on_exit(fn -> Process.exit(sensor_pid, :normal) end)

    :ok =
      SensorRuntime.event(sensor_pid, %{
        "alarm_id" => alarm_id("ALM-BOUNDARY-002"),
        "from" => "acknowledged",
        "to" => "shelved",
        "at" => "2026-02-24T03:10:00Z",
        "reason" => "maintenance",
        "shelved_until" => "2026-02-24T04:10:00Z"
      })

    {:ok, server_state} =
      await_agent_server_state(agent_server_pid, fn state ->
        state.agent.state.state == "shelved" and
          state.agent.state.shelved_until == "2026-02-24T04:10:00Z"
      end)

    assert server_state.agent.state.state == "shelved"

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "shelved"
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, event, opts}, 1_000
    assert event.to == "shelved"
    assert Keyword.get(opts, :queue) == :alarm_runtime_transition
  end

  test "illegal transitions do not emit boundary directives" do
    agent = Agent.new(id: "alarm-agent-boundary-illegal")

    assert {:error, %{validator: :fsm}} =
             Agent.apply_signal_sync(agent, "alarm.transition.cleared", %{
               "alarm_id" => alarm_id("ALM-BOUNDARY-ILLEGAL"),
               "from" => "unacknowledged",
               "to" => "cleared",
               "at" => "2026-02-24T03:20:00Z"
             })

    refute_receive {:persist_transition, _, _, _}, 200
    refute_receive {:enqueue_transition, _, _}, 200
  end

  test "strategy routes reserve high priority for orchestration signals" do
    routes = SignalFsm.signal_routes(%{agent_module: Agent, strategy_opts: []})

    assert {"alarm.runtime.strategy.tick", {:strategy_tick}, tick_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "alarm.runtime.strategy.tick" end)

    assert {"alarm.runtime.persist.flush", {:strategy_cmd, :flush_persistence}, flush_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "alarm.runtime.persist.flush" end)

    assert tick_priority >= 50
    assert flush_priority >= 50
  end

  defp restore_env(key, nil), do: Application.delete_env(:maiden_alarm_runtime, key)

  defp restore_env(key, value), do: Application.put_env(:maiden_alarm_runtime, key, value)

  defp alarm_id(slug) do
    AlarmId.make(slug, deterministic_uuid(slug))
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
