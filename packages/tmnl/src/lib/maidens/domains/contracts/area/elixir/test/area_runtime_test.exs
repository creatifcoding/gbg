defmodule Maiden.AreaRuntime.RuntimeTest do
  use ExUnit.Case, async: false

  alias Maiden.AreaRuntime
  alias Maiden.AreaRuntime.Agent
  alias Maiden.AreaRuntime.AreaFactory

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  test "storage/1 resolves default ETS table" do
    assert {Jido.Storage.ETS, opts} = AreaRuntime.storage()
    assert Keyword.get(opts, :table) == :maiden_area_runtime
  end

  test "apply_signal_sync runs legal transition through runtime loop" do
    agent =
      Agent.new(
        id: "area-runtime-loop-001",
        state:
          AreaFactory.new_area(
            slug: "runtime-loop-001",
            name: "Runtime Loop Area",
            status: "active",
            enterprise_id: "ENT-acme",
            site_id: "SIT-cleveland",
            created_at: "2026-02-24T00:00:00Z"
          )
      )

    {:ok, updated_agent, unresolved} =
      Agent.apply_signal_sync(agent, "area.transition.maintenance", %{
        "area_id" => agent.state.area_id,
        "from" => "active",
        "to" => "maintenance",
        "at" => "2026-02-24T00:20:00Z",
        "reason" => "scheduled_service",
        "by" => "ops-1"
      })

    assert updated_agent.state.status == "maintenance"
    assert updated_agent.state.updated_at == "2026-02-24T00:20:00Z"
    assert updated_agent.state.__strategy__.machine.status == "idle"
    assert unresolved == []
  end
end
