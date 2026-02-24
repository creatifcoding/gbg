defmodule Maiden.WorkcellRuntime.PersistenceTest do
  use ExUnit.Case, async: false

  alias Maiden.WorkcellRuntime
  alias Maiden.WorkcellRuntime.Agent
  alias Maiden.WorkcellRuntime.WorkcellFactory

  setup_all do
    Application.ensure_all_started(:jido)
    :ok
  end

  describe "snapshot/thaw" do
    test "round-trips persisted workcell runtime state" do
      table = unique_table(:workcell_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "workcell-persist-001",
          state:
            WorkcellFactory.new_workcell(
              slug: "persist-001",
              line_id: "LIN-main-01",
              name: "Persist Cell",
              status: "running",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "workcell.transition.idle", %{
          "workcell_id" => base_agent.state.workcell_id,
          "from" => "running",
          "to" => "idle",
          "at" => "2026-02-24T02:05:00Z",
          "reason" => "no_order",
          "initiated_by" => "operator-persist"
        })

      assert :ok = WorkcellRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} = WorkcellRuntime.thaw("workcell-persist-001", table: table)

      assert restored_agent.state.workcell_id == base_agent.state.workcell_id
      assert restored_agent.state.status == "idle"
      assert restored_agent.state.updated_at == "2026-02-24T02:05:00Z"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:workcell_runtime_invalid)
      key = {Agent, "workcell-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "workcell-persist-invalid",
        state: %{
          workcell_id: "WCL-persist-invalid",
          line_id: "LIN-main-01",
          name: "Broken Cell",
          status: 123,
          cell_type: nil,
          cycle_time_seconds: nil,
          position: nil,
          description: nil,
          location: nil,
          metadata: %{},
          hierarchy_path: "/ENT-acme/SIT-main/PLT-01/LIN-main-01/WCL-persist-invalid",
          enterprise_id: nil,
          site_id: nil,
          area_id: nil,
          plant_id: nil,
          created_at: "2026-02-24T02:00:00Z",
          updated_at: nil
        }
      }

      assert :ok = Jido.Storage.ETS.put_checkpoint(key, invalid_checkpoint, table: table)

      assert {:error, %{validator: :ex_json_schema}} =
               WorkcellRuntime.thaw("workcell-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:workcell_runtime_delete)

      agent =
        Agent.new(
          id: "workcell-persist-delete",
          state:
            WorkcellFactory.new_workcell(
              slug: "persist-delete",
              line_id: "LIN-main-01",
              name: "Delete Cell",
              status: "blocked",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      assert :ok = WorkcellRuntime.snapshot(agent, table: table)
      assert :ok = WorkcellRuntime.delete_snapshot("workcell-persist-delete", table: table)
      assert {:error, :not_found} = WorkcellRuntime.thaw("workcell-persist-delete", table: table)
    end
  end

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end
end
