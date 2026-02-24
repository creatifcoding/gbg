defmodule Maiden.DeviceRuntime.PersistenceTest do
  use ExUnit.Case, async: false

  alias Maiden.DeviceRuntime
  alias Maiden.DeviceRuntime.Agent
  alias Maiden.DeviceRuntime.DeviceFactory

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  describe "snapshot/thaw" do
    test "round-trips persisted device runtime state" do
      table = unique_table(:device_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "device-persist-001",
          state:
            DeviceFactory.new_device(
              slug: "persist-001",
              name: "Persist Device",
              status: "online",
              device_type: "motor",
              machine_id: "MCH-persist-1",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "device.transition.faulted", %{
          "device_id" => base_agent.state.device_id,
          "from" => "online",
          "to" => "faulted",
          "action" => "MarkFaulted",
          "at" => "2026-02-24T02:05:00Z",
          "reason" => "overcurrent_trip",
          "initiated_by" => "controller-9"
        })

      assert :ok = DeviceRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} =
               DeviceRuntime.thaw("device-persist-001", table: table)

      assert restored_agent.state.device_id == base_agent.state.device_id
      assert restored_agent.state.status == "faulted"
      assert restored_agent.state.updated_at == "2026-02-24T02:05:00Z"
      assert restored_agent.state.last_command_at == "2026-02-24T02:05:00Z"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:device_runtime_invalid)
      key = {Agent, "device-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "device-persist-invalid",
        state: %{
          device_id: "DEV-persist-invalid",
          name: "Broken Device",
          status: 123,
          device_type: "motor",
          control_mode: nil,
          rated_power: nil,
          power_unit: nil,
          last_command_at: nil,
          opc_ua_node_id: nil,
          description: nil,
          location: nil,
          metadata: %{},
          hierarchy_path: "/ENT-acme/SIT-main/PLT-main/LIN-main/WCL-main/MCH-main/DEV-persist-invalid",
          enterprise_id: nil,
          site_id: nil,
          area_id: nil,
          plant_id: "PLT-main",
          line_id: "LIN-main",
          work_cell_id: "WCL-main",
          machine_id: "MCH-main",
          created_at: "2026-02-24T02:00:00Z",
          updated_at: nil
        }
      }

      assert :ok = Jido.Storage.ETS.put_checkpoint(key, invalid_checkpoint, table: table)

      assert {:error, %{validator: :ex_json_schema}} =
               DeviceRuntime.thaw("device-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:device_runtime_delete)

      agent =
        Agent.new(
          id: "device-persist-delete",
          state:
            DeviceFactory.new_device(
              slug: "persist-delete",
              name: "Delete Device",
              status: "offline",
              device_type: "valve",
              machine_id: "MCH-persist-2",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      assert :ok = DeviceRuntime.snapshot(agent, table: table)
      assert :ok = DeviceRuntime.delete_snapshot("device-persist-delete", table: table)
      assert {:error, :not_found} = DeviceRuntime.thaw("device-persist-delete", table: table)
    end
  end

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end
end
