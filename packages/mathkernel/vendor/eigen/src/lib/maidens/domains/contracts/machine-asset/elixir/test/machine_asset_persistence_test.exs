defmodule Maiden.MachineAssetRuntime.PersistenceTest do
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

  describe "snapshot/thaw" do
    test "round-trips persisted machine-asset runtime state" do
      table = unique_table(:machine_asset_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "machine-asset-persist-001",
          state:
            MachineAssetFactory.new_machine_asset(
              slug: "persist-001",
              name: "Persist Machine",
              status: "commissioned",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "machine_asset.transition.operational", %{
          "machine_id" => base_agent.state.machine_id,
          "from" => "commissioned",
          "to" => "operational",
          "at" => "2026-02-24T02:05:00Z",
          "reason" => "commissioning_complete",
          "initiated_by" => "operator-persist"
        })

      assert :ok = MachineAssetRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} =
               MachineAssetRuntime.thaw("machine-asset-persist-001", table: table)

      assert restored_agent.state.machine_id == base_agent.state.machine_id
      assert restored_agent.state.status == "operational"
      assert restored_agent.state.updated_at == "2026-02-24T02:05:00Z"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:machine_asset_runtime_invalid)
      key = {Agent, "machine-asset-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "machine-asset-persist-invalid",
        state: %{
          machine_id: "MCH-persist-invalid",
          name: "Broken Machine",
          status: 123,
          description: nil,
          location: nil,
          metadata: %{},
          created_at: "2026-02-24T02:00:00Z",
          updated_at: nil,
          hierarchy_path: "/ENT-acme/SIT-main/PLT-main/LIN-main/WCL-main/MCH-persist-invalid",
          enterprise_id: "ENT-acme",
          site_id: "SIT-main",
          plant_id: "PLT-main",
          line_id: "LIN-main",
          work_cell_id: "WCL-main",
          machine_type: "CNC",
          manufacturer: nil,
          model_number: nil,
          serial_number: nil,
          installation_date: nil,
          last_maintenance_date: nil,
          next_maintenance_date: nil
        }
      }

      assert :ok = Jido.Storage.ETS.put_checkpoint(key, invalid_checkpoint, table: table)

      assert {:error, %{validator: :ex_json_schema}} =
               MachineAssetRuntime.thaw("machine-asset-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:machine_asset_runtime_delete)

      agent =
        Agent.new(
          id: "machine-asset-persist-delete",
          state:
            MachineAssetFactory.new_machine_asset(
              slug: "persist-delete",
              name: "Delete Machine",
              status: "retired",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      assert :ok = MachineAssetRuntime.snapshot(agent, table: table)
      assert :ok = MachineAssetRuntime.delete_snapshot("machine-asset-persist-delete", table: table)
      assert {:error, :not_found} = MachineAssetRuntime.thaw("machine-asset-persist-delete", table: table)
    end
  end

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end
end
