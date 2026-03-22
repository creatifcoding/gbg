defmodule Maiden.PlantRuntime.RuntimeTest do
  use ExUnit.Case, async: false

  alias Maiden.PlantRuntime
  alias Maiden.PlantRuntime.Agent
  alias Maiden.PlantRuntime.PlantFactory

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  test "storage/1 resolves default ETS table" do
    assert {Jido.Storage.ETS, opts} = PlantRuntime.storage()
    assert Keyword.get(opts, :table) == :maiden_plant_runtime
  end

  test "apply_signal_sync runs legal transition through runtime loop" do
    agent =
      Agent.new(
        id: "plant-runtime-loop-001",
        state:
          PlantFactory.new_plant(
            slug: "runtime-loop-001",
            name: "Runtime Loop Plant",
            status: "commissioning",
            created_at: "2026-02-24T00:00:00Z"
          )
      )

    {:ok, updated_agent, unresolved} =
      Agent.apply_signal_sync(agent, "plant.transition.operational", %{
        "plant_id" => agent.state.plant_id,
        "from" => "commissioning",
        "to" => "operational",
        "at" => "2026-02-24T00:20:00Z",
        "reason" => "initial_startup",
        "initiated_by" => "ops-1"
      })

    assert updated_agent.state.status == "operational"
    assert updated_agent.state.updated_at == "2026-02-24T00:20:00Z"
    assert updated_agent.state.__strategy__.machine.status == "idle"
    assert unresolved == []
  end
end
