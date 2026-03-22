defmodule Maiden.OrderRuntime.LiveProviderTest do
  use ExUnit.Case, async: false

  @moduletag :live_provider

  alias Jido.AgentServer
  alias Maiden.OrderRuntime.Agent
  alias Maiden.OrderRuntime.Boundaries.PiAuthModelAdapter
  alias Maiden.OrderRuntime.OrderId

  setup do
    provider = System.get_env("ORDER_LIVE_PROVIDER")
    model = System.get_env("ORDER_LIVE_MODEL")

    if is_nil(provider) or provider == "" do
      flunk("ORDER_LIVE_PROVIDER is required for live provider E2E")
    end

    if is_nil(model) or model == "" do
      flunk("ORDER_LIVE_MODEL is required for live provider E2E")
    end

    old_model_adapter = Application.get_env(:maiden_order_runtime, :model_adapter)
    Application.put_env(:maiden_order_runtime, :model_adapter, PiAuthModelAdapter)

    on_exit(fn ->
      if old_model_adapter do
        Application.put_env(:maiden_order_runtime, :model_adapter, old_model_adapter)
      else
        Application.delete_env(:maiden_order_runtime, :model_adapter)
      end
    end)

    {:ok, jido: start_test_jido_instance(), provider: provider, model: model}
  end

  test "live provider call round-trips through model boundary", %{jido: jido, provider: provider, model: model} do
    agent_id = "order-agent-live-provider-#{System.unique_integer([:positive])}"

    {:ok, agent_server_pid} =
      AgentServer.start_link(
        jido: jido,
        agent: Agent,
        id: agent_id,
        initial_state: %{
          order_id: order_id("ORD-LIVE-001"),
          customer: "Live Lane",
          items: [%{sku: "SKU-LIVE", qty: 1}],
          total: 42.0,
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
          request_id: "req-live-#{System.unique_integer([:positive])}",
          model: model,
          prompt: System.get_env("ORDER_LIVE_PROMPT") || "Return one short line: ORDER-LIVE-OK",
          options: %{
            provider: provider,
            temperature: 0.0,
            max_tokens: 96
          }
        },
        source: "/test/order-live-provider"
      )

    send(agent_server_pid, {:signal, signal})

    {:ok, server_state} =
      await_agent_server_state(agent_server_pid, fn state ->
        state.agent.state.model_status in ["completed", "failed"]
      end)

    assert server_state.agent.state.model_status == "completed"

    result = server_state.agent.state.model_result
    assert is_map(result)
    assert result[:provider] == provider
    assert result[:model] == model ||
             String.ends_with?(model, "/#{result[:model]}") ||
             String.ends_with?(model, ":#{result[:model]}")
    assert is_binary(result[:content])
    assert String.trim(result[:content]) != ""
  end

  defp await_agent_server_state(agent_server_pid, predicate, attempts \\ 120)

  defp await_agent_server_state(_agent_server_pid, _predicate, 0), do: {:error, :timeout}

  defp await_agent_server_state(agent_server_pid, predicate, attempts) do
    state_result =
      try do
        AgentServer.state(agent_server_pid)
      catch
        :exit, {:timeout, _} -> {:error, :busy}
      end

    case state_result do
      {:ok, state} ->
        if predicate.(state) do
          {:ok, state}
        else
          Process.sleep(250)
          await_agent_server_state(agent_server_pid, predicate, attempts - 1)
        end

      {:error, :busy} ->
        Process.sleep(250)
        await_agent_server_state(agent_server_pid, predicate, attempts - 1)

      error ->
        error
    end
  end

  defp start_test_jido_instance do
    Application.ensure_all_started(:jido)

    suffix = System.unique_integer([:positive])
    jido_name = String.to_atom("Elixir.Maiden.OrderRuntime.LiveTestJido#{suffix}")

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
