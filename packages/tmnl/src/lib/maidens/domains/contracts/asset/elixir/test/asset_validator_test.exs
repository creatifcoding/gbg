defmodule Maiden.AssetRuntime.ValidatorTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.AssetRuntime.Agent
  alias Maiden.AssetRuntime.AssetFactory
  alias Maiden.AssetRuntime.FSM
  alias Maiden.AssetRuntime.Sensors.TransitionSensor
  alias Maiden.AssetRuntime.Validators.AssetValidator

  setup_all do
    ensure_jido_started()
    :ok
  end

  describe "asset_validate/2" do
    test "accepts valid ISA-95 hierarchy payload" do
      payload =
        AssetFactory.new_asset(
          slug: "press-12",
          kind: "machine",
          name: "Hydraulic Press 12",
          status: "active",
          hierarchy_path:
            "/ENT-acme/SIT-cleveland/ARA-stamping/PLT-main/LIN-body/WCL-cell-12/MCH-press-12",
          enterprise_id: "ENT-acme",
          site_id: "SIT-cleveland",
          area_id: "ARA-stamping",
          plant_id: "PLT-main",
          line_id: "LIN-body",
          work_cell_id: "WCL-cell-12",
          metadata: %{"owner" => "operations"}
        )
        |> stringify_keys()

      assert :ok = AssetValidator.asset_validate(payload)
      assert :ok = AssetValidator.agent_state_validate(payload)
    end

    test "rejects invalid enum payload via schema" do
      payload =
        AssetFactory.new_asset(
          slug: "bad-asset",
          kind: "line",
          status: "running"
        )
        |> stringify_keys()

      assert {:error, %{validator: :ex_json_schema, errors: _}} =
               AssetValidator.asset_validate(payload)
    end

    test "rejects hierarchy semantic drift" do
      payload =
        AssetFactory.new_asset(
          slug: "line-with-descendant",
          kind: "line",
          line_id: "LIN-line-with-descendant"
        )
        |> Map.put(:machine_id, "MCH-should-not-exist")
        |> stringify_keys()

      assert {:error,
              %{validator: :hierarchy, reason: :descendant_identifier_must_be_nil, field: "machine_id"}} =
               AssetValidator.asset_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload =
        AssetFactory.new_transition_event(
          slug: "body-line-2",
          id_kind: "line",
          kind: "line",
          from: "active",
          to: "maintenance",
          at: "2026-02-24T01:05:00Z",
          action: "StartMaintenance"
        )
        |> stringify_keys()

      assert :ok = AssetValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_runtime(payload)
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition" do
      payload =
        AssetFactory.new_transition_event(
          slug: "body-line-2",
          id_kind: "line",
          kind: "line",
          from: "decommissioned",
          to: "active",
          action: "Activate",
          at: "2026-02-24T01:06:00Z"
        )
        |> stringify_keys()

      assert :ok = AssetValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "decommissioned",
                to: "active",
                allowed_next: []
              }} = FSM.validate_transition_for_runtime(payload)
    end
  end

  describe "Jido agent preflight" do
    test "delegates transition preflight to FSM validator" do
      payload =
        AssetFactory.new_transition_event(
          slug: "body-line-2",
          id_kind: "line",
          kind: "line",
          from: "inactive",
          to: "active",
          action: "Activate",
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
          id: "asset-agent-running",
          state:
            AssetFactory.new_asset(
              slug: "agent-machine-01",
              kind: "machine",
              name: "Agent Machine 01",
              status: "active",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "asset.transition.inactive", %{
          "asset_id" => agent.state.asset_id,
          "kind" => "machine",
          "from" => "active",
          "to" => "inactive",
          "action" => "Deactivate",
          "at" => "2026-02-24T01:10:00Z",
          "reason" => "planned_downtime",
          "initiated_by" => "ops-1"
        })

      assert updated_agent.state.status == "inactive"
      assert updated_agent.state.updated_at == "2026-02-24T01:10:00Z"
      assert unresolved == []
    end

    test "rejects unsupported signal types" do
      agent = Agent.new(id: "asset-agent-unknown")

      assert {:error, :unknown_signal_type} =
               Agent.apply_signal(agent, "asset.transition.unknown", %{})
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition before cmd" do
      agent =
        Agent.new(
          id: "asset-agent-illegal",
          state:
            AssetFactory.new_asset(
              slug: "agent-machine-illegal",
              kind: "machine",
              name: "Illegal Machine",
              status: "decommissioned",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      payload = %{
        "asset_id" => agent.state.asset_id,
        "kind" => "machine",
        "from" => "decommissioned",
        "to" => "active",
        "action" => "Activate",
        "at" => "2026-02-24T01:11:00Z"
      }

      assert {:error, %{validator: :fsm}} =
               Agent.apply_signal(agent, "asset.transition.active", payload)
    end
  end

  describe "sensor ingress" do
    test "sensor emits transition signal only after preflight succeeds" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/test-asset-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "asset-sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "asset_id" => "LIN-body-line-2",
          "kind" => "line",
          "from" => "active",
          "to" => "maintenance",
          "action" => "StartMaintenance",
          "at" => "2026-02-24T01:12:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "asset.transition.maintenance"

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "asset_id" => "LIN-body-line-2",
          "kind" => "line",
          "from" => "decommissioned",
          "to" => "active",
          "action" => "Activate",
          "at" => "2026-02-24T01:13:00Z"
        })

      assert_receive {:signal, rejection_signal}, 1_000
      assert rejection_signal.type == "asset.transition.rejected"
      assert rejection_signal.data.to == "active"
      assert rejection_signal.data.attempted_signal == "asset.transition.active"
      assert rejection_signal.data.validator == :fsm
      assert is_binary(rejection_signal.data.trace_id)
    end

    test "sensor -> agent server -> action -> FSM loop mutates state" do
      ensure_jido_started()
      agent_id = "asset-agent-sensor-#{System.unique_integer([:positive])}"

      initial_state =
        AssetFactory.new_asset(
          slug: "sensor-machine-rt-001",
          kind: "machine",
          name: "Sensor Runtime Machine",
          status: "active",
          created_at: "2026-02-24T00:00:00Z"
        )

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: Jido.default_instance(),
          agent: Agent,
          id: agent_id,
          initial_state: initial_state
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/asset-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "asset-sensor-agent-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "asset_id" => initial_state.asset_id,
          "kind" => "machine",
          "from" => "active",
          "to" => "maintenance",
          "action" => "StartMaintenance",
          "at" => "2026-02-24T01:14:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.status == "maintenance" and
            state.agent.state.updated_at == "2026-02-24T01:14:00Z"
        end)

      assert server_state.agent.state.status == "maintenance"
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
