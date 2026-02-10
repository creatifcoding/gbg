defmodule AvaElixir do
  @moduledoc """
  AVA Elixir control-plane entrypoint.

  This module exposes a stable, typed API over the Rustler boundary and
  normalizes native errors into pattern-matchable Elixir terms.
  """

  @typedoc "Runtime mode for control-plane routing"
  @type runtime_mode :: :nif | :sidecar

  @typedoc "Native-boundary error reasons"
  @type native_error_reason ::
          :missing_id
          | :native_registry_unavailable
          | :native_subscriptions_unavailable
          | {:invalid_json, String.t()}
          | {:view_not_found, String.t()}
          | {:subscription_not_found, String.t()}
          | {:native_error, String.t()}

  @typedoc "Public API error reasons"
  @type error_reason :: :sidecar_not_implemented | native_error_reason

  @typedoc "Result helper"
  @type result(t) :: {:ok, t} | {:error, error_reason}

  @doc """
  Verifies Rustler boundary wiring.
  """
  @spec ping(String.t()) :: String.t()
  def ping(payload \\ "ok") do
    native_client().runtime_ping(payload)
  end

  @doc """
  Returns NIF version for smoke checks.
  """
  @spec nif_version() :: String.t()
  def nif_version do
    native_client().nif_version()
  end

  @doc """
  Effective runtime mode for control-plane routing.

  Supported values: `:nif` (default), `:sidecar`.
  """
  @spec runtime_mode() :: runtime_mode()
  def runtime_mode do
    Application.get_env(:ava_elixir, :runtime_mode, :nif)
  end

  @doc """
  Registers a view spec JSON payload through the active runtime mode.
  """
  @spec register_spec_json(String.t()) :: result(String.t())
  def register_spec_json(spec_json) when is_binary(spec_json) do
    call_native(:register_spec_json, fn native -> native.register_spec_json(spec_json) end)
  end

  @doc """
  Retrieves a registered view spec as JSON.
  """
  @spec get_spec_json(String.t()) :: result(String.t())
  def get_spec_json(view_id) when is_binary(view_id) do
    call_native(:get_spec_json, fn native -> native.get_spec_json(view_id) end)
  end

  @doc """
  Lists all registered view IDs.
  """
  @spec list_specs() :: result([String.t()])
  def list_specs do
    call_native(:list_specs, fn native -> native.list_specs() end)
  end

  @doc """
  Invalidates a view by id through the active runtime mode.
  """
  @spec invalidate_view(String.t()) :: result(String.t())
  def invalidate_view(view_id) when is_binary(view_id) do
    call_native(:invalidate_view, fn native -> native.invalidate_view(view_id) end)
  end

  @doc """
  Subscribes an Elixir process mailbox to periodic artifact events for a view.

  Options:
  - `:interval_ms` (default 100)
  - `:pid` (default `self()`)
  """
  @spec subscribe(String.t(), keyword()) :: result(String.t())
  def subscribe(view_id, opts \\ []) when is_binary(view_id) and is_list(opts) do
    interval_ms = Keyword.get(opts, :interval_ms, 100)
    pid = Keyword.get(opts, :pid, self())

    call_native(:subscribe, fn native -> native.subscribe_view(view_id, interval_ms, pid) end)
  end

  @doc """
  Unsubscribes a subscription handle.
  """
  @spec unsubscribe(String.t()) :: result(String.t())
  def unsubscribe(subscription_id) when is_binary(subscription_id) do
    call_native(:unsubscribe, fn native -> native.unsubscribe(subscription_id) end)
  end

  @doc """
  Lists active subscription IDs.
  """
  @spec list_subscriptions() :: result([String.t()])
  def list_subscriptions do
    call_native(:list_subscriptions, fn native -> native.list_subscriptions() end)
  end

  @doc """
  Bang variant for `register_spec_json/1`.
  """
  @spec register_spec_json!(String.t()) :: String.t()
  def register_spec_json!(spec_json) do
    case register_spec_json(spec_json) do
      {:ok, value} -> value
      {:error, reason} -> raise ArgumentError, "register_spec_json failed: #{inspect(reason)}"
    end
  end

  @doc """
  Bang variant for `invalidate_view/1`.
  """
  @spec invalidate_view!(String.t()) :: String.t()
  def invalidate_view!(view_id) do
    case invalidate_view(view_id) do
      {:ok, value} -> value
      {:error, reason} -> raise ArgumentError, "invalidate_view failed: #{inspect(reason)}"
    end
  end

  @spec call_native(AvaElixir.Telemetry.operation(), (module() ->
                                                        {:ok, term()} | {:error, term()})) ::
          result(term())
  defp call_native(operation, fun) do
    mode = runtime_mode()
    start = System.monotonic_time()

    result =
      case mode do
        :nif ->
          native_client()
          |> fun.()
          |> normalize_native_result()

        :sidecar ->
          {:error, :sidecar_not_implemented}
      end

    finish = System.monotonic_time()
    duration_us = System.convert_time_unit(finish - start, :native, :microsecond)

    status = if match?({:ok, _}, result), do: :ok, else: :error
    AvaElixir.Telemetry.emit_nif_call(operation, duration_us, status, mode)

    result
  end

  @spec native_client() :: module()
  defp native_client do
    Application.get_env(:ava_elixir, :native_client, AvaElixir.Native)
  end

  @spec normalize_native_result({:ok, term()} | {:error, term()}) :: result(term())
  defp normalize_native_result({:ok, value}), do: {:ok, value}
  defp normalize_native_result({:error, reason}), do: {:error, normalize_reason(reason)}

  @spec normalize_reason(term()) :: error_reason
  defp normalize_reason("missing_id"), do: :missing_id
  defp normalize_reason("registry_lock_poisoned"), do: :native_registry_unavailable
  defp normalize_reason("subscriptions_lock_poisoned"), do: :native_subscriptions_unavailable

  defp normalize_reason("invalid_json:" <> detail),
    do: {:invalid_json, detail}

  defp normalize_reason("view_not_found:" <> view_id),
    do: {:view_not_found, view_id}

  defp normalize_reason("subscription_not_found:" <> subscription_id),
    do: {:subscription_not_found, subscription_id}

  defp normalize_reason(reason) when is_binary(reason),
    do: {:native_error, reason}

  defp normalize_reason(reason), do: {:native_error, inspect(reason)}
end
