defmodule Maiden.PlantRuntime.ValidatorTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.PlantRuntime.Agent
  alias Maiden.PlantRuntime.FSM
  alias Maiden.PlantRuntime.PlantFactory
  alias Maiden.PlantRuntime.Sensors.TransitionSensor
  alias Maiden.PlantRuntime.Validators.PlantValidator

  setup_all do
    ensure_jido_started()
    :ok
  end

  describe "plant_validate/2" do
    test "accepts valid plant payload" do
      payload =
        PlantFactory.new_plant(
          slug: "chicago-assembly",
          status: "operational",
          timezone: "America/Chicago",
          hierarchy_path: "/ENT-acme/SIT-chicago/AREA-body/PLT-chicago-assembly",
          enterprise_id: "ENT-acme",
          site_id: "SIT-chicago",
          area_id: "AREA-body",
          metadata: %{"owner" => "operations"},
          created_at: "2026-02-24T00:00:00Z"
        )
        |> stringify_keys()

      assert :ok = PlantValidator.plant_validate(payload)
      assert :ok = PlantValidator.agent_state_validate(payload)
    end

    test "rejects invalid enum payload" do
      payload =
        PlantFactory.new_plant(
          slug: "chicago-assembly",
          status: "active"
        )
        |> stringify_keys()

      assert {:error, %{validator: :ex_json_schema, errors: _}} =
               PlantValidator.plant_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload =
        PlantFactory.new_transition_event(
          slug: "chicago-assembly",
          from: "commissioning",
          to: "operational",
          at: "2026-02-24T01:05:00Z"
        )
        |> stringify_keys()

      assert :ok = PlantValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_runtime(payload)
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition" do
      payload =
        PlantFactory.new_transition_event(
          slug: "chicago-assembly",
          from: "commissioning",
          to: "decommissioned",
          at: "2026-02-24T01:06:00Z"
        )
        |> stringify_keys()

      assert :ok = PlantValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "commissioning",
                to: "decommissioned",
                allowed_next: ["operational"]
              }} = FSM.validate_transition_for_runtime(payload)
    end
  end

  describe "Jido agent preflight" do
    test "delegates transition preflight to FSM validator" do
      payload =
        PlantFactory.new_transition_event(
          slug: "winter-assembly",
          from: "commissioning",
          to: "operational",
          at: "2026-02-24T01:07:00Z"
        )
        |> stringify_keys()

      assert :ok = Agent.preflight_transition(payload)
    end
  end

  describe "Jido action and signal wiring" do
    test "signal mutates status and resolves directives" do
      agent =
        Agent.new(
          id: "plant-agent-operational",
          state:
            PlantFactory.new_plant(
              slug: "agent-plant-01",
              name: "Agent Plant 01",
              status: "commissioning",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "plant.transition.operational", %{
          "plant_id" => agent.state.plant_id,
          "from" => "commissioning",
          "to" => "operational",
          "at" => "2026-02-24T00:10:00Z",
          "reason" => "startup_complete",
          "initiated_by" => "scheduler-1"
        })

      assert updated_agent.state.status == "operational"
      assert updated_agent.state.updated_at == "2026-02-24T00:10:00Z"
      assert unresolved == []
    end

    test "rejects unsupported signal types" do
      agent = Agent.new(id: "plant-agent-unknown")

      assert {:error, :unknown_signal_type} =
               Agent.apply_signal(agent, "plant.transition.unknown", %{})
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition before cmd" do
      agent =
        Agent.new(
          id: "plant-agent-illegal",
          state:
            PlantFactory.new_plant(
              slug: "agent-plant-illegal",
              name: "Illegal Plant",
              status: "commissioning",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      payload = %{
        "plant_id" => agent.state.plant_id,
        "from" => "commissioning",
        "to" => "decommissioned",
        "at" => "2026-02-24T00:11:00Z"
      }

      assert {:error, %{validator: :fsm}} =
               Agent.apply_signal(agent, "plant.transition.decommissioned", payload)
    end
  end

  describe "sensor ingress" do
    test "sensor emits transition signal only after preflight succeeds" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/test-plant-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "plant-sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "plant_id" => "PLT-sensor-plant-001",
          "from" => "commissioning",
          "to" => "operational",
          "at" => "2026-02-24T00:12:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "plant.transition.operational"

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "plant_id" => "PLT-sensor-plant-001",
          "from" => "commissioning",
          "to" => "decommissioned",
          "at" => "2026-02-24T00:13:00Z"
        })

      assert_receive {:signal, rejection_signal}, 1_000
      assert rejection_signal.type == "plant.transition.rejected"
      assert rejection_signal.data.to == "decommissioned"
      assert rejection_signal.data.attempted_signal == "plant.transition.decommissioned"
      assert rejection_signal.data.validator == :fsm
      assert is_binary(rejection_signal.data.trace_id)
    end

    test "sensor -> agent server -> action -> FSM loop mutates state" do
      ensure_jido_started()
      agent_id = "plant-agent-sensor-#{System.unique_integer([:positive])}"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: Jido.default_instance(),
          agent: Agent,
          id: agent_id,
          initial_state:
            PlantFactory.new_plant(
              slug: "sensor-plant-rt-001",
              name: "Sensor Runtime Plant",
              status: "operational",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/plant-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "plant-sensor-agent-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "plant_id" => "PLT-sensor-plant-rt-001",
          "from" => "operational",
          "to" => "scheduled_shutdown",
          "at" => "2026-02-24T00:14:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.status == "scheduled_shutdown" and
            state.agent.state.updated_at == "2026-02-24T00:14:00Z" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.status == "scheduled_shutdown"
      assert server_state.agent.state.updated_at == "2026-02-24T00:14:00Z"
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
