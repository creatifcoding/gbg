defmodule Maiden.OrderRuntime.StrategyBoundaryTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.OrderRuntime.Agent
  alias Maiden.OrderRuntime.Boundaries.{JobQueue, ModelAdapter, OrderStore}
  alias Maiden.OrderRuntime.OrderId
  alias Maiden.OrderRuntime.Strategies.SignalFsm

  defmodule OrderStoreProbe do
    @behaviour OrderStore

    @impl true
    def persist_transition(event, metadata, opts) do
      if pid = Application.get_env(:maiden_order_runtime, :boundary_probe_pid) do
        send(pid, {:persist_transition, event, metadata, opts})
      end

      :ok
    end
  end

  defmodule JobQueueProbe do
    @behaviour JobQueue

    @impl true
    def enqueue_transition(event, opts) do
      if pid = Application.get_env(:maiden_order_runtime, :boundary_probe_pid) do
        send(pid, {:enqueue_transition, event, opts})
      end

      :ok
    end
  end

  defmodule ModelAdapterProbe do
    @behaviour ModelAdapter

    @impl true
    def infer_model(prompt, opts) do
      if pid = Application.get_env(:maiden_order_runtime, :boundary_probe_pid) do
        send(pid, {:infer_model, prompt, opts})
      end

      {:ok, %{content: "probe-ok", prompt: prompt}}
    end
  end

  defmodule ModelAdapterErrorProbe do
    @behaviour ModelAdapter

    @impl true
    def infer_model(prompt, opts) do
      if pid = Application.get_env(:maiden_order_runtime, :boundary_probe_pid) do
        send(pid, {:infer_model, prompt, opts})
      end

      {:error, :adapter_down}
    end
  end

  setup do
    jido = start_test_jido_instance()

    flush_mailbox()
    old_store = Application.get_env(:maiden_order_runtime, :order_store_adapter)
    old_queue = Application.get_env(:maiden_order_runtime, :job_queue_adapter)
    old_model = Application.get_env(:maiden_order_runtime, :model_adapter)
    old_probe = Application.get_env(:maiden_order_runtime, :boundary_probe_pid)

    Application.put_env(:maiden_order_runtime, :order_store_adapter, OrderStoreProbe)
    Application.put_env(:maiden_order_runtime, :job_queue_adapter, JobQueueProbe)
    Application.put_env(:maiden_order_runtime, :model_adapter, ModelAdapterProbe)
    Application.put_env(:maiden_order_runtime, :boundary_probe_pid, self())

    on_exit(fn ->
      restore_env(:order_store_adapter, old_store)
      restore_env(:job_queue_adapter, old_queue)
      restore_env(:model_adapter, old_model)
      restore_env(:boundary_probe_pid, old_probe)
    end)

    {:ok, jido: jido}
  end

  test "strategy emits boundary directives for successful transition" do
    agent =
      Agent.new(
        id: "order-agent-boundary-001",
        state: %{
          order_id: order_id("ORD-BOUNDARY-001"),
          customer: "Boundary Bob",
          items: [%{sku: "SKU-B", qty: 1}],
          total: 10.0,
          cancelled_reason: nil,
          shipped_at: nil,
          delivered_at: nil
        }
      )

    {:ok, next_agent, unresolved} =
      Agent.apply_signal_sync(agent, "order.transition.shipped", %{
        "order_id" => order_id("ORD-BOUNDARY-001"),
        "from" => "confirmed",
        "to" => "shipped",
        "at" => "2026-02-23T00:00:00Z"
      })

    assert next_agent.state.shipped_at == "2026-02-23T00:00:00Z"
    assert unresolved == []

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "shipped"
    assert event.order_id == order_id("ORD-BOUNDARY-001")
    assert metadata.strategy == Maiden.OrderRuntime.Strategies.SignalFsm

    assert_receive {:enqueue_transition, job_event, job_opts}, 1_000
    assert job_event.to == "shipped"
    assert Keyword.get(job_opts, :queue) == :order_runtime_transition
  end

  test "agent server executes boundary directive handlers on signal path", %{jido: jido} do
    agent_id = "order-agent-boundary-server-#{System.unique_integer([:positive])}"

    {:ok, agent_server_pid} =
      AgentServer.start_link(
        jido: jido,
        agent: Agent,
        id: agent_id,
        initial_state: %{
          order_id: order_id("ORD-BOUNDARY-002"),
          customer: "Boundary Blair",
          items: [%{sku: "SKU-B2", qty: 1}],
          total: 16.0,
          cancelled_reason: nil,
          shipped_at: nil,
          delivered_at: nil
        }
      )

    on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

    {:ok, sensor_pid} =
      SensorRuntime.start_link(
        sensor: Maiden.OrderRuntime.Sensors.TransitionSensor,
        config: %{source: "/sensor/order-boundary"},
        context: %{agent_ref: agent_server_pid},
        id: "sensor-boundary-#{System.unique_integer([:positive])}"
      )

    on_exit(fn -> Process.exit(sensor_pid, :normal) end)

    :ok =
      SensorRuntime.event(sensor_pid, %{
        "order_id" => order_id("ORD-BOUNDARY-002"),
        "from" => "confirmed",
        "to" => "shipped",
        "at" => "2026-02-23T00:10:00Z"
      })

    {:ok, server_state} =
      await_agent_server_state(agent_server_pid, fn state ->
        state.agent.state.shipped_at == "2026-02-23T00:10:00Z"
      end)

    assert server_state.agent.state.shipped_at == "2026-02-23T00:10:00Z"

    assert_receive {:persist_transition, event, metadata, _opts}, 1_000
    assert event.to == "shipped"
    assert metadata.strategy == SignalFsm

    assert_receive {:enqueue_transition, event, opts}, 1_000
    assert event.to == "shipped"
    assert Keyword.get(opts, :queue) == :order_runtime_transition
  end

  test "illegal transitions do not emit boundary directives" do
    agent = Agent.new(id: "order-agent-boundary-illegal")

    assert {:error, %{validator: :fsm}} =
             Agent.apply_signal_sync(agent, "order.transition.delivered", %{
               "order_id" => order_id("ORD-BOUNDARY-ILLEGAL"),
               "from" => "pending",
               "to" => "delivered",
               "at" => "2026-02-23T00:20:00Z"
             })

    refute_receive {:persist_transition, _, _, _}, 200
    refute_receive {:enqueue_transition, _, _}, 200
  end

  test "request signal sets pending and executes model directive path", %{jido: jido} do
    agent_id = "order-agent-model-request-#{System.unique_integer([:positive])}"

    {:ok, agent_server_pid} =
      AgentServer.start_link(
        jido: jido,
        agent: Agent,
        id: agent_id,
        initial_state: %{
          order_id: order_id("ORD-MODEL-001"),
          customer: "Model Mika",
          items: [%{sku: "SKU-M1", qty: 1}],
          total: 9.0,
          cancelled_reason: nil,
          shipped_at: nil,
          delivered_at: nil
        }
      )

    on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

    signal =
      Jido.Signal.new!(
        "order.model.request",
        %{
          request_id: "req-model-001",
          model: "noop-model",
          prompt: "classify order risk",
          options: %{temperature: 0.1}
        },
        source: "/test/order-model"
      )

    send(agent_server_pid, {:signal, signal})

    {:ok, server_state} =
      await_agent_server_state(agent_server_pid, fn state ->
        state.agent.state.model_status == "completed" and
          state.agent.state.model_request_id == "req-model-001"
      end)

    assert server_state.agent.state.model_name == "noop-model"
    assert server_state.agent.state.model_result[:content] == "probe-ok"
    refute server_state.agent.state.model_error

    assert_receive {:infer_model, "classify order risk", infer_opts}, 1_000
    assert Map.get(infer_opts, :request_id) == "req-model-001"
    assert Map.get(infer_opts, :model) == "noop-model"
  end

  test "noop/model adapter success produces order.model.result and state update" do
    agent = Agent.new(id: "order-agent-model-sync-success")

    {:ok, pending_agent, unresolved} =
      Agent.apply_signal_sync(agent, "order.model.request", %{
        request_id: "req-model-sync-001",
        model: "noop-model",
        prompt: "summarize order",
        options: %{}
      })

    assert pending_agent.state.model_status == "pending"
    assert pending_agent.state.model_request_id == "req-model-sync-001"
    assert [%Maiden.OrderRuntime.Directives.CallModelInference{}] = unresolved
  end

  test "adapter error produces order.model.error and failed state update", %{jido: jido} do
    Application.put_env(:maiden_order_runtime, :model_adapter, ModelAdapterErrorProbe)

    agent_id = "order-agent-model-error-#{System.unique_integer([:positive])}"

    {:ok, agent_server_pid} =
      AgentServer.start_link(
        jido: jido,
        agent: Agent,
        id: agent_id,
        initial_state: %{
          order_id: order_id("ORD-MODEL-ERR-001"),
          customer: "Model Erin",
          items: [%{sku: "SKU-ME", qty: 1}],
          total: 12.0,
          cancelled_reason: nil,
          shipped_at: nil,
          delivered_at: nil
        }
      )

    on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

    signal =
      Jido.Signal.new!(
        "order.model.request",
        %{
          request_id: "req-model-err-001",
          model: "broken-model",
          prompt: "predict cancellation",
          options: %{}
        },
        source: "/test/order-model"
      )

    send(agent_server_pid, {:signal, signal})

    {:ok, server_state} =
      await_agent_server_state(agent_server_pid, fn state ->
        state.agent.state.model_status == "failed" and
          state.agent.state.model_request_id == "req-model-err-001"
      end)

    assert server_state.agent.state.model_error == :adapter_down
    assert server_state.agent.state.model_result == nil
  end

  test "strategy routes reserve high priority for orchestration signals" do
    routes = SignalFsm.signal_routes(%{agent_module: Agent, strategy_opts: []})

    assert {"order.runtime.strategy.tick", {:strategy_tick}, tick_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "order.runtime.strategy.tick" end)

    assert {"order.runtime.persist.flush", {:strategy_cmd, :flush_persistence}, flush_priority} =
             Enum.find(routes, fn {type, _, _} -> type == "order.runtime.persist.flush" end)

    assert tick_priority >= 50
    assert flush_priority >= 50
  end

  defp restore_env(key, nil), do: Application.delete_env(:maiden_order_runtime, key)

  defp restore_env(key, value) do
    Application.put_env(:maiden_order_runtime, key, value)
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

  defp start_test_jido_instance do
    Application.ensure_all_started(:jido)

    suffix = System.unique_integer([:positive])
    jido_name = String.to_atom("Elixir.Maiden.OrderRuntime.TestJido#{suffix}")

    case Jido.start(name: jido_name) do
      {:ok, _pid} -> jido_name
      {:error, {:already_started, _pid}} -> jido_name
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

  defp flush_mailbox do
    receive do
      _ -> flush_mailbox()
    after
      0 -> :ok
    end
  end
end
