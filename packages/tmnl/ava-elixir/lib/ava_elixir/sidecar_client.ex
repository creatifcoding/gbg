defmodule AvaElixir.SidecarClient do
  @moduledoc """
  In-BEAM sidecar runtime fallback for AVA control-plane operations.

  This module mirrors `AvaElixir.NativeBehaviour` semantics so `AvaElixir`
  can route between `:nif` and `:sidecar` without branching call sites.
  """

  use GenServer

  @behaviour AvaElixir.NativeBehaviour

  @tick_floor_ms 10

  @type subscription_state :: %{
          view_id: String.t(),
          pid: pid(),
          interval_ms: pos_integer(),
          sequence: non_neg_integer(),
          timer_ref: reference()
        }

  @type state :: %{
          registry: %{optional(String.t()) => map()},
          subscriptions: %{optional(String.t()) => subscription_state()},
          next_subscription_id: pos_integer()
        }

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, :ok, Keyword.put_new(opts, :name, __MODULE__))
  end

  @impl true
  @spec nif_version() :: String.t()
  def nif_version, do: "sidecar-0.1.0"

  @impl true
  @spec runtime_ping(String.t()) :: String.t()
  def runtime_ping(payload), do: "ava-runtime:#{payload}"

  @impl true
  @spec register_spec_json(String.t()) :: {:ok, String.t()} | {:error, term()}
  def register_spec_json(spec_json) when is_binary(spec_json) do
    with {:ok, payload} <- Jason.decode(spec_json),
         {:ok, view_id} <- extract_view_id(payload) do
      GenServer.call(__MODULE__, {:register_spec, view_id, payload})
    else
      {:error, %Jason.DecodeError{} = error} ->
        {:error, "invalid_json:#{Exception.message(error)}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  @spec get_spec_json(String.t()) :: {:ok, String.t()} | {:error, term()}
  def get_spec_json(view_id) when is_binary(view_id) do
    GenServer.call(__MODULE__, {:get_spec_json, view_id})
  end

  @impl true
  @spec list_specs() :: {:ok, [String.t()]} | {:error, term()}
  def list_specs do
    GenServer.call(__MODULE__, :list_specs)
  end

  @impl true
  @spec invalidate_view(String.t()) :: {:ok, String.t()} | {:error, term()}
  def invalidate_view(view_id) when is_binary(view_id) do
    GenServer.call(__MODULE__, {:invalidate_view, view_id})
  end

  @impl true
  @spec subscribe_view(String.t(), non_neg_integer(), pid()) ::
          {:ok, String.t()} | {:error, term()}
  def subscribe_view(view_id, interval_ms, pid)
      when is_binary(view_id) and is_integer(interval_ms) and interval_ms >= 0 and is_pid(pid) do
    GenServer.call(__MODULE__, {:subscribe_view, view_id, interval_ms, pid})
  end

  @impl true
  @spec unsubscribe(String.t()) :: {:ok, String.t()} | {:error, term()}
  def unsubscribe(subscription_id) when is_binary(subscription_id) do
    GenServer.call(__MODULE__, {:unsubscribe, subscription_id})
  end

  @impl true
  @spec list_subscriptions() :: {:ok, [String.t()]} | {:error, term()}
  def list_subscriptions do
    GenServer.call(__MODULE__, :list_subscriptions)
  end

  @doc """
  Test/dev helper to clear in-memory sidecar state.
  """
  @spec reset() :: :ok
  def reset do
    GenServer.call(__MODULE__, :reset)
  end

  @impl true
  def init(:ok) do
    {:ok,
     %{
       registry: %{},
       subscriptions: %{},
       next_subscription_id: 1
     }}
  end

  @impl true
  def handle_call({:register_spec, view_id, payload}, _from, state) do
    next_registry = Map.put(state.registry, view_id, payload)
    {:reply, {:ok, "registered:#{view_id}"}, %{state | registry: next_registry}}
  end

  def handle_call({:get_spec_json, view_id}, _from, state) do
    case Map.fetch(state.registry, view_id) do
      {:ok, payload} ->
        case Jason.encode(payload) do
          {:ok, json} ->
            {:reply, {:ok, json}, state}

          {:error, reason} ->
            {:reply, {:error, "serialize_failed:#{Exception.message(reason)}"}, state}
        end

      :error ->
        {:reply, {:error, "view_not_found:#{view_id}"}, state}
    end
  end

  def handle_call(:list_specs, _from, state) do
    ids = state.registry |> Map.keys() |> Enum.sort()
    {:reply, {:ok, ids}, state}
  end

  def handle_call({:invalidate_view, view_id}, _from, state) do
    case Map.has_key?(state.registry, view_id) do
      false ->
        {:reply, {:error, "view_not_found:#{view_id}"}, state}

      true ->
        next_registry = Map.delete(state.registry, view_id)

        {next_subscriptions, _cancelled_count} =
          Enum.reduce(state.subscriptions, {%{}, 0}, fn {sub_id, sub}, {acc, count} ->
            if sub.view_id == view_id do
              Process.cancel_timer(sub.timer_ref, async: true, info: false)
              {acc, count + 1}
            else
              {Map.put(acc, sub_id, sub), count}
            end
          end)

        {:reply, {:ok, "invalidated:#{view_id}"},
         %{state | registry: next_registry, subscriptions: next_subscriptions}}
    end
  end

  def handle_call({:subscribe_view, view_id, interval_ms, pid}, _from, state) do
    case Map.has_key?(state.registry, view_id) do
      false ->
        {:reply, {:error, "view_not_found:#{view_id}"}, state}

      true ->
        subscription_id = "sub-#{state.next_subscription_id}"
        effective_interval_ms = max(interval_ms, @tick_floor_ms)

        timer_ref = Process.send_after(self(), {:tick, subscription_id}, effective_interval_ms)

        next_subscription = %{
          view_id: view_id,
          pid: pid,
          interval_ms: effective_interval_ms,
          sequence: 0,
          timer_ref: timer_ref
        }

        next_subscriptions = Map.put(state.subscriptions, subscription_id, next_subscription)

        {:reply, {:ok, subscription_id},
         %{
           state
           | subscriptions: next_subscriptions,
             next_subscription_id: state.next_subscription_id + 1
         }}
    end
  end

  def handle_call({:unsubscribe, subscription_id}, _from, state) do
    case Map.pop(state.subscriptions, subscription_id) do
      {nil, _} ->
        {:reply, {:error, "subscription_not_found:#{subscription_id}"}, state}

      {subscription, next_subscriptions} ->
        Process.cancel_timer(subscription.timer_ref, async: true, info: false)

        {:reply, {:ok, "unsubscribed:#{subscription_id}"},
         %{state | subscriptions: next_subscriptions}}
    end
  end

  def handle_call(:list_subscriptions, _from, state) do
    ids = state.subscriptions |> Map.keys() |> Enum.sort()
    {:reply, {:ok, ids}, state}
  end

  def handle_call(:reset, _from, state) do
    Enum.each(state.subscriptions, fn {_sub_id, subscription} ->
      Process.cancel_timer(subscription.timer_ref, async: true, info: false)
    end)

    {:reply, :ok,
     %{
       registry: %{},
       subscriptions: %{},
       next_subscription_id: 1
     }}
  end

  @impl true
  def handle_info({:tick, subscription_id}, state) do
    case Map.fetch(state.subscriptions, subscription_id) do
      :error ->
        {:noreply, state}

      {:ok, subscription} ->
        send(subscription.pid, {
          :ava_artifact,
          subscription_id,
          %{view_id: subscription.view_id, sequence: subscription.sequence}
        })

        next_timer_ref =
          Process.send_after(self(), {:tick, subscription_id}, subscription.interval_ms)

        next_subscription = %{
          subscription
          | sequence: subscription.sequence + 1,
            timer_ref: next_timer_ref
        }

        {:noreply,
         %{
           state
           | subscriptions: Map.put(state.subscriptions, subscription_id, next_subscription)
         }}
    end
  end

  def handle_info(_message, state), do: {:noreply, state}

  @spec extract_view_id(map()) :: {:ok, String.t()} | {:error, String.t()}
  defp extract_view_id(payload) do
    case payload["id"] || payload[:id] do
      id when is_binary(id) and id != "" -> {:ok, id}
      _ -> {:error, "missing_id"}
    end
  end
end
