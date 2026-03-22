defmodule Maiden.SensorAssetRuntime.PersistenceTest do
  use ExUnit.Case, async: false

  alias Maiden.SensorAssetRuntime
  alias Maiden.SensorAssetRuntime.Agent
  alias Maiden.SensorAssetRuntime.SensorAssetFactory

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  describe "snapshot/thaw" do
    test "round-trips persisted sensor-asset runtime state" do
      table = unique_table(:sensor_asset_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "sensor-asset-persist-001",
          state:
            SensorAssetFactory.new_sensor_asset(
              slug: "persist-001",
              name: "Persist Sensor",
              status: "active",
              sensor_type: "temperature",
              unit: "celsius",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "sensor_asset.transition.needs_calibration", %{
          "sensor_id" => base_agent.state.sensor_id,
          "from" => "active",
          "to" => "needs_calibration",
          "action" => "FlagForCalibration",
          "at" => "2026-02-24T02:05:00Z",
          "reason" => "drift_detected",
          "initiated_by" => "operator-persist"
        })

      assert :ok = SensorAssetRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} =
               SensorAssetRuntime.thaw("sensor-asset-persist-001", table: table)

      assert restored_agent.state.sensor_id == base_agent.state.sensor_id
      assert restored_agent.state.status == "needs_calibration"
      assert restored_agent.state.updated_at == "2026-02-24T02:05:00Z"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:sensor_asset_runtime_invalid)
      key = {Agent, "sensor-asset-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "sensor-asset-persist-invalid",
        state: %{
          sensor_id: "SNS-persist-invalid",
          name: "Broken Sensor",
          status: 123,
          sensor_type: "temperature",
          unit: "celsius",
          sample_rate_ms: nil,
          threshold_high: nil,
          threshold_critical: nil,
          threshold_low: nil,
          threshold_critical_low: nil,
          last_calibration_date: nil,
          next_calibration_date: nil,
          opc_ua_node_id: nil,
          description: nil,
          location: nil,
          metadata: %{},
          hierarchy_path: "/ENT-acme/SIT-main/PLT-main/LIN-main/WCL-main/MCH-main/SNS-persist-invalid",
          enterprise_id: "ENT-acme",
          site_id: "SIT-main",
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
               SensorAssetRuntime.thaw("sensor-asset-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:sensor_asset_runtime_delete)

      agent =
        Agent.new(
          id: "sensor-asset-persist-delete",
          state:
            SensorAssetFactory.new_sensor_asset(
              slug: "persist-delete",
              name: "Delete Sensor",
              status: "offline",
              sensor_type: "vibration",
              unit: "mm_s",
              created_at: "2026-02-24T02:00:00Z"
            )
        )

      assert :ok = SensorAssetRuntime.snapshot(agent, table: table)
      assert :ok = SensorAssetRuntime.delete_snapshot("sensor-asset-persist-delete", table: table)
      assert {:error, :not_found} = SensorAssetRuntime.thaw("sensor-asset-persist-delete", table: table)
    end
  end

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end
end
