defmodule Maiden.DeviceRuntime.ValidatorTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.DeviceRuntime.Agent
  alias Maiden.DeviceRuntime.DeviceFactory
  alias Maiden.DeviceRuntime.FSM
  alias Maiden.DeviceRuntime.Sensors.TransitionSensor
  alias Maiden.DeviceRuntime.Validators.DeviceValidator

  setup_all do
    ensure_jido_started()
    :ok
  end

  describe "device_validate/2" do
    test "accepts valid device payload" do
      payload =
        DeviceFactory.new_device(
          slug: "motor-01",
          name: "Main Motor",
          status: "online",
          device_type: "motor",
          control_mode: "auto",
          rated_power: 7500,
          power_unit: "watts",
          machine_id: "MCH-cnc-001",
          created_at: "2026-02-24T01:00:00Z",
          metadata: %{"owner" => "controls"}
        )
        |> stringify_keys()

      assert :ok = DeviceValidator.device_validate(payload)
      assert :ok = DeviceValidator.agent_state_validate(payload)
    end

    test "rejects invalid enum payload" do
      payload =
        DeviceFactory.new_device(
          slug: "motor-02",
          status: "active",
          device_type: "motor",
          created_at: "2026-02-24T01:01:00Z"
        )
        |> stringify_keys()

      assert {:error, %{validator: :ex_json_schema, errors: _}} =
               DeviceValidator.device_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload =
        DeviceFactory.new_transition_event(
          slug: "motor-03",
          from: "online",
          to: "offline",
          at: "2026-02-24T01:05:00Z",
          action: "GoOffline"
        )
        |> stringify_keys()

      assert :ok = DeviceValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_runtime(payload)
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition" do
      payload =
        DeviceFactory.new_transition_event(
          slug: "motor-04",
          from: "online",
          to: "decommissioned",
          at: "2026-02-24T01:06:00Z"
        )
        |> stringify_keys()

      assert :ok = DeviceValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "online",
                to: "decommissioned",
                allowed_next: ["offline", "faulted", "firmware_update"]
              }} = FSM.validate_transition_for_runtime(payload)
    end
  end

  describe "Jido agent preflight" do
    test "delegates transition preflight to FSM validator" do
      payload =
        DeviceFactory.new_transition_event(
          slug: "motor-05",
          from: "provisioned",
          to: "online",
          at: "2026-02-24T01:07:00Z",
          action: "GoOnline"
        )
        |> stringify_keys()

      assert :ok = Agent.preflight_transition(payload)
    end
  end

  describe "Jido action and signal wiring" do
    test "signal mutates status and resolves directives" do
      agent =
        Agent.new(
          id: "device-agent-online",
          state:
            DeviceFactory.new_device(
              slug: "agent-device-01",
              name: "Agent Device 01",
              status: "provisioned",
              device_type: "servo",
              machine_id: "MCH-01",
              created_at: "2026-02-24T01:00:00Z"
            )
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "device.transition.online", %{
          "device_id" => agent.state.device_id,
          "from" => "provisioned",
          "to" => "online",
          "action" => "GoOnline",
          "at" => "2026-02-24T01:10:00Z",
          "reason" => "commissioning_complete",
          "initiated_by" => "ops-1"
        })

      assert updated_agent.state.status == "online"
      assert updated_agent.state.updated_at == "2026-02-24T01:10:00Z"
      assert updated_agent.state.last_command_at == "2026-02-24T01:10:00Z"
      assert unresolved == []
    end

    test "rejects unsupported signal types" do
      agent = Agent.new(id: "device-agent-unknown")

      assert {:error, :unknown_signal_type} =
               Agent.apply_signal(agent, "device.transition.unknown", %{})
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition before cmd" do
      agent =
        Agent.new(
          id: "device-agent-illegal",
          state:
            DeviceFactory.new_device(
              slug: "agent-device-illegal",
              name: "Illegal Device",
              status: "online",
              device_type: "motor",
              machine_id: "MCH-77",
              created_at: "2026-02-24T01:00:00Z"
            )
        )

      payload = %{
        "device_id" => agent.state.device_id,
        "from" => "online",
        "to" => "decommissioned",
        "at" => "2026-02-24T01:11:00Z"
      }

      assert {:error, %{validator: :fsm}} =
               Agent.apply_signal(agent, "device.transition.decommissioned", payload)
    end
  end

  describe "sensor ingress" do
    test "sensor emits transition signal only after preflight succeeds" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/test-device-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "device-sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "device_id" => "DEV-sensor-device-001",
          "from" => "provisioned",
          "to" => "online",
          "at" => "2026-02-24T01:12:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "device.transition.online"

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "device_id" => "DEV-sensor-device-001",
          "from" => "online",
          "to" => "decommissioned",
          "at" => "2026-02-24T01:13:00Z"
        })

      assert_receive {:signal, rejection_signal}, 1_000
      assert rejection_signal.type == "device.transition.rejected"
      assert rejection_signal.data.to == "decommissioned"
      assert rejection_signal.data.attempted_signal == "device.transition.decommissioned"
      assert rejection_signal.data.validator == :fsm
      assert is_binary(rejection_signal.data.trace_id)
    end

    test "sensor -> agent server -> action -> FSM loop mutates state" do
      ensure_jido_started()
      agent_id = "device-agent-sensor-#{System.unique_integer([:positive])}"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: Jido.default_instance(),
          agent: Agent,
          id: agent_id,
          initial_state:
            DeviceFactory.new_device(
              slug: "sensor-device-rt-001",
              name: "Sensor Runtime Device",
              status: "online",
              device_type: "motor",
              machine_id: "MCH-rt-01",
              created_at: "2026-02-24T01:00:00Z"
            )
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/device-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "device-sensor-agent-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "device_id" => "DEV-sensor-device-rt-001",
          "from" => "online",
          "to" => "faulted",
          "action" => "MarkFaulted",
          "at" => "2026-02-24T01:14:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.status == "faulted" and
            state.agent.state.updated_at == "2026-02-24T01:14:00Z" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.status == "faulted"
      assert server_state.agent.state.updated_at == "2026-02-24T01:14:00Z"
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

  defp stringify_keys(map) when is_map(map) do
    Enum.reduce(map, %{}, fn {key, value}, acc ->
      string_key = if is_atom(key), do: Atom.to_string(key), else: key
      Map.put(acc, string_key, stringify_nested(value))
    end)
  end

  defp stringify_nested(map) when is_map(map), do: stringify_keys(map)
  defp stringify_nested(list) when is_list(list), do: Enum.map(list, &stringify_nested/1)
  defp stringify_nested(value), do: value
end
