defmodule Maiden.AreaRuntime.ValidatorTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.AreaRuntime.Agent
  alias Maiden.AreaRuntime.AreaFactory
  alias Maiden.AreaRuntime.FSM
  alias Maiden.AreaRuntime.Sensors.TransitionSensor
  alias Maiden.AreaRuntime.Validators.AreaValidator

  setup_all do
    ensure_jido_started()
    :ok
  end

  describe "area_validate/2" do
    test "accepts valid area payload" do
      payload =
        AreaFactory.new_area(
          slug: "warehouse-east",
          name: "Warehouse East",
          status: "active",
          enterprise_id: "ENT-acme",
          site_id: "SIT-cleveland",
          area_type: "warehouse",
          hierarchy_path: "/ENT-acme/SIT-cleveland/ARA-WAREHOUSE-EAST",
          location: %{
            "latitude" => 41.5,
            "longitude" => -81.7,
            "building" => "Building 2",
            "floor" => "Ground",
            "zone" => "ZE-2",
            "address" => "200 Harbor Road",
            "timezone" => "America/New_York"
          },
          metadata: %{"owner" => "operations"}
        )
        |> stringify_keys()

      assert :ok = AreaValidator.area_validate(payload)
      assert :ok = AreaValidator.agent_state_validate(payload)
    end

    test "accepts hierarchy path when area is nested under plant lane" do
      payload =
        AreaFactory.new_area(
          slug: "warehouse-west",
          status: "active",
          enterprise_id: "ENT-acme",
          site_id: "SIT-cleveland",
          plant_id: "PLT-cleveland-main"
        )
        |> stringify_keys()

      assert payload["hierarchy_path"] ==
               "/ENT-acme/SIT-cleveland/PLT-cleveland-main/ARA-WAREHOUSE-WEST"

      assert :ok = AreaValidator.area_validate(payload)
    end

    test "rejects invalid enum payload" do
      payload =
        AreaFactory.new_area(
          slug: "warehouse-east",
          status: "planned"
        )
        |> stringify_keys()

      assert {:error, %{validator: :ex_json_schema, errors: _}} =
               AreaValidator.area_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload =
        AreaFactory.new_transition_event(
          slug: "warehouse-east",
          from: "active",
          to: "maintenance",
          at: "2026-02-24T01:05:00Z",
          reason: "scheduled inspection",
          by: "supervisor-1"
        )
        |> stringify_keys()

      assert :ok = AreaValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_runtime(payload)
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition" do
      payload =
        AreaFactory.new_transition_event(
          slug: "warehouse-east",
          from: "restricted",
          to: "decommissioned",
          at: "2026-02-24T01:06:00Z"
        )
        |> stringify_keys()

      assert :ok = AreaValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "restricted",
                to: "decommissioned",
                allowed_next: ["active"]
              }} = FSM.validate_transition_for_runtime(payload)
    end
  end

  describe "Jido agent preflight" do
    test "delegates transition preflight to FSM validator" do
      payload =
        AreaFactory.new_transition_event(
          slug: "warehouse-north",
          from: "active",
          to: "restricted",
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
          id: "area-agent-running",
          state:
            AreaFactory.new_area(
              slug: "agent-area-01",
              name: "Agent Area 01",
              status: "active",
              enterprise_id: "ENT-acme",
              site_id: "SIT-cleveland",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "area.transition.restricted", %{
          "area_id" => agent.state.area_id,
          "from" => "active",
          "to" => "restricted",
          "at" => "2026-02-24T01:10:00Z",
          "reason" => "inventory_lock",
          "by" => "scheduler-1"
        })

      assert updated_agent.state.status == "restricted"
      assert updated_agent.state.updated_at == "2026-02-24T01:10:00Z"
      assert unresolved == []
    end

    test "rejects unsupported signal types" do
      agent = Agent.new(id: "area-agent-unknown")

      assert {:error, :unknown_signal_type} =
               Agent.apply_signal(agent, "area.transition.unknown", %{})
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition before cmd" do
      agent =
        Agent.new(
          id: "area-agent-illegal",
          state:
            AreaFactory.new_area(
              slug: "agent-area-illegal",
              name: "Illegal Area",
              status: "restricted",
              enterprise_id: "ENT-acme",
              site_id: "SIT-cleveland",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      payload = %{
        "area_id" => agent.state.area_id,
        "from" => "restricted",
        "to" => "decommissioned",
        "at" => "2026-02-24T01:11:00Z"
      }

      assert {:error, %{validator: :fsm}} =
               Agent.apply_signal(agent, "area.transition.decommissioned", payload)
    end
  end

  describe "sensor ingress" do
    test "sensor emits transition signal only after preflight succeeds" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/test-area-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "area-sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "area_id" => "ARA-SENSOR-AREA-001",
          "from" => "active",
          "to" => "restricted",
          "at" => "2026-02-24T01:12:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "area.transition.restricted"

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "area_id" => "ARA-SENSOR-AREA-001",
          "from" => "restricted",
          "to" => "decommissioned",
          "at" => "2026-02-24T01:13:00Z"
        })

      assert_receive {:signal, rejection_signal}, 1_000
      assert rejection_signal.type == "area.transition.rejected"
      assert rejection_signal.data.to == "decommissioned"
      assert rejection_signal.data.attempted_signal == "area.transition.decommissioned"
      assert rejection_signal.data.validator == :fsm
      assert is_binary(rejection_signal.data.trace_id)
    end

    test "sensor -> agent server -> action -> FSM loop mutates state" do
      ensure_jido_started()
      agent_id = "area-agent-sensor-#{System.unique_integer([:positive])}"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: Jido.default_instance(),
          agent: Agent,
          id: agent_id,
          initial_state:
            AreaFactory.new_area(
              slug: "sensor-area-rt-001",
              name: "Sensor Runtime Area",
              status: "active",
              enterprise_id: "ENT-acme",
              site_id: "SIT-cleveland",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/area-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "area-sensor-agent-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "area_id" => "ARA-SENSOR-AREA-RT-001",
          "from" => "active",
          "to" => "restricted",
          "at" => "2026-02-24T01:14:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.status == "restricted" and
            state.agent.state.updated_at == "2026-02-24T01:14:00Z" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.status == "restricted"
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
