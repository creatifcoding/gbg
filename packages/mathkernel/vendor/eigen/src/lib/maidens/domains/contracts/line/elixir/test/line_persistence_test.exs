defmodule Maiden.LineRuntime.LinePersistenceTest do
  use ExUnit.Case, async: false

  alias Maiden.LineRuntime
  alias Maiden.LineRuntime.Agent
  alias Maiden.LineRuntime.LineFactory

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  describe "snapshot/thaw" do
    test "round-trips persisted line runtime state" do
      table = unique_table(:line_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "line-persist-001",
          state:
            LineFactory.new_line(
              slug: "persist-001",
              name: "Persist Line",
              status: "running",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "line.transition.blocked", %{
          "line_id" => base_agent.state.line_id,
          "from" => "running",
          "to" => "blocked",
          "at" => "2026-02-24T02:05:00Z",
          "reason" => "downstream_jam",
          "initiated_by" => "operator-persist"
        })

      assert :ok = LineRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} =
               LineRuntime.thaw("line-persist-001", table: table)

      assert restored_agent.state.line_id == base_agent.state.line_id
      assert restored_agent.state.status == "blocked"
      assert restored_agent.state.updated_at == "2026-02-24T02:05:00Z"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:line_runtime_invalid)
      key = {Agent, "line-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "line-persist-invalid",
        state: %{
          line_id: "LIN-persist-invalid",
          name: "Broken Line",
          status: 123,
          description: nil,
          location: nil,
          metadata: %{},
          hierarchy_path: "/ENT-acme/SIT-main/PLT-main/LIN-persist-invalid",
          enterprise_id: nil,
          site_id: nil,
          area_id: nil,
          plant_id: "PLT-main",
          capacity: nil,
          line_type: nil,
          operating_hours_per_day: nil,
          created_at: "2026-02-24T02:00:00Z",
          updated_at: nil
        }
      }

      assert :ok = Jido.Storage.ETS.put_checkpoint(key, invalid_checkpoint, table: table)

      assert {:error, %{validator: :ex_json_schema}} =
               LineRuntime.thaw("line-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:line_runtime_delete)

      agent =
        Agent.new(
          id: "line-persist-delete",
          state:
            LineFactory.new_line(
              slug: "persist-delete",
              name: "Delete Line",
              status: "starved",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      assert :ok = LineRuntime.snapshot(agent, table: table)
      assert :ok = LineRuntime.delete_snapshot("line-persist-delete", table: table)
      assert {:error, :not_found} = LineRuntime.thaw("line-persist-delete", table: table)
    end
  end

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end
end
