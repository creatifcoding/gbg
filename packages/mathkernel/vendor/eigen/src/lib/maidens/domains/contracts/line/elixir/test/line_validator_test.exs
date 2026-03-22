defmodule Maiden.LineRuntime.LineValidatorTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.LineRuntime.Agent
  alias Maiden.LineRuntime.FSM
  alias Maiden.LineRuntime.LineFactory
  alias Maiden.LineRuntime.Sensors.TransitionSensor
  alias Maiden.LineRuntime.Validators.LineValidator

  setup_all do
    ensure_jido_started()
    :ok
  end

  describe "line_validate/2" do
    test "accepts valid line payload" do
      payload =
        LineFactory.new_line(
          slug: "assembly-01",
          name: "Assembly Line 01",
          status: "running",
          hierarchy_path: "/ENT-acme/SIT-cleveland/PLT-main/LIN-assembly-01",
          plant_id: "PLT-main",
          capacity: 500,
          line_type: "assembly",
          operating_hours_per_day: 16,
          created_at: "2026-02-24T00:00:00Z"
        )
        |> stringify_keys()

      assert :ok = LineValidator.line_validate(payload)
    end

    test "rejects invalid line payload" do
      payload =
        LineFactory.new_line(
          slug: "assembly-02",
          name: "Assembly Line 02",
          status: "fault"
        )
        |> stringify_keys()

      assert {:error, %{validator: :ex_json_schema, errors: _}} =
               LineValidator.line_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload =
        LineFactory.new_transition_event(
          slug: "assembly-03",
          from: "running",
          to: "blocked",
          at: "2026-02-24T00:05:00Z"
        )
        |> stringify_keys()

      assert :ok = LineValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_runtime(payload)
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition" do
      payload =
        LineFactory.new_transition_event(
          slug: "assembly-04",
          from: "running",
          to: "decommissioned",
          at: "2026-02-24T00:06:00Z"
        )
        |> stringify_keys()

      assert :ok = LineValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "running",
                to: "decommissioned",
                allowed_next: ["idle", "changeover", "starved", "blocked", "maintenance"]
              }} = FSM.validate_transition_for_runtime(payload)
    end
  end

  describe "Jido agent preflight" do
    test "delegates transition preflight to FSM validator" do
      payload =
        LineFactory.new_transition_event(
          slug: "assembly-05",
          from: "idle",
          to: "running",
          at: "2026-02-24T00:07:00Z"
        )
        |> stringify_keys()

      assert :ok = Agent.preflight_transition(payload)
    end
  end

  describe "Jido action and signal wiring" do
    test "signal mutates status and resolves directives" do
      agent =
        Agent.new(
          id: "line-agent-running",
          state:
            LineFactory.new_line(
              slug: "agent-line-01",
              name: "Agent Line 01",
              status: "idle",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      {:ok, updated_agent, unresolved} =
        Agent.apply_signal_sync(agent, "line.transition.running", %{
          "line_id" => agent.state.line_id,
          "from" => "idle",
          "to" => "running",
          "at" => "2026-02-24T00:10:00Z",
          "reason" => "work_order_released",
          "initiated_by" => "scheduler-1"
        })

      assert updated_agent.state.status == "running"
      assert updated_agent.state.updated_at == "2026-02-24T00:10:00Z"
      assert unresolved == []
    end

    test "rejects unsupported signal types" do
      agent = Agent.new(id: "line-agent-unknown")

      assert {:error, :unknown_signal_type} =
               Agent.apply_signal(agent, "line.transition.unknown", %{})
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition before cmd" do
      agent =
        Agent.new(
          id: "line-agent-illegal",
          state:
            LineFactory.new_line(
              slug: "agent-line-illegal",
              name: "Illegal Line",
              status: "running",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      payload = %{
        "line_id" => agent.state.line_id,
        "from" => "running",
        "to" => "decommissioned",
        "at" => "2026-02-24T00:11:00Z"
      }

      assert {:error, %{validator: :fsm}} =
               Agent.apply_signal(agent, "line.transition.decommissioned", payload)
    end
  end

  describe "sensor ingress" do
    test "sensor emits transition signal only after preflight succeeds" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/test-line-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "line-sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "line_id" => "LIN-sensor-line-001",
          "from" => "idle",
          "to" => "running",
          "at" => "2026-02-24T00:12:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "line.transition.running"

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "line_id" => "LIN-sensor-line-001",
          "from" => "running",
          "to" => "decommissioned",
          "at" => "2026-02-24T00:13:00Z"
        })

      assert_receive {:signal, rejection_signal}, 1_000
      assert rejection_signal.type == "line.transition.rejected"
      assert rejection_signal.data.to == "decommissioned"
      assert rejection_signal.data.attempted_signal == "line.transition.decommissioned"
      assert rejection_signal.data.validator == :fsm
      assert is_binary(rejection_signal.data.trace_id)
    end

    test "sensor -> agent server -> action -> FSM loop mutates state" do
      ensure_jido_started()
      agent_id = "line-agent-sensor-#{System.unique_integer([:positive])}"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: Jido.default_instance(),
          agent: Agent,
          id: agent_id,
          initial_state:
            LineFactory.new_line(
              slug: "sensor-line-rt-001",
              name: "Sensor Runtime Line",
              status: "running",
              created_at: "2026-02-24T00:00:00Z"
            )
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/line-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "line-sensor-agent-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "line_id" => "LIN-sensor-line-rt-001",
          "from" => "running",
          "to" => "blocked",
          "at" => "2026-02-24T00:14:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.status == "blocked" and
            state.agent.state.updated_at == "2026-02-24T00:14:00Z" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.status == "blocked"
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
