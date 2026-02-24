defmodule Maiden.SensorAssetRuntime.ValidatorTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.SensorAssetRuntime.Agent
  alias Maiden.SensorAssetRuntime.FSM
  alias Maiden.SensorAssetRuntime.SensorAssetFactory
  alias Maiden.SensorAssetRuntime.Sensors.TransitionSensor
  alias Maiden.SensorAssetRuntime.Validators.SensorAssetValidator

  setup_all do
    ensure_jido_started()
    :ok
  end

  describe "sensor_asset_validate/2" do
    test "accepts valid sensor payload" do
      payload =
        SensorAssetFactory.new_sensor_asset(
          slug: "temp-01",
          status: "active",
          sensor_type: "temperature",
          unit: "celsius",
          sample_rate_ms: 1000,
          threshold_high: 80.0,
          threshold_critical: 95.0,
          machine_id: "MCH-cnc-001",
          metadata: %{"owner" => "reliability"}
        )
        |> stringify_keys()

      assert :ok = SensorAssetValidator.sensor_asset_validate(payload)
      assert :ok = SensorAssetValidator.agent_state_validate(payload)
    end

    test "rejects invalid enum payload" do
      payload =
        SensorAssetFactory.new_sensor_asset(
          slug: "temp-02",
          status: "running",
          sensor_type: "temperature",
          unit: "celsius"
        )
        |> stringify_keys()

      assert {:error, %{validator: :ex_json_schema, errors: _}} =
               SensorAssetValidator.sensor_asset_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload =
        SensorAssetFactory.new_sensor_asset_transition_event(
          slug: "temp-03",
          from: "active",
          to: "calibrating",
          at: "2026-02-24T01:05:00Z",
          action: "StartCalibration"
        )
        |> stringify_keys()

      assert :ok = SensorAssetValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_runtime(payload)
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition" do
      payload =
        SensorAssetFactory.new_sensor_asset_transition_event(
          slug: "temp-04",
          from: "active",
          to: "decommissioned",
          at: "2026-02-24T01:06:00Z"
        )
        |> stringify_keys()

      assert :ok = SensorAssetValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "active",
                to: "decommissioned",
                allowed_next: ["calibrating", "needs_calibration", "faulted", "offline"]
              }} = FSM.validate_transition_for_runtime(payload)
    end
  end

  describe "Jido agent preflight" do
    test "delegates transition preflight to FSM validator" do
      payload =
        SensorAssetFactory.new_sensor_asset_transition_event(
          slug: "temp-05",
          from: "active",
          to: "needs_calibration",
          at: "2026-02-24T01:07:00Z",
          action: "FlagForCalibration"
        )
        |> stringify_keys()

      assert :ok = Agent.preflight_transition(payload)
    end
  end

  describe "Jido action and signal wiring" do
    test "signal mutates status and resolves directives" do
      agent =
        Agent.new(
          id: "sensor-asset-agent-running",
          state:
            SensorAssetFactory.new_sensor_asset(
              slug: "agent-sensor-01",
              name: "Agent Sensor 01",
              status: "active",
              sensor_type: "temperature",
              unit: "celsius",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "sensor_asset.transition.calibrating", %{
          "sensor_id" => agent.state.sensor_id,
          "from" => "active",
          "to" => "calibrating",
          "action" => "StartCalibration",
          "at" => "2026-02-24T01:10:00Z",
          "reason" => "scheduled_calibration",
          "initiated_by" => "tech-1"
        })

      assert updated_agent.state.status == "calibrating"
      assert updated_agent.state.updated_at == "2026-02-24T01:10:00Z"
      assert unresolved == []
    end

    test "rejects unsupported signal types" do
      agent = Agent.new(id: "sensor-asset-agent-unknown")

      assert {:error, :unknown_signal_type} =
               Agent.apply_signal(agent, "sensor_asset.transition.unknown", %{})
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition before cmd" do
      agent =
        Agent.new(
          id: "sensor-asset-agent-illegal",
          state:
            SensorAssetFactory.new_sensor_asset(
              slug: "agent-sensor-illegal",
              name: "Illegal Sensor",
              status: "active",
              sensor_type: "temperature",
              unit: "celsius",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      payload = %{
        "sensor_id" => agent.state.sensor_id,
        "from" => "active",
        "to" => "decommissioned",
        "at" => "2026-02-24T01:11:00Z"
      }

      assert {:error, %{validator: :fsm}} =
               Agent.apply_signal(agent, "sensor_asset.transition.decommissioned", payload)
    end
  end

  describe "sensor ingress" do
    test "sensor emits transition signal only after preflight succeeds" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/test-sensor-asset-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "sensor-asset-sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "sensor_id" => "SNS-sensor-001",
          "from" => "active",
          "to" => "calibrating",
          "action" => "StartCalibration",
          "at" => "2026-02-24T01:12:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "sensor_asset.transition.calibrating"

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "sensor_id" => "SNS-sensor-001",
          "from" => "active",
          "to" => "decommissioned",
          "at" => "2026-02-24T01:13:00Z"
        })

      assert_receive {:signal, rejection_signal}, 1_000
      assert rejection_signal.type == "sensor_asset.transition.rejected"
      assert rejection_signal.data.to == "decommissioned"
      assert rejection_signal.data.attempted_signal == "sensor_asset.transition.decommissioned"
      assert rejection_signal.data.validator == :fsm
      assert is_binary(rejection_signal.data.trace_id)
    end

    test "sensor -> agent server -> action -> FSM loop mutates state" do
      ensure_jido_started()
      agent_id = "sensor-asset-agent-sensor-#{System.unique_integer([:positive])}"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: Jido.default_instance(),
          agent: Agent,
          id: agent_id,
          initial_state:
            SensorAssetFactory.new_sensor_asset(
              slug: "sensor-rt-001",
              name: "Sensor Runtime Sensor",
              status: "active",
              sensor_type: "temperature",
              unit: "celsius",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/sensor-asset-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "sensor-asset-sensor-agent-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "sensor_id" => "SNS-sensor-rt-001",
          "from" => "active",
          "to" => "needs_calibration",
          "action" => "FlagForCalibration",
          "at" => "2026-02-24T01:14:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.status == "needs_calibration" and
            state.agent.state.updated_at == "2026-02-24T01:14:00Z" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.status == "needs_calibration"
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
