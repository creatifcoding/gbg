defmodule Maiden.AlarmRuntime.ValidatorTest do
  use ExUnit.Case, async: false

  @jido_instance Maiden.AlarmRuntime.ValidatorTest.Jido

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.AlarmRuntime.Agent
  alias Maiden.AlarmRuntime.FSM
  alias Maiden.AlarmRuntime.AlarmId
  alias Maiden.AlarmRuntime.Sensors.TransitionSensor
  alias Maiden.AlarmRuntime.Validators.AlarmValidator

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start(name: @jido_instance) do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  describe "alarm_validate/2" do
    test "accepts valid alarm payload" do
      payload = %{
        "alarm_id" => alarm_id("ALM-001"),
        "device_id" => "TMP-001",
        "asset_id" => "ASSET-001",
        "severity" => "critical",
        "state" => "unacknowledged",
        "message" => "Over temperature",
        "triggered_at" => "2026-02-24T01:00:00Z",
        "acknowledged_at" => nil,
        "acknowledged_by" => nil,
        "cleared_at" => nil,
        "shelved_until" => nil,
        "suppression_reason" => nil
      }

      assert :ok = AlarmValidator.alarm_validate(payload)
    end

    test "rejects invalid alarm payload" do
      payload = %{
        "alarm_id" => alarm_id("ALM-002"),
        "device_id" => "TMP-002",
        "asset_id" => nil,
        "severity" => "fatal",
        "state" => "unacknowledged",
        "message" => nil,
        "triggered_at" => "2026-02-24T01:00:00Z",
        "acknowledged_at" => nil,
        "acknowledged_by" => nil,
        "cleared_at" => nil,
        "shelved_until" => nil,
        "suppression_reason" => nil
      }

      assert {:error, %{validator: :ex_json_schema, errors: _}} =
               AlarmValidator.alarm_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload = %{
        "alarm_id" => alarm_id("ALM-003"),
        "from" => "unacknowledged",
        "to" => "acknowledged",
        "at" => "2026-02-24T01:05:00Z",
        "by" => "operator-1"
      }

      assert :ok = AlarmValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_jido(payload)
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition" do
      payload = %{
        "alarm_id" => alarm_id("ALM-004"),
        "from" => "unacknowledged",
        "to" => "cleared",
        "at" => "2026-02-24T01:06:00Z"
      }

      assert :ok = AlarmValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "unacknowledged",
                to: "cleared",
                allowed_next: ["acknowledged", "shelved", "suppressed", "out_of_service"]
              }} = FSM.validate_transition_for_jido(payload)
    end
  end

  describe "Jido action and signal wiring" do
    test "acknowledged signal mutates state" do
      agent =
        Agent.new(
          id: "alarm-agent-ack",
          state: %{
            alarm_id: alarm_id("ALM-ACK-001"),
            device_id: "TMP-ACK-001",
            asset_id: nil,
            severity: "warning",
            state: "unacknowledged",
            message: "warning",
            triggered_at: "2026-02-24T01:00:00Z",
            acknowledged_at: nil,
            acknowledged_by: nil,
            cleared_at: nil,
            shelved_until: nil,
            suppression_reason: nil
          }
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "alarm.transition.acknowledged", %{
          "alarm_id" => alarm_id("ALM-ACK-001"),
          "from" => "unacknowledged",
          "to" => "acknowledged",
          "at" => "2026-02-24T01:10:00Z",
          "by" => "operator-2"
        })

      assert updated_agent.state.state == "acknowledged"
      assert updated_agent.state.acknowledged_at == "2026-02-24T01:10:00Z"
      assert updated_agent.state.acknowledged_by == "operator-2"
      assert unresolved == []
    end

    test "cleared -> unacknowledged signal reopens the alarm" do
      agent =
        Agent.new(
          id: "alarm-agent-reopen",
          state: %{
            alarm_id: alarm_id("ALM-REOPEN-001"),
            device_id: "TMP-REOPEN-001",
            asset_id: nil,
            severity: "critical",
            state: "cleared",
            message: "critical alarm",
            triggered_at: "2026-02-24T01:00:00Z",
            acknowledged_at: "2026-02-24T01:02:00Z",
            acknowledged_by: "operator-4",
            cleared_at: "2026-02-24T01:05:00Z",
            shelved_until: nil,
            suppression_reason: nil
          }
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "alarm.transition.unacknowledged", %{
          "alarm_id" => alarm_id("ALM-REOPEN-001"),
          "from" => "cleared",
          "to" => "unacknowledged",
          "at" => "2026-02-24T01:20:00Z"
        })

      assert updated_agent.state.state == "unacknowledged"
      assert updated_agent.state.triggered_at == "2026-02-24T01:20:00Z"
      assert updated_agent.state.acknowledged_at == nil
      assert updated_agent.state.acknowledged_by == nil
      assert updated_agent.state.cleared_at == nil
      assert unresolved == []
    end

    test "sensor emits rejection envelope on illegal transition" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/alarm-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "alarm-sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "alarm_id" => alarm_id("ALM-SENSOR-REJ-001"),
          "from" => "unacknowledged",
          "to" => "cleared",
          "at" => "2026-02-24T01:20:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "alarm.transition.rejected"
      assert signal.data.to == "cleared"
      assert signal.data.validator == :fsm
      assert is_binary(signal.data.trace_id)
    end

    test "sensor -> agent server loop supports shelve then unshelve" do
      agent_id = "alarm-agent-sensor-#{System.unique_integer([:positive])}"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: @jido_instance,
          agent: Agent,
          id: agent_id,
          initial_state: %{
            alarm_id: alarm_id("ALM-SENSOR-001"),
            device_id: "TMP-SENSOR-001",
            asset_id: nil,
            severity: "critical",
            state: "acknowledged",
            message: "critical alarm",
            triggered_at: "2026-02-24T01:00:00Z",
            acknowledged_at: "2026-02-24T01:01:00Z",
            acknowledged_by: "operator-3",
            cleared_at: nil,
            shelved_until: nil,
            suppression_reason: nil
          }
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/alarm-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "alarm-sensor-agent-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "alarm_id" => alarm_id("ALM-SENSOR-001"),
          "from" => "acknowledged",
          "to" => "shelved",
          "at" => "2026-02-24T01:30:00Z",
          "reason" => "maintenance",
          "shelved_until" => "2026-02-24T02:30:00Z"
        })

      {:ok, _shelved_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.state == "shelved" and
            state.agent.state.shelved_until == "2026-02-24T02:30:00Z"
        end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "alarm_id" => alarm_id("ALM-SENSOR-001"),
          "from" => "shelved",
          "to" => "acknowledged",
          "at" => "2026-02-24T01:40:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.state == "acknowledged" and
            state.agent.state.shelved_until == nil and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

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
