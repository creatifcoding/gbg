defmodule Maiden.OrderRuntime.PersistenceTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Jido.Thread
  alias Maiden.OrderRuntime
  alias Maiden.OrderRuntime.Agent
  alias Maiden.OrderRuntime.OrderId
  alias Maiden.OrderRuntime.Sensors.TransitionSensor

  setup_all do
    Application.ensure_all_started(:jido)

    case Jido.start() do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
    end

    :ok
  end

  describe "snapshot/thaw" do
    test "round-trips persisted order runtime state" do
      table = unique_table(:order_runtime_roundtrip)

      base_agent =
        Agent.new(
          id: "order-persist-001",
          state: %{
            order_id: order_id("ORD-PERSIST-001"),
            customer: "Persist Penny",
            items: [%{sku: "SKU-PERSIST", qty: 2}],
            total: 21.0,
            cancelled_reason: nil,
            shipped_at: nil,
            delivered_at: nil
          }
        )

      {:ok, transitioned_agent, []} =
        Agent.apply_signal_sync(base_agent, "order.transition.shipped", %{
          "order_id" => order_id("ORD-PERSIST-001"),
          "from" => "confirmed",
          "to" => "shipped",
          "at" => "2026-02-22T06:20:00Z"
        })

      assert :ok = OrderRuntime.snapshot(transitioned_agent, table: table)

      assert {:ok, restored_agent} =
               OrderRuntime.thaw("order-persist-001", table: table)

      assert restored_agent.state.order_id == order_id("ORD-PERSIST-001")
      assert restored_agent.state.shipped_at == "2026-02-22T06:20:00Z"
      assert restored_agent.state.__strategy__.machine.status == "idle"
    end

    test "persists thread pointer and rehydrates thread on thaw" do
      table = unique_table(:order_runtime_thread)
      thread_id = "order-thread-#{System.unique_integer([:positive])}"

      thread =
        Thread.new(id: thread_id, metadata: %{domain: "order"})
        |> Thread.append(%{kind: :signal, payload: %{type: "order.transition.confirmed"}})
        |> Thread.append(%{kind: :directive, payload: %{type: "RunInstruction", status: "ok"}})

      agent =
        Agent.new(
          id: "order-persist-thread-001",
          state: %{
            order_id: order_id("ORD-PERSIST-THREAD-001"),
            customer: "Thread Theo",
            items: [%{sku: "SKU-THREAD", qty: 1}],
            total: 55.0,
            cancelled_reason: nil,
            shipped_at: nil,
            delivered_at: nil,
            __thread__: thread
          }
        )

      assert :ok = OrderRuntime.snapshot(agent, table: table)

      checkpoint_key = {Agent, "order-persist-thread-001"}

      assert {:ok, checkpoint} =
               Jido.Storage.fetch_checkpoint(Jido.Storage.ETS, checkpoint_key, table: table)

      persisted_thread = agent.state.__thread__

      refute Map.has_key?(checkpoint.state, :__thread__)
      assert checkpoint.thread.id == persisted_thread.id
      assert checkpoint.thread.rev == persisted_thread.rev

      assert {:ok, restored_agent} =
               OrderRuntime.thaw("order-persist-thread-001", table: table)

      assert restored_agent.state.__thread__.id == persisted_thread.id
      assert restored_agent.state.__thread__.rev == persisted_thread.rev
      assert length(restored_agent.state.__thread__.entries) == persisted_thread.rev
    end

    test "restore rejects invalid checkpoint state payload" do
      table = unique_table(:order_runtime_invalid)
      key = {Agent, "order-persist-invalid"}

      invalid_checkpoint = %{
        version: 1,
        agent_module: Agent,
        id: "order-persist-invalid",
        state: %{
          order_id: order_id("ORD-PERSIST-INVALID"),
          customer: "Bad Payload",
          items: [],
          total: "not-a-number",
          cancelled_reason: nil,
          shipped_at: nil,
          delivered_at: nil
        }
      }

      assert :ok = Jido.Storage.ETS.put_checkpoint(key, invalid_checkpoint, table: table)

      assert {:error, %{validator: :ex_json_schema}} =
               OrderRuntime.thaw("order-persist-invalid", table: table)
    end

    test "delete_snapshot removes persisted checkpoint" do
      table = unique_table(:order_runtime_delete)

      agent =
        Agent.new(
          id: "order-persist-delete",
          state: %{
            order_id: order_id("ORD-PERSIST-DELETE"),
            customer: "Delete Dana",
            items: [%{sku: "SKU-DEL", qty: 1}],
            total: 3.0,
            cancelled_reason: nil,
            shipped_at: nil,
            delivered_at: nil
          }
        )

      assert :ok = OrderRuntime.snapshot(agent, table: table)
      assert :ok = OrderRuntime.delete_snapshot("order-persist-delete", table: table)
      assert {:error, :not_found} = OrderRuntime.thaw("order-persist-delete", table: table)
    end

    test "file storage keeps checkpoints durable across runtime lifecycle" do
      base_dir =
        Path.join(System.tmp_dir!(), "order-runtime-file-storage-#{System.unique_integer([:positive])}")

      on_exit(fn -> File.rm_rf(base_dir) end)

      storage = {Jido.Storage.File, [path: base_dir]}

      agent =
        Agent.new(
          id: "order-persist-file-001",
          state: %{
            order_id: order_id("ORD-PERSIST-FILE-001"),
            customer: "File Fiona",
            items: [%{sku: "SKU-FILE", qty: 1}],
            total: 88.0,
            cancelled_reason: nil,
            shipped_at: nil,
            delivered_at: nil
          }
        )

      assert :ok = OrderRuntime.snapshot(agent, storage: storage)
      assert {:ok, restored} = OrderRuntime.thaw("order-persist-file-001", storage: storage)

      assert restored.state.order_id == order_id("ORD-PERSIST-FILE-001")
      assert restored.state.customer == "File Fiona"
      assert restored.state.total == 88.0

      assert :ok = OrderRuntime.delete_snapshot("order-persist-file-001", storage: storage)
      assert {:error, :not_found} = OrderRuntime.thaw("order-persist-file-001", storage: storage)
    end
  end

  describe "restart continuity" do
    test "thaw + AgentServer restart resumes lifecycle transitions" do
      table = unique_table(:order_runtime_restart)
      agent_id = "order-persist-restart-#{System.unique_integer([:positive])}"

      base_agent =
        Agent.new(
          id: agent_id,
          state: %{
            order_id: order_id("ORD-PERSIST-RESTART-001"),
            customer: "Restart Robin",
            items: [%{sku: "SKU-RESTART", qty: 1}],
            total: 31.0,
            cancelled_reason: nil,
            shipped_at: nil,
            delivered_at: nil
          }
        )

      {:ok, shipped_agent, []} =
        Agent.apply_signal_sync(base_agent, "order.transition.shipped", %{
          "order_id" => order_id("ORD-PERSIST-RESTART-001"),
          "from" => "confirmed",
          "to" => "shipped",
          "at" => "2026-02-22T06:25:00Z"
        })

      assert :ok = OrderRuntime.snapshot(shipped_agent, table: table)
      assert {:ok, restored_agent} = OrderRuntime.thaw(agent_id, table: table)
      assert restored_agent.state.shipped_at == "2026-02-22T06:25:00Z"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: Jido.default_instance(),
          agent: restored_agent,
          agent_module: Agent
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/order-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "sensor-restart-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "order_id" => order_id("ORD-PERSIST-RESTART-001"),
          "from" => "shipped",
          "to" => "delivered",
          "at" => "2026-02-22T06:30:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.shipped_at == "2026-02-22T06:25:00Z" and
            state.agent.state.delivered_at == "2026-02-22T06:30:00Z" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.order_id == order_id("ORD-PERSIST-RESTART-001")
      assert server_state.agent.state.shipped_at == "2026-02-22T06:25:00Z"
      assert server_state.agent.state.delivered_at == "2026-02-22T06:30:00Z"
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

  defp order_id(slug) do
    OrderId.make(slug, deterministic_uuid(slug))
  end

  defp deterministic_uuid(slug) do
    hash = :crypto.hash(:sha256, slug) |> Base.encode16(case: :lower)

    <<a::binary-size(8), b::binary-size(4), c::binary-size(3), d::binary-size(3),
      e::binary-size(12), _::binary>> = hash

    "#{a}-#{b}-4#{c}-8#{d}-#{e}"
  end
end
