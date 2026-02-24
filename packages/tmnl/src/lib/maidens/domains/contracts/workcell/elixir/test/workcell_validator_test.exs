defmodule Maiden.WorkcellRuntime.ValidatorTest do
  use ExUnit.Case, async: false

  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.WorkcellRuntime.Agent
  alias Maiden.WorkcellRuntime.FSM
  alias Maiden.WorkcellRuntime.Sensors.TransitionSensor
  alias Maiden.WorkcellRuntime.WorkcellFactory
  alias Maiden.WorkcellRuntime.Validators.WorkcellValidator

  setup_all do
    ensure_jido_started()
    :ok
  end

  describe "workcell_validate/2" do
    test "accepts valid workcell payload" do
      payload =
        WorkcellFactory.new_workcell(
          slug: "welding-01",
          line_id: "LIN-assembly-01",
          name: "Welding Cell 01",
          status: "running",
          hierarchy_path: "/ENT-acme/SIT-main/PLT-01/LIN-assembly-01/WCL-welding-01",
          created_at: "2026-02-24T01:00:00Z"
        )
        |> stringify_keys()

      assert :ok = WorkcellValidator.workcell_validate(payload)
    end

    test "rejects invalid workcell payload" do
      payload =
        WorkcellFactory.new_workcell(
          slug: "welding-02",
          line_id: "LIN-assembly-01",
          name: "Welding Cell 02",
          status: "fault"
        )
        |> stringify_keys()

      assert {:error, %{validator: :ex_json_schema, errors: _}} =
               WorkcellValidator.workcell_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload =
        WorkcellFactory.new_transition_event(
          slug: "welding-03",
          from: "setup",
          to: "running",
          at: "2026-02-24T01:05:00Z"
        )
        |> stringify_keys()

      assert :ok = WorkcellValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_runtime(payload)
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition" do
      payload =
        WorkcellFactory.new_transition_event(
          slug: "welding-04",
          from: "setup",
          to: "maintenance",
          at: "2026-02-24T01:06:00Z"
        )
        |> stringify_keys()

      assert :ok = WorkcellValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "setup",
                to: "maintenance",
                allowed_next: ["running"]
              }} = FSM.validate_transition_for_runtime(payload)
    end
  end

  describe "agent transition wiring" do
    test "signal mutates status and emits no unresolved directives" do
      agent =
        Agent.new(
          id: "workcell-agent-running",
          state:
            WorkcellFactory.new_workcell(
              slug: "agent-cell-01",
              line_id: "LIN-assembly-01",
              name: "Agent Cell",
              status: "setup",
              created_at: "2026-02-24T01:00:00Z",
              updated_at: nil
            )
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "workcell.transition.running", %{
          "workcell_id" => agent.state.workcell_id,
          "from" => "setup",
          "to" => "running",
          "at" => "2026-02-24T01:10:00Z",
          "reason" => "changeover_complete",
          "initiated_by" => "operator-1"
        })

      assert updated_agent.state.status == "running"
      assert updated_agent.state.updated_at == "2026-02-24T01:10:00Z"
      assert unresolved == []
    end

    test "rejected signal is observable without mutating workcell state" do
      agent =
        Agent.new(
          id: "workcell-agent-rejected",
          state:
            WorkcellFactory.new_workcell(
              slug: "agent-cell-rejected",
              line_id: "LIN-assembly-01",
              name: "Rejected Agent Cell",
              status: "running",
              created_at: "2026-02-24T01:00:00Z",
              updated_at: nil
            )
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "workcell.transition.rejected", %{
          "workcell_id" => agent.state.workcell_id,
          "from" => "running",
          "to" => "running",
          "at" => "2026-02-24T01:12:00Z",
          "attempted_signal" => "workcell.transition.running",
          "validator" => :fsm,
          "trace_id" => "trace-001"
        })

      assert updated_agent.state.status == "running"
      assert unresolved == []
    end
  end

  describe "sensor ingress" do
    test "sensor emits transition signal for legal transition" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/workcell-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "workcell-sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "workcell_id" => "WCL-sensor-workcell-001",
          "from" => "setup",
          "to" => "running",
          "at" => "2026-02-24T01:20:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "workcell.transition.running"
    end

    test "sensor emits rejection signal for illegal transition when emit_rejections=true" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/workcell-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "workcell-sensor-reject-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "workcell_id" => "WCL-sensor-workcell-001",
          "from" => "setup",
          "to" => "maintenance",
          "at" => "2026-02-24T01:21:00Z",
          "trace_id" => "trace-workcell-001"
        })

      assert_receive {:signal, rejection_signal}, 1_000
      assert rejection_signal.type == "workcell.transition.rejected"
      assert rejection_signal.data.to == "maintenance"
      assert rejection_signal.data.attempted_signal == "workcell.transition.maintenance"
      assert rejection_signal.data.validator == :fsm
      assert rejection_signal.data.trace_id == "trace-workcell-001"
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
