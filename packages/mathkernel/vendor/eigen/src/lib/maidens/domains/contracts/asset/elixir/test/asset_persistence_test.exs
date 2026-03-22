defmodule Maiden.AssetRuntime.PersistenceTest do
  use ExUnit.Case, async: false

  alias Maiden.AssetRuntime
  alias Maiden.AssetRuntime.Agent
  alias Maiden.AssetRuntime.AssetFactory

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  describe "snapshot/thaw" do
    test "round-trips persisted asset runtime state" do
      table = unique_table(:asset_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "asset-persist-001",
          state:
            AssetFactory.new_asset(
              slug: "persist-001",
              kind: "machine",
              name: "Persist Machine",
              status: "active",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "asset.transition.maintenance", %{
          "asset_id" => base_agent.state.asset_id,
          "kind" => "machine",
          "from" => "active",
          "to" => "maintenance",
          "action" => "StartMaintenance",
          "at" => "2026-02-24T02:05:00Z",
          "reason" => "scheduled_overhaul",
          "initiated_by" => "maint-persist"
        })

      assert :ok = AssetRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} =
               AssetRuntime.thaw("asset-persist-001", table: table)

      assert restored_agent.state.asset_id == base_agent.state.asset_id
      assert restored_agent.state.status == "maintenance"
      assert restored_agent.state.updated_at == "2026-02-24T02:05:00Z"
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:asset_runtime_invalid)
      key = {Agent, "asset-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "asset-persist-invalid",
        state: %{
          asset_id: "MCH-persist-invalid",
          name: "Broken Machine",
          kind: "machine",
          status: 123,
          description: nil,
          location: nil,
          properties: %{},
          metadata: %{},
          parent_id: "WCL-demo",
          hierarchy_path: "/ENT-demo/SIT-demo/ARA-demo/PLT-demo/LIN-demo/WCL-demo/MCH-persist-invalid",
          enterprise_id: "ENT-demo",
          site_id: "SIT-demo",
          area_id: "ARA-demo",
          plant_id: "PLT-demo",
          line_id: "LIN-demo",
          work_cell_id: "WCL-demo",
          machine_id: "MCH-persist-invalid",
          created_at: "2026-02-24T02:00:00Z",
          updated_at: nil
        }
      }

      assert :ok = Jido.Storage.ETS.put_checkpoint(key, invalid_checkpoint, table: table)

      assert {:error, %{validator: :ex_json_schema}} =
               AssetRuntime.thaw("asset-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:asset_runtime_delete)

      agent =
        Agent.new(
          id: "asset-persist-delete",
          state:
            AssetFactory.new_asset(
              slug: "persist-delete",
              kind: "site",
              name: "Delete Site",
              status: "inactive",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      assert :ok = AssetRuntime.snapshot(agent, table: table)
      assert :ok = AssetRuntime.delete_snapshot("asset-persist-delete", table: table)
      assert {:error, :not_found} = AssetRuntime.thaw("asset-persist-delete", table: table)
    end
  end

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end
end
