defmodule Maiden.MachineAssetRuntime.ValidatorTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.MachineAssetRuntime.Agent
  alias Maiden.MachineAssetRuntime.FSM
  alias Maiden.MachineAssetRuntime.MachineAssetFactory
  alias Maiden.MachineAssetRuntime.Sensors.TransitionSensor
  alias Maiden.MachineAssetRuntime.Validators.MachineAssetValidator

  setup_all do
    ensure_jido_started()
    :ok
  end

  describe "machine_asset_validate/2" do
    test "accepts valid machine payload" do
      payload =
        MachineAssetFactory.new_machine_asset(
          slug: "cnc-001",
          status: "operational",
          name: "CNC 001",
          machine_type: "CNC",
          hierarchy_path: "/ENT-acme/SIT-cleveland/PLT-main/LIN-body/WCL-cell-01/MCH-cnc-001",
          enterprise_id: "ENT-acme",
          site_id: "SIT-cleveland",
          plant_id: "PLT-main",
          line_id: "LIN-body",
          work_cell_id: "WCL-cell-01",
          metadata: %{"owner" => "reliability"}
        )
        |> stringify_keys()

      assert :ok = MachineAssetValidator.machine_asset_validate(payload)
      assert :ok = MachineAssetValidator.agent_state_validate(payload)
    end

    test "rejects invalid enum payload" do
      payload =
        MachineAssetFactory.new_machine_asset(
          slug: "cnc-002",
          status: "running"
        )
        |> stringify_keys()

      assert {:error, %{validator: :ex_json_schema, errors: _}} =
               MachineAssetValidator.machine_asset_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload =
        MachineAssetFactory.new_machine_asset_transition_event(
          slug: "cnc-003",
          from: "commissioned",
          to: "operational",
          at: "2026-02-24T01:05:00Z"
        )
        |> stringify_keys()

      assert :ok = MachineAssetValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_runtime(payload)
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition" do
      payload =
        MachineAssetFactory.new_machine_asset_transition_event(
          slug: "cnc-004",
          from: "operational",
          to: "decommissioned",
          at: "2026-02-24T01:06:00Z"
        )
        |> stringify_keys()

      assert :ok = MachineAssetValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "operational",
                to: "decommissioned",
                allowed_next: ["idle", "faulted", "scheduled_maintenance", "retired"]
              }} = FSM.validate_transition_for_runtime(payload)
    end
  end

  describe "Jido agent preflight" do
    test "delegates transition preflight to FSM validator" do
      payload =
        MachineAssetFactory.new_machine_asset_transition_event(
          slug: "cnc-005",
          from: "commissioned",
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
          id: "machine-asset-agent-running",
          state:
            MachineAssetFactory.new_machine_asset(
              slug: "agent-machine-01",
              name: "Agent Machine 01",
              status: "commissioned",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "machine_asset.transition.operational", %{
          "machine_id" => agent.state.machine_id,
          "from" => "commissioned",
          "to" => "operational",
          "at" => "2026-02-24T01:10:00Z",
          "reason" => "commissioning_complete",
          "initiated_by" => "tech-1"
        })

      assert updated_agent.state.status == "operational"
      assert updated_agent.state.updated_at == "2026-02-24T01:10:00Z"
      assert unresolved == []
    end

    test "rejects unsupported signal types" do
      agent = Agent.new(id: "machine-asset-agent-unknown")

      assert {:error, :unknown_signal_type} =
               Agent.apply_signal(agent, "machine_asset.transition.unknown", %{})
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition before cmd" do
      agent =
        Agent.new(
          id: "machine-asset-agent-illegal",
          state:
            MachineAssetFactory.new_machine_asset(
              slug: "agent-machine-illegal",
              name: "Illegal Machine",
              status: "operational",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      payload = %{
        "machine_id" => agent.state.machine_id,
        "from" => "operational",
        "to" => "decommissioned",
        "at" => "2026-02-24T01:11:00Z"
      }

      assert {:error, %{validator: :fsm}} =
               Agent.apply_signal(agent, "machine_asset.transition.decommissioned", payload)
    end
  end

  describe "sensor ingress" do
    test "sensor emits transition signal only after preflight succeeds" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/test-machine-asset-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "machine-asset-sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "machine_id" => "MCH-sensor-machine-001",
          "from" => "commissioned",
          "to" => "operational",
          "at" => "2026-02-24T01:12:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "machine_asset.transition.operational"

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "machine_id" => "MCH-sensor-machine-001",
          "from" => "operational",
          "to" => "decommissioned",
          "at" => "2026-02-24T01:13:00Z"
        })

      assert_receive {:signal, rejection_signal}, 1_000
      assert rejection_signal.type == "machine_asset.transition.rejected"
      assert rejection_signal.data.to == "decommissioned"
      assert rejection_signal.data.attempted_signal == "machine_asset.transition.decommissioned"
      assert rejection_signal.data.validator == :fsm
      assert is_binary(rejection_signal.data.trace_id)
    end

    test "sensor -> agent server -> action -> FSM loop mutates state" do
      ensure_jido_started()
      agent_id = "machine-asset-agent-sensor-#{System.unique_integer([:positive])}"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: Jido.default_instance(),
          agent: Agent,
          id: agent_id,
          initial_state:
            MachineAssetFactory.new_machine_asset(
              slug: "sensor-machine-rt-001",
              name: "Sensor Runtime Machine",
              status: "operational",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/machine-asset-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "machine-asset-sensor-agent-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "machine_id" => "MCH-sensor-machine-rt-001",
          "from" => "operational",
          "to" => "idle",
          "at" => "2026-02-24T01:14:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.status == "idle" and
            state.agent.state.updated_at == "2026-02-24T01:14:00Z" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.status == "idle"
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
