defmodule Maiden.EquipmentStateRuntime.ValidatorTest do
  use ExUnit.Case, async: false

  @jido_instance Maiden.EquipmentStateRuntime.ValidatorTest.Jido

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.EquipmentStateRuntime.Agent
  alias Maiden.EquipmentStateRuntime.EquipmentStateId
  alias Maiden.EquipmentStateRuntime.FSM
  alias Maiden.EquipmentStateRuntime.Sensors.TransitionSensor
  alias Maiden.EquipmentStateRuntime.Validators.EquipmentStateValidator

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start(name: @jido_instance) do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  describe "equipment_state_validate/2" do
    test "accepts valid equipment-state payload" do
      payload = %{
        "equipment_state_id" => equipment_state_id("EST-001"),
        "machine_id" => "MCH-001",
        "state" => "running",
        "reason" => "production",
        "started_at" => "2026-02-24T01:00:00Z",
        "ended_at" => nil,
        "operator_id" => "operator-1",
        "notes" => nil,
        "metadata" => %{}
      }

      assert :ok = EquipmentStateValidator.equipment_state_validate(payload)
    end

    test "rejects invalid equipment-state payload" do
      payload = %{
        "equipment_state_id" => equipment_state_id("EST-002"),
        "machine_id" => "MCH-002",
        "state" => "faulted",
        "reason" => nil,
        "started_at" => "2026-02-24T01:00:00Z",
        "ended_at" => nil,
        "operator_id" => nil,
        "notes" => nil,
        "metadata" => %{}
      }

      assert {:error, %{validator: :ex_json_schema, errors: _}} =
               EquipmentStateValidator.equipment_state_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload = %{
        "equipment_state_id" => equipment_state_id("EST-003"),
        "machine_id" => "MCH-003",
        "from" => "running",
        "to" => "idle",
        "at" => "2026-02-24T01:05:00Z",
        "reason" => "no_order"
      }

      assert :ok = EquipmentStateValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_jido(payload)
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition" do
      payload = %{
        "equipment_state_id" => equipment_state_id("EST-004"),
        "machine_id" => "MCH-004",
        "from" => "running",
        "to" => "running",
        "at" => "2026-02-24T01:06:00Z",
        "reason" => "production"
      }

      assert :ok = EquipmentStateValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "running",
                to: "running",
                allowed_next: [
                  "idle",
                  "planned_downtime",
                  "unplanned_downtime",
                  "setup",
                  "blocked"
                ]
              }} = FSM.validate_transition_for_jido(payload)
    end
  end

  describe "Jido action and signal wiring" do
    test "idle signal mutates state" do
      agent =
        Agent.new(
          id: "equipment-state-agent-idle",
          state: %{
            equipment_state_id: equipment_state_id("EST-IDLE-001"),
            machine_id: "MCH-IDLE-001",
            state: "running",
            reason: "production",
            started_at: "2026-02-24T01:00:00Z",
            ended_at: nil,
            operator_id: "operator-2",
            notes: nil,
            metadata: %{}
          }
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "equipment_state.transition.idle", %{
          "equipment_state_id" => equipment_state_id("EST-IDLE-001"),
          "machine_id" => "MCH-IDLE-001",
          "from" => "running",
          "to" => "idle",
          "at" => "2026-02-24T01:10:00Z",
          "reason" => "no_order",
          "operator_id" => "operator-2"
        })

      assert updated_agent.state.state == "idle"
      assert updated_agent.state.reason == "no_order"
      assert updated_agent.state.started_at == "2026-02-24T01:10:00Z"
      assert unresolved == []
    end

    test "blocked -> running signal restores production state" do
      agent =
        Agent.new(
          id: "equipment-state-agent-running",
          state: %{
            equipment_state_id: equipment_state_id("EST-RUN-001"),
            machine_id: "MCH-RUN-001",
            state: "blocked",
            reason: "blocked_downstream",
            started_at: "2026-02-24T01:05:00Z",
            ended_at: nil,
            operator_id: "operator-4",
            notes: nil,
            metadata: %{}
          }
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "equipment_state.transition.running", %{
          "equipment_state_id" => equipment_state_id("EST-RUN-001"),
          "machine_id" => "MCH-RUN-001",
          "from" => "blocked",
          "to" => "running",
          "at" => "2026-02-24T01:20:00Z",
          "reason" => "production",
          "operator_id" => "operator-4"
        })

      assert updated_agent.state.state == "running"
      assert updated_agent.state.reason == "production"
      assert updated_agent.state.started_at == "2026-02-24T01:20:00Z"
      assert unresolved == []
    end

    test "sensor emits rejection envelope on illegal transition" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/equipment-state-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "equipment-state-sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "equipment_state_id" => equipment_state_id("EST-SENSOR-REJ-001"),
          "machine_id" => "MCH-SENSOR-REJ-001",
          "from" => "running",
          "to" => "running",
          "at" => "2026-02-24T01:20:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "equipment_state.transition.rejected"
      assert signal.data.to == "running"
      assert signal.data.validator == :fsm
      assert is_binary(signal.data.trace_id)
    end

    test "sensor -> agent server loop supports setup then running" do
      agent_id = "equipment-state-agent-sensor-#{System.unique_integer([:positive])}"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: @jido_instance,
          agent: Agent,
          id: agent_id,
          initial_state: %{
            equipment_state_id: equipment_state_id("EST-SENSOR-001"),
            machine_id: "MCH-SENSOR-001",
            state: "idle",
            reason: "no_order",
            started_at: "2026-02-24T01:00:00Z",
            ended_at: nil,
            operator_id: "operator-3",
            notes: nil,
            metadata: %{}
          }
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/equipment-state-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "equipment-state-sensor-agent-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "equipment_state_id" => equipment_state_id("EST-SENSOR-001"),
          "machine_id" => "MCH-SENSOR-001",
          "from" => "idle",
          "to" => "setup",
          "at" => "2026-02-24T01:30:00Z",
          "reason" => "changeover"
        })

      {:ok, _setup_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.state == "setup" and state.agent.state.reason == "changeover"
        end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "equipment_state_id" => equipment_state_id("EST-SENSOR-001"),
          "machine_id" => "MCH-SENSOR-001",
          "from" => "setup",
          "to" => "running",
          "at" => "2026-02-24T01:40:00Z",
          "reason" => "production"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.state == "running" and
            state.agent.state.reason == "production" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.state == "running"
      assert server_state.agent.state.reason == "production"
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

  defp equipment_state_id(slug) do
    EquipmentStateId.make(slug, deterministic_uuid(slug))
  end

  defp deterministic_uuid(slug) do
    hash = :crypto.hash(:sha256, slug) |> Base.encode16(case: :lower)

    <<a::binary-size(8), b::binary-size(4), c::binary-size(3), d::binary-size(3),
      e::binary-size(12), _::binary>> = hash

    "#{a}-#{b}-4#{c}-8#{d}-#{e}"
  end
end
