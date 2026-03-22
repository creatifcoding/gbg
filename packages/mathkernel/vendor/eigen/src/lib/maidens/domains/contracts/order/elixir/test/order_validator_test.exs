defmodule Maiden.OrderRuntime.ValidatorTest do
  use ExUnit.Case, async: false

  alias Jido.AgentServer
  alias Jido.Sensor.Runtime, as: SensorRuntime
  alias Maiden.OrderRuntime.Agent
  alias Maiden.OrderRuntime.FSM
  alias Maiden.OrderRuntime.OrderId
  alias Maiden.OrderRuntime.Sensors.TransitionSensor
  alias Maiden.OrderRuntime.Validators.OrderValidator

  setup do
    {:ok, jido: start_test_jido_instance()}
  end

  describe "order_validate/2" do
    test "accepts valid order payload" do
      payload = %{
        "order_id" => order_id("ORD-001"),
        "customer" => "Alice",
        "items" => [%{"sku" => "SKU-1", "qty" => 2}],
        "total" => 42.5,
        "cancelled_reason" => nil,
        "shipped_at" => nil,
        "delivered_at" => nil
      }

      assert :ok = OrderValidator.order_validate(payload)
    end

    test "rejects invalid order payload" do
      payload = %{
        "order_id" => order_id("ORD-001"),
        "customer" => "Alice",
        "items" => [],
        "total" => "42.5",
        "cancelled_reason" => nil,
        "shipped_at" => nil,
        "delivered_at" => nil
      }

      assert {:error, %{errors: _errors}} = OrderValidator.order_validate(payload)
    end
  end

  describe "agent_state_validate/2" do
    test "accepts valid Jido agent state payload with model runtime fields" do
      payload = %{
        "order_id" => order_id("ORD-STATE-001"),
        "customer" => "Stateful Alice",
        "items" => [%{"sku" => "SKU-STATE", "qty" => 1}],
        "total" => 11.0,
        "cancelled_reason" => nil,
        "shipped_at" => nil,
        "delivered_at" => nil,
        "model_request_id" => "req-state-001",
        "model_name" => "noop-model",
        "model_prompt" => "classify order risk",
        "model_options" => %{"temperature" => 0.1},
        "model_status" => "pending",
        "model_result" => nil,
        "model_error" => nil
      }

      assert :ok = OrderValidator.agent_state_validate(payload)
      assert :ok = Agent.preflight_agent_state(payload)
    end

    test "rejects invalid model_status for agent state payload" do
      payload = %{
        "order_id" => order_id("ORD-STATE-002"),
        "customer" => "Stateful Bob",
        "items" => [%{"sku" => "SKU-STATE", "qty" => 1}],
        "total" => 7.0,
        "cancelled_reason" => nil,
        "shipped_at" => nil,
        "delivered_at" => nil,
        "model_request_id" => nil,
        "model_name" => nil,
        "model_prompt" => nil,
        "model_options" => %{},
        "model_status" => "stale",
        "model_result" => nil,
        "model_error" => nil
      }

      assert {:error, %{errors: _errors}} = OrderValidator.agent_state_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload = %{
        "order_id" => order_id("ORD-001"),
        "from" => "pending",
        "to" => "confirmed",
        "at" => "2026-02-22T06:00:00Z",
        "reason" => nil
      }

      assert :ok = OrderValidator.transition_event_validate(payload)
      assert :ok = FSM.validate_transition_for_jido(payload)
    end

    @tag :negative_gate
    test "rejects transition that is schema-valid but FSM-invalid" do
      payload = %{
        "order_id" => order_id("ORD-001"),
        "from" => "pending",
        "to" => "delivered",
        "at" => "2026-02-22T06:00:00Z"
      }

      assert :ok = OrderValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "pending",
                to: "delivered",
                allowed_next: ["confirmed", "cancelled"]
              }} = FSM.validate_transition_for_jido(payload)
    end
  end

  describe "Jido agent preflight" do
    test "delegates transition preflight to FSM validator" do
      payload = %{
        "order_id" => order_id("ORD-001"),
        "from" => "confirmed",
        "to" => "shipped",
        "at" => "2026-02-22T06:00:00Z"
      }

      assert :ok = Agent.preflight_transition(payload)
    end
  end

  describe "Jido action and signal wiring" do
    test "maps signal to explicit action and emits RunInstruction via FSM strategy" do
      alias Jido.Agent.Directive.RunInstruction

      agent =
        Agent.new(
          id: "order-agent-001",
          state: %{
            order_id: order_id("ORD-001"),
            customer: "Alice",
            items: [%{sku: "SKU-1", qty: 1}],
            total: 42.5,
            cancelled_reason: nil,
            shipped_at: nil,
            delivered_at: nil
          }
        )

      confirm_payload = %{
        "order_id" => order_id("ORD-001"),
        "from" => "pending",
        "to" => "confirmed",
        "at" => "2026-02-22T06:00:00Z"
      }

      {:ok, {next_agent, directives}} =
        Agent.apply_signal(agent, "order.transition.confirmed", confirm_payload)

      assert next_agent.state.__strategy__.machine.status == "processing"
      assert Enum.any?(directives, &match?(%RunInstruction{}, &1))
    end

    test "resolves RunInstruction and mutates agent state through fsm_instruction_result" do
      agent =
        Agent.new(
          id: "order-agent-002",
          state: %{
            order_id: order_id("ORD-002"),
            customer: "Bob",
            items: [%{sku: "SKU-2", qty: 1}],
            total: 12.0,
            cancelled_reason: nil,
            shipped_at: nil,
            delivered_at: nil
          }
        )

      ship_payload = %{
        "order_id" => order_id("ORD-002"),
        "from" => "confirmed",
        "to" => "shipped",
        "at" => "2026-02-22T06:05:00Z"
      }

      {:ok, updated_agent, unresolved_directives} =
        Agent.apply_signal_sync(agent, "order.transition.shipped", ship_payload)

      assert updated_agent.state.shipped_at == "2026-02-22T06:05:00Z"
      assert updated_agent.state.__strategy__.machine.status == "idle"
      assert unresolved_directives == []
    end

    test "rejects unsupported signal types" do
      agent = Agent.new(id: "order-agent-unknown")

      assert {:error, :unknown_signal_type} =
               Agent.apply_signal(agent, "order.transition.unknown", %{})
    end

    @tag :negative_gate
    test "rejects schema-valid but FSM-illegal transition before cmd" do
      agent = Agent.new(id: "order-agent-illegal")

      payload = %{
        "order_id" => order_id("ORD-001"),
        "from" => "pending",
        "to" => "delivered",
        "at" => "2026-02-22T06:00:00Z"
      }

      assert {:error, %{validator: :fsm}} =
               Agent.apply_signal(agent, "order.transition.delivered", payload)
    end
  end

  describe "sensor ingress" do
    test "sensor emits transition signal only after preflight succeeds" do
      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/test-transition", emit_rejections: true},
          context: %{agent_ref: self()},
          id: "sensor-self-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "order_id" => order_id("ORD-SENSOR-001"),
          "from" => "pending",
          "to" => "confirmed",
          "at" => "2026-02-22T06:10:00Z"
        })

      assert_receive {:signal, signal}, 1_000
      assert signal.type == "order.transition.confirmed"

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "order_id" => order_id("ORD-SENSOR-001"),
          "from" => "pending",
          "to" => "delivered",
          "at" => "2026-02-22T06:11:00Z"
        })

      assert_receive {:signal, rejection_signal}, 1_000
      assert rejection_signal.type == "order.transition.rejected"
      assert rejection_signal.data.to == "delivered"
      assert rejection_signal.data.attempted_signal == "order.transition.delivered"
      assert rejection_signal.data.validator == :fsm
      assert is_binary(rejection_signal.data.trace_id)
    end

    test "sensor -> agent server -> action -> FSM loop mutates state", %{jido: jido} do
      agent_id = "order-agent-sensor-#{System.unique_integer([:positive])}"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: jido,
          agent: Agent,
          id: agent_id,
          initial_state: %{
            order_id: order_id("ORD-SENSOR-RT-001"),
            customer: "Sensor Bob",
            items: [%{sku: "SKU-SENSOR", qty: 1}],
            total: 9.5,
            cancelled_reason: nil,
            shipped_at: nil,
            delivered_at: nil
          }
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/order-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "sensor-agent-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "order_id" => order_id("ORD-SENSOR-RT-001"),
          "from" => "confirmed",
          "to" => "shipped",
          "at" => "2026-02-22T06:12:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.shipped_at == "2026-02-22T06:12:00Z" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.shipped_at == "2026-02-22T06:12:00Z"
      assert server_state.agent.state.__strategy__.machine.status == "idle"
    end

    test "sensor loop supports shipped -> delivered path", %{jido: jido} do
      agent_id = "order-agent-sensor-deliver-#{System.unique_integer([:positive])}"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: jido,
          agent: Agent,
          id: agent_id,
          initial_state: %{
            order_id: order_id("ORD-SENSOR-DELIVER-001"),
            customer: "Deliver Dana",
            items: [%{sku: "SKU-DELIVER", qty: 1}],
            total: 5.0,
            cancelled_reason: nil,
            shipped_at: "2026-02-22T06:00:00Z",
            delivered_at: nil
          }
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/order-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "sensor-agent-deliver-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "order_id" => order_id("ORD-SENSOR-DELIVER-001"),
          "from" => "shipped",
          "to" => "delivered",
          "at" => "2026-02-22T06:13:00Z"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.delivered_at == "2026-02-22T06:13:00Z" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.delivered_at == "2026-02-22T06:13:00Z"
    end

    test "sensor loop supports confirmed -> cancelled path with reason", %{jido: jido} do
      agent_id = "order-agent-sensor-cancel-#{System.unique_integer([:positive])}"

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: jido,
          agent: Agent,
          id: agent_id,
          initial_state: %{
            order_id: order_id("ORD-SENSOR-CANCEL-001"),
            customer: "Cancel Chris",
            items: [%{sku: "SKU-CANCEL", qty: 1}],
            total: 13.0,
            cancelled_reason: nil,
            shipped_at: nil,
            delivered_at: nil
          }
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/order-transition"},
          context: %{agent_ref: agent_server_pid},
          id: "sensor-agent-cancel-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "order_id" => order_id("ORD-SENSOR-CANCEL-001"),
          "from" => "confirmed",
          "to" => "cancelled",
          "at" => "2026-02-22T06:14:00Z",
          "reason" => "customer_request"
        })

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.cancelled_reason == "customer_request" and
            state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.cancelled_reason == "customer_request"
    end

    @tag :negative_gate
    test "rejection envelope routes to observer action and preserves telemetry correlation", %{jido: jido} do
      agent_id = "order-agent-sensor-reject-#{System.unique_integer([:positive])}"
      trace_id = "trace-reject-#{System.unique_integer([:positive])}"
      telemetry_handler = "order-rejection-telemetry-#{System.unique_integer([:positive])}"
      parent = self()

      :ok =
        :telemetry.attach_many(
          telemetry_handler,
          [
            [:jido, :agent_server, :signal, :start],
            [:jido, :agent_server, :directive, :start]
          ],
          &__MODULE__.forward_telemetry_event/4,
          %{parent: parent, agent_id: agent_id}
        )

      on_exit(fn -> :telemetry.detach(telemetry_handler) end)

      {:ok, agent_server_pid} =
        AgentServer.start_link(
          jido: jido,
          agent: Agent,
          id: agent_id,
          initial_state: %{
            order_id: order_id("ORD-SENSOR-REJECT-001"),
            customer: "Reject Riley",
            items: [%{sku: "SKU-REJECT", qty: 1}],
            total: 17.0,
            cancelled_reason: nil,
            shipped_at: nil,
            delivered_at: nil
          }
        )

      on_exit(fn -> Process.exit(agent_server_pid, :normal) end)

      {:ok, sensor_pid} =
        SensorRuntime.start_link(
          sensor: TransitionSensor,
          config: %{source: "/sensor/order-transition", emit_rejections: true},
          context: %{agent_ref: agent_server_pid},
          id: "sensor-agent-reject-#{System.unique_integer([:positive])}"
        )

      on_exit(fn -> Process.exit(sensor_pid, :normal) end)

      :ok =
        SensorRuntime.event(sensor_pid, %{
          "order_id" => order_id("ORD-SENSOR-REJECT-001"),
          "from" => "pending",
          "to" => "delivered",
          "at" => "2026-02-22T06:15:00Z",
          "trace_id" => trace_id
        })

      assert {:ok, {:telemetry_event, [:jido, :agent_server, :signal, :start], signal_meta}} =
               await_telemetry(fn event, metadata ->
                 event == [:jido, :agent_server, :signal, :start] and
                   metadata[:agent_id] == agent_id and
                   metadata[:signal_type] == "order.transition.rejected"
               end)

      assert {:ok,
              {:telemetry_event, [:jido, :agent_server, :directive, :start], directive_meta}} =
               await_telemetry(fn event, metadata ->
                 event == [:jido, :agent_server, :directive, :start] and
                   metadata[:agent_id] == agent_id and
                   metadata[:signal_type] == "order.transition.rejected"
               end)

      assert directive_meta[:signal_type] == signal_meta[:signal_type]

      if signal_meta[:jido_trace_id] && directive_meta[:jido_trace_id] do
        assert directive_meta[:jido_trace_id] == signal_meta[:jido_trace_id]
      end

      {:ok, server_state} =
        await_agent_server_state(agent_server_pid, fn state ->
          state.agent.state.__strategy__.machine.status == "idle"
        end)

      assert server_state.agent.state.order_id == order_id("ORD-SENSOR-REJECT-001")
      assert server_state.agent.state.delivered_at == nil
    end
  end

  def forward_telemetry_event(event, _measurements, metadata, %{parent: parent, agent_id: agent_id}) do
    if metadata[:agent_id] == agent_id do
      send(parent, {:telemetry_event, event, metadata})
    end
  end

  defp await_telemetry(predicate, attempts \\ 20)

  defp await_telemetry(_predicate, 0), do: {:error, :telemetry_timeout}

  defp await_telemetry(predicate, attempts) when is_function(predicate, 2) do
    receive do
      {:telemetry_event, event, metadata} = envelope ->
        if predicate.(event, metadata) do
          {:ok, envelope}
        else
          await_telemetry(predicate, attempts - 1)
        end
    after
      200 ->
        await_telemetry(predicate, attempts - 1)
    end
  end

  defp await_agent_server_state(agent_server_pid, predicate, attempts \\ 20)

  defp await_agent_server_state(_agent_server_pid, _predicate, 0) do
    {:error, :timeout}
  end

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

  defp start_test_jido_instance do
    Application.ensure_all_started(:jido)

    suffix = System.unique_integer([:positive])
    jido_name = String.to_atom("Elixir.Maiden.OrderRuntime.ValidatorTestJido#{suffix}")

    case Jido.start(name: jido_name) do
      {:ok, _pid} -> jido_name
      {:error, {:already_started, _pid}} -> jido_name
    end
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
