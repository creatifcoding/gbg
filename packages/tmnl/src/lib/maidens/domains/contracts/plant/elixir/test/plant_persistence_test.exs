defmodule Maiden.PlantRuntime.PersistenceTest do
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

  describe "snapshot/thaw" do
    test "round-trips persisted plant runtime state" do
      table = unique_table(:plant_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "plant-persist-001",
          state:
            PlantFactory.new_plant(
              slug: "persist-001",
              name: "Persist Plant",
              status: "operational",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "plant.transition.scheduled_shutdown", %{
          "plant_id" => base_agent.state.plant_id,
          "from" => "operational",
          "to" => "scheduled_shutdown",
          "at" => "2026-02-24T02:05:00Z",
          "reason" => "planned_maintenance_window",
          "initiated_by" => "operator-persist"
        })

      assert :ok = PlantRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} =
               PlantRuntime.thaw("plant-persist-001", table: table)

      assert restored_agent.state.plant_id == base_agent.state.plant_id
      assert restored_agent.state.status == "scheduled_shutdown"
      assert restored_agent.state.updated_at == "2026-02-24T02:05:00Z"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:plant_runtime_invalid)
      key = {Agent, "plant-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "plant-persist-invalid",
        state: %{
          plant_id: "PLT-persist-invalid",
          name: "Broken Plant",
          status: 123,
          timezone: "UTC",
          site_code: nil,
          description: nil,
          location: nil,
          metadata: %{},
          hierarchy_path: "/ENT-acme/SIT-main/AREA-main/PLT-persist-invalid",
          enterprise_id: "ENT-acme",
          site_id: "SIT-main",
          area_id: "AREA-main",
          created_at: "2026-02-24T02:00:00Z",
          updated_at: nil
        }
      }

      assert :ok = Jido.Storage.ETS.put_checkpoint(key, invalid_checkpoint, table: table)

      assert {:error, %{validator: :ex_json_schema}} =
               PlantRuntime.thaw("plant-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:plant_runtime_delete)

      agent =
        Agent.new(
          id: "plant-persist-delete",
          state:
            PlantFactory.new_plant(
              slug: "persist-delete",
              name: "Delete Plant",
              status: "commissioning",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      assert :ok = PlantRuntime.snapshot(agent, table: table)
      assert :ok = PlantRuntime.delete_snapshot("plant-persist-delete", table: table)
      assert {:error, :not_found} = PlantRuntime.thaw("plant-persist-delete", table: table)
    end
  end

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end
end
