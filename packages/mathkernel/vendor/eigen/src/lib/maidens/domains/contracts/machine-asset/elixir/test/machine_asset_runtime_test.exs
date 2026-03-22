defmodule Maiden.MachineAssetRuntime.RuntimeTest do
  use ExUnit.Case, async: false

  alias Maiden.MachineAssetRuntime
  alias Maiden.MachineAssetRuntime.Agent
  alias Maiden.MachineAssetRuntime.MachineAssetFactory

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  test "storage/1 resolves default ETS table" do
    assert {Jido.Storage.ETS, opts} = MachineAssetRuntime.storage()
    assert Keyword.get(opts, :table) == :maiden_machine_asset_runtime
  end

  test "apply_signal_sync runs legal transition through runtime loop" do
    agent =
      Agent.new(
        id: "machine-asset-runtime-loop-001",
        state:
          MachineAssetFactory.new_machine_asset(
            slug: "runtime-loop-001",
            name: "Runtime Loop Machine",
            status: "commissioned",
            created_at: "2026-02-24T00:00:00Z"
          )
      )

    {:ok, updated_agent, unresolved} =
      Agent.apply_signal_sync(agent, "machine_asset.transition.operational", %{
        "machine_id" => agent.state.machine_id,
        "from" => "commissioned",
        "to" => "operational",
        "at" => "2026-02-24T00:20:00Z",
        "reason" => "commissioning_complete",
        "initiated_by" => "ops-1"
      })

    assert updated_agent.state.status == "operational"
    assert updated_agent.state.updated_at == "2026-02-24T00:20:00Z"
    assert updated_agent.state.__strategy__.machine.status == "idle"
    assert unresolved == []
  end
end
