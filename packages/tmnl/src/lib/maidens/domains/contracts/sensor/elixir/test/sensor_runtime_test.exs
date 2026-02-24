defmodule Maiden.SensorRuntime.RuntimeTest do
  use ExUnit.Case, async: false

  alias Maiden.SensorRuntime
  alias Maiden.SensorRuntime.Agent
  alias Maiden.SensorRuntime.SensorFactory

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  test "storage/1 resolves default ETS table" do
    assert {Jido.Storage.ETS, opts} = SensorRuntime.storage()
    assert Keyword.get(opts, :table) == :maiden_sensor_runtime
  end

  test "apply_signal_sync runs legal transition through runtime loop" do
    agent =
      Agent.new(
        id: "sensor-runtime-loop-001",
        state:
          SensorFactory.new_sensor(
            slug: "runtime-loop-001",
            name: "Runtime Loop Sensor",
            status: "active",
            sensor_type: "temperature",
            unit: "celsius",
            created_at: "2026-02-24T00:00:00Z"
          )
      )

    {:ok, updated_agent, unresolved} =
      Agent.apply_signal_sync(agent, "sensor.transition.calibrating", %{
        "sensor_id" => agent.state.sensor_id,
        "from" => "active",
        "to" => "calibrating",
        "at" => "2026-02-24T00:20:00Z",
        "action" => "StartCalibration",
        "reason" => "scheduled_check",
        "initiated_by" => "ops-1"
      })

    assert updated_agent.state.status == "calibrating"
    assert updated_agent.state.updated_at == "2026-02-24T00:20:00Z"
    assert updated_agent.state.__strategy__.machine.status == "idle"
    assert unresolved == []
  end
end
