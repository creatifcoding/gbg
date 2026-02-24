defmodule Maiden.EquipmentStateRuntime.PersistenceTest do
  use ExUnit.Case, async: false

  @jido_instance Maiden.EquipmentStateRuntime.PersistenceTest.Jido

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Jido.Thread
  alias Maiden.EquipmentStateRuntime
  alias Maiden.EquipmentStateRuntime.Agent
  alias Maiden.EquipmentStateRuntime.EquipmentStateId
  alias Maiden.EquipmentStateRuntime.Sensors.TransitionSensor

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start(name: @jido_instance) do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  describe "snapshot/thaw" do
    test "round-trips persisted equipment-state runtime state" do
      table = unique_table(:equipment_state_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "equipment-state-persist-001",
          state: %{
            equipment_state_id: equipment_state_id("EST-PERSIST-001"),
            machine_id: "MCH-PERSIST-001",
            state: "running",
            reason: "production",
            started_at: "2026-02-24T02:00:00Z",
            ended_at: nil,
            operator_id: "operator-persist",
            notes: nil,
            metadata: %{}
          }
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "equipment_state.transition.idle", %{
          "equipment_state_id" => equipment_state_id("EST-PERSIST-001"),
          "machine_id" => "MCH-PERSIST-001",
          "from" => "running",
          "to" => "idle",
          "at" => "2026-02-24T02:05:00Z",
          "reason" => "no_order",
          "operator_id" => "operator-persist"
        })

      assert :ok = EquipmentStateRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} =
               EquipmentStateRuntime.thaw("equipment-state-persist-001", table: table)

      assert restored_agent.state.equipment_state_id == equipment_state_id("EST-PERSIST-001")
      assert restored_agent.state.state == "idle"
      assert restored_agent.state.reason == "no_order"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "persists thread pointer and rehydrates thread on thaw" do
      table = unique_table(:equipment_state_runtime_thread)
      thread_id = "equipment-state-thread-#{System.unique_integer([:positive])}"

      thread =
        Thread.new(id: thread_id, metadata: %{domain: "equipment_state"})
        |> Thread.append(%{kind: :signal, payload: %{type: "equipment_state.transition.idle"}})
        |> Thread.append(%{kind: :directive, payload: %{type: "RunInstruction", status: "ok"}})

      agent =
        Agent.new(
          id: "equipment-state-persist-thread-001",
          state: %{
            equipment_state_id: equipment_state_id("EST-PERSIST-THREAD-001"),
            machine_id: "MCH-THREAD-001",
            state: "running",
            reason: "production",
            started_at: "2026-02-24T02:00:00Z",
            ended_at: nil,
            operator_id: nil,
            notes: nil,
            metadata: %{},
            __thread__: thread
          }
        )

      assert :ok = EquipmentStateRuntime.snapshot(agent, table: table)

      checkpoint_key = {Agent, "equipment-state-persist-thread-001"}

      assert {:ok, checkpoint} =
               Jido.Storage.fetch_checkpoint(Jido.Storage.ETS, checkpoint_key, table: table)

      persisted_thread = agent.state.__thread__

      refute Map.has_key?(checkpoint.state, :__thread__)
      assert checkpoint.thread.id == persisted_thread.id
      assert checkpoint.thread.rev == persisted_thread.rev

      assert {:ok, restored_agent} =
               EquipmentStateRuntime.thaw("equipment-state-persist-thread-001", table: table)

      assert restored_agent.state.__thread__.id == persisted_thread.id
      assert restored_agent.state.__thread__.rev == persisted_thread.rev
      assert length(restored_agent.state.__thread__.entries) == persisted_thread.rev
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:equipment_state_runtime_invalid)
      key = {Agent, "equipment-state-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "equipment-state-persist-invalid",
        state: %{
          equipment_state_id: equipment_state_id("EST-PERSIST-INVALID"),
          machine_id: "MCH-BAD",
          state: 123,
          reason: nil,
          started_at: "2026-02-24T02:00:00Z",
          ended_at: nil,
          operator_id: nil,
          notes: nil,
          metadata: %{}
        }
      }

      assert :ok = Jido.Storage.ETS.put_checkpoint(key, invalid_checkpoint, table: table)

      assert {:error, %{validator: :ex_json_schema}} =
               EquipmentStateRuntime.thaw("equipment-state-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:equipment_state_runtime_delete)

      agent =
        Agent.new(
          id: "equipment-state-persist-delete",
          state: %{
            equipment_state_id: equipment_state_id("EST-PERSIST-DELETE"),
            machine_id: "MCH-DEL",
            state: "blocked",
            reason: "blocked_downstream",
            started_at: "2026-02-24T02:00:00Z",
            ended_at: nil,
            operator_id: nil,
            notes: nil,
            metadata: %{}
          }
        )

      assert :ok = EquipmentStateRuntime.snapshot(agent, table: table)
      assert :ok = EquipmentStateRuntime.delete_snapshot("equipment-state-persist-delete", table: table)
      assert {:error, :not_found} = EquipmentStateRuntime.thaw("equipment-state-persist-delete", table: table)
    end
  end

  describe "restart continuity" do
    test "thaw + AgentServer restart resumes lifecycle transitions" do
      table = unique_table(:equipment_state_runtime_restart)
      agent_id = "equipment-state-persist-restart-#{System.unique_integer([:positive])}"

      base_agent =
        Agent.new(
          id: agent_id,
          state: %{
            equipment_state_id: equipment_state_id("EST-PERSIST-RESTART-001"),
            machine_id: "MCH-RESTART",
            state: "blocked",
            reason: "blocked_downstream",
            started_at: "2026-02-24T02:00:00Z",
            ended_at: nil,
            operator_id: "operator-r",
            notes: nil,
            metadata: %{}
          }
        )

      assert :ok = EquipmentStateRuntime.snapshot(base_agent, table: table)
      assert {:ok, restored_agent} = EquipmentStateRuntime.thaw(agent_id, table: table)
      assert restored_agent.state.state == "blocked"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: @jido_instance,
          agent: restored_agent,
          agent_module: Agent
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/equipment-state-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "sensor-restart-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "equipment_state_id" => equipment_state_id("EST-PERSIST-RESTART-001"),
          "machine_id" => "MCH-RESTART",
          "from" => "blocked",
          "to" => "running",
          "at" => "2026-02-24T02:20:00Z",
          "reason" => "production"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.state == "running" and
            state.agent.state.reason == "production" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.equipment_state_id == equipment_state_id("EST-PERSIST-RESTART-001")
      assert server_state.agent.state.state == "running"
      assert server_state.agent.state.reason == "production"
    end
  end

  defp await_agent_server_state(agent_server_pid, predicate, attempts \\ 20)

  defp await_agent_server_state(_agent_server_pid, _predicate, 0), do: {:error, :timeout}

  defp await_agent_server_state(agent_server_pid, predicate, attempts) do
    case AgentServer.state(agent_server_pid) do
      {:ok, state} ->
        if predicate.(state) do
          {:ok, state}
        else
          Process.sleep(50)
          await_agent_server_state(agent_server_pid, predicate, attempts - 1)
        end

      error ->
        error
    end
  end

  defp unique_table(prefix) do
    String.to_atom("#{prefix}_#{System.unique_integer([:positive])}")
  end

  defp equipment_state_id(slug) do
    EquipmentStateId.make(slug, deterministic_uuid(slug))
  end

  defp deterministic_uuid(slug) do
    hash = :crypto.hash(:sha256, slug) |> Base.encode16(case: :lower)

    <<a::binary-size(8), b::binary-size(4), c::binary-size(3), d::binary-size(3),
      e::binary-size(12), _::binary>> = hash

    "#{a}-#{b}-4#{c}-8#{d}-#{e}"
  end
end
