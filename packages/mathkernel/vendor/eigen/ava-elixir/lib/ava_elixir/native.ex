defmodule AvaElixir.Native do
  @moduledoc """
  Rustler boundary for AVA control-plane integration.
  """

  @behaviour AvaElixir.NativeBehaviour

  use Rustler, otp_app: :ava_elixir, crate: "ava_bridge"

  @impl true
  @spec nif_version() :: String.t()
  def nif_version, do: :erlang.nif_error(:nif_not_loaded)

  @impl true
  @spec runtime_ping(String.t()) :: String.t()
  def runtime_ping(_payload), do: :erlang.nif_error(:nif_not_loaded)

  @impl true
  @spec register_spec_json(String.t()) :: {:ok, String.t()} | {:error, term()}
  def register_spec_json(_json), do: :erlang.nif_error(:nif_not_loaded)

  @impl true
  @spec get_spec_json(String.t()) :: {:ok, String.t()} | {:error, term()}
  def get_spec_json(_view_id), do: :erlang.nif_error(:nif_not_loaded)

  @impl true
  @spec list_specs() :: {:ok, [String.t()]} | {:error, term()}
  def list_specs, do: :erlang.nif_error(:nif_not_loaded)

  @impl true
  @spec invalidate_view(String.t()) :: {:ok, String.t()} | {:error, term()}
  def invalidate_view(_view_id), do: :erlang.nif_error(:nif_not_loaded)

  @impl true
  @spec subscribe_view(String.t(), non_neg_integer(), pid()) ::
          {:ok, String.t()} | {:error, term()}
  def subscribe_view(_view_id, _interval_ms, _pid), do: :erlang.nif_error(:nif_not_loaded)

  @impl true
  @spec unsubscribe(String.t()) :: {:ok, String.t()} | {:error, term()}
  def unsubscribe(_subscription_id), do: :erlang.nif_error(:nif_not_loaded)

  @impl true
  @spec list_subscriptions() :: {:ok, [String.t()]} | {:error, term()}
  def list_subscriptions, do: :erlang.nif_error(:nif_not_loaded)
end
