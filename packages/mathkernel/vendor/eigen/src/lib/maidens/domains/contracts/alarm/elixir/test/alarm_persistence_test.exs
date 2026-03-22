defmodule Maiden.AlarmRuntime.PersistenceTest do
  use ExUnit.Case, async: false

  @jido_instance Maiden.AlarmRuntime.PersistenceTest.Jido

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Jido.Thread
  alias Maiden.AlarmRuntime
  alias Maiden.AlarmRuntime.Agent
  alias Maiden.AlarmRuntime.AlarmId
  alias Maiden.AlarmRuntime.Sensors.TransitionSensor

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start(name: @jido_instance) do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  describe "snapshot/thaw" do
    test "round-trips persisted alarm runtime state" do
      table = unique_table(:alarm_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "alarm-persist-001",
          state: %{
            alarm_id: alarm_id("ALM-PERSIST-001"),
            device_id: "TMP-PERSIST-001",
            asset_id: nil,
            severity: "critical",
            state: "unacknowledged",
            message: "high temp",
            triggered_at: "2026-02-24T02:00:00Z",
            acknowledged_at: nil,
            acknowledged_by: nil,
            cleared_at: nil,
            shelved_until: nil,
            suppression_reason: nil
          }
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "alarm.transition.acknowledged", %{
          "alarm_id" => alarm_id("ALM-PERSIST-001"),
          "from" => "unacknowledged",
          "to" => "acknowledged",
          "at" => "2026-02-24T02:05:00Z",
          "by" => "operator-persist"
        })

      assert :ok = AlarmRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} =
               AlarmRuntime.thaw("alarm-persist-001", table: table)

      assert restored_agent.state.alarm_id == alarm_id("ALM-PERSIST-001")
      assert restored_agent.state.state == "acknowledged"
      assert restored_agent.state.acknowledged_by == "operator-persist"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "persists thread pointer and rehydrates thread on thaw" do
      table = unique_table(:alarm_runtime_thread)
      thread_id = "alarm-thread-#{System.unique_integer([:positive])}"

      thread =
        Thread.new(id: thread_id, metadata: %{domain: "alarm"})
        |> Thread.append(%{kind: :signal, payload: %{type: "alarm.transition.acknowledged"}})
        |> Thread.append(%{kind: :directive, payload: %{type: "RunInstruction", status: "ok"}})

      agent =
        Agent.new(
          id: "alarm-persist-thread-001",
          state: %{
            alarm_id: alarm_id("ALM-PERSIST-THREAD-001"),
            device_id: "TMP-THREAD-001",
            asset_id: nil,
            severity: "warning",
            state: "unacknowledged",
            message: nil,
            triggered_at: "2026-02-24T02:00:00Z",
            acknowledged_at: nil,
            acknowledged_by: nil,
            cleared_at: nil,
            shelved_until: nil,
            suppression_reason: nil,
            __thread__: thread
          }
        )

      assert :ok = AlarmRuntime.snapshot(agent, table: table)

      checkpoint_key = {Agent, "alarm-persist-thread-001"}

      assert {:ok, checkpoint} =
               Jido.Storage.fetch_checkpoint(Jido.Storage.ETS, checkpoint_key, table: table)

      persisted_thread = agent.state.__thread__

      refute Map.has_key?(checkpoint.state, :__thread__)
      assert checkpoint.thread.id == persisted_thread.id
      assert checkpoint.thread.rev == persisted_thread.rev

      assert {:ok, restored_agent} =
               AlarmRuntime.thaw("alarm-persist-thread-001", table: table)

      assert restored_agent.state.__thread__.id == persisted_thread.id
      assert restored_agent.state.__thread__.rev == persisted_thread.rev
      assert length(restored_agent.state.__thread__.entries) == persisted_thread.rev
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:alarm_runtime_invalid)
      key = {Agent, "alarm-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "alarm-persist-invalid",
        state: %{
          alarm_id: alarm_id("ALM-PERSIST-INVALID"),
          device_id: "TMP-BAD",
          asset_id: nil,
          severity: 123,
          state: "unacknowledged",
          message: nil,
          triggered_at: "2026-02-24T02:00:00Z",
          acknowledged_at: nil,
          acknowledged_by: nil,
          cleared_at: nil,
          shelved_until: nil,
          suppression_reason: nil
        }
      }

      assert :ok = Jido.Storage.ETS.put_checkpoint(key, invalid_checkpoint, table: table)

      assert {:error, %{validator: :ex_json_schema}} =
               AlarmRuntime.thaw("alarm-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:alarm_runtime_delete)

      agent =
        Agent.new(
          id: "alarm-persist-delete",
          state: %{
            alarm_id: alarm_id("ALM-PERSIST-DELETE"),
            device_id: "TMP-DEL",
            asset_id: nil,
            severity: "info",
            state: "cleared",
            message: nil,
            triggered_at: "2026-02-24T02:00:00Z",
            acknowledged_at: nil,
            acknowledged_by: nil,
            cleared_at: nil,
            shelved_until: nil,
            suppression_reason: nil
          }
        )

      assert :ok = AlarmRuntime.snapshot(agent, table: table)
      assert :ok = AlarmRuntime.delete_snapshot("alarm-persist-delete", table: table)
      assert {:error, :not_found} = AlarmRuntime.thaw("alarm-persist-delete", table: table)
    end
  end

  describe "restart continuity" do
    test "thaw + AgentServer restart resumes lifecycle transitions" do
      table = unique_table(:alarm_runtime_restart)
      agent_id = "alarm-persist-restart-#{System.unique_integer([:positive])}"

      base_agent =
        Agent.new(
          id: agent_id,
          state: %{
            alarm_id: alarm_id("ALM-PERSIST-RESTART-001"),
            device_id: "TMP-RESTART",
            asset_id: nil,
            severity: "critical",
            state: "acknowledged",
            message: "critical alarm",
            triggered_at: "2026-02-24T02:00:00Z",
            acknowledged_at: "2026-02-24T02:01:00Z",
            acknowledged_by: "operator-r",
            cleared_at: nil,
            shelved_until: nil,
            suppression_reason: nil
          }
        )

      {:ok, shelved_agent, []} =
        Agent.apply_signal_sync(base_agent, "alarm.transition.shelved", %{
          "alarm_id" => alarm_id("ALM-PERSIST-RESTART-001"),
          "from" => "acknowledged",
          "to" => "shelved",
          "at" => "2026-02-24T02:10:00Z",
          "reason" => "maintenance",
          "shelved_until" => "2026-02-24T03:10:00Z"
        })

      assert :ok = AlarmRuntime.snapshot(shelved_agent, table: table)
      assert {:ok, restored_agent} = AlarmRuntime.thaw(agent_id, table: table)
      assert restored_agent.state.state == "shelved"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: @jido_instance,
          agent: restored_agent,
          agent_module: Agent
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/alarm-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "sensor-restart-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "alarm_id" => alarm_id("ALM-PERSIST-RESTART-001"),
          "from" => "shelved",
          "to" => "acknowledged",
          "at" => "2026-02-24T02:20:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.state == "acknowledged" and
            state.agent.state.shelved_until == nil and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.alarm_id == alarm_id("ALM-PERSIST-RESTART-001")
      assert server_state.agent.state.state == "acknowledged"
      assert server_state.agent.state.shelved_until == nil
    end
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

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end

  defp alarm_id(slug) do
    AlarmId.make(slug, deterministic_uuid(slug))
  end

  defp deterministic_uuid(slug) do
    hash = :crypto.hash(:sha256, slug) |> Base.encode16(case: :lower)

    <<a::binary-size(8), b::binary-size(4), c::binary-size(3), d::binary-size(3),
      e::binary-size(12), _::binary>> = hash

    "#{a}-#{b}-4#{c}-8#{d}-#{e}"
  end
end
