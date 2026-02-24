defmodule Maiden.AreaRuntime.PersistenceTest do
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

  describe "snapshot/thaw" do
    test "round-trips persisted area runtime state" do
      table = unique_table(:area_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "area-persist-001",
          state:
            AreaFactory.new_area(
              slug: "persist-001",
              name: "Persist Area",
              status: "active",
              enterprise_id: "ENT-acme",
              site_id: "SIT-cleveland",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "area.transition.maintenance", %{
          "area_id" => base_agent.state.area_id,
          "from" => "active",
          "to" => "maintenance",
          "at" => "2026-02-24T02:05:00Z",
          "reason" => "scheduled_maintenance",
          "by" => "operator-persist"
        })

      assert :ok = AreaRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} =
               AreaRuntime.thaw("area-persist-001", table: table)

      assert restored_agent.state.area_id == base_agent.state.area_id
      assert restored_agent.state.status == "maintenance"
      assert restored_agent.state.updated_at == "2026-02-24T02:05:00Z"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:area_runtime_invalid)
      key = {Agent, "area-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "area-persist-invalid",
        state: %{
          area_id: "ARA-persist-invalid",
          name: "Broken Area",
          status: 123,
          enterprise_id: "ENT-acme",
          site_id: "SIT-cleveland",
          area_type: nil,
          building: nil,
          floor: nil,
          zone: nil,
          description: nil,
          location: nil,
          metadata: %{},
          hierarchy_path: "/ENT-acme/SIT-cleveland/ARA-persist-invalid",
          created_at: "2026-02-24T02:00:00Z",
          updated_at: nil
        }
      }

      assert :ok = Jido.Storage.ETS.put_checkpoint(key, invalid_checkpoint, table: table)

      assert {:error, %{validator: :ex_json_schema}} =
               AreaRuntime.thaw("area-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:area_runtime_delete)

      agent =
        Agent.new(
          id: "area-persist-delete",
          state:
            AreaFactory.new_area(
              slug: "persist-delete",
              name: "Delete Area",
              status: "inactive",
              enterprise_id: "ENT-acme",
              site_id: "SIT-cleveland",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      assert :ok = AreaRuntime.snapshot(agent, table: table)
      assert :ok = AreaRuntime.delete_snapshot("area-persist-delete", table: table)
      assert {:error, :not_found} = AreaRuntime.thaw("area-persist-delete", table: table)
    end
  end

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end
end
