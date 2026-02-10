defmodule AvaElixir.Native do
  @moduledoc """
  Rustler boundary for AVA control-plane integration.

  Phase 1 surface is intentionally narrow:
  - `nif_version/0`
  - `runtime_ping/1`
  - `register_spec_json/1`
  - `invalidate_view/1`
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
  @spec invalidate_view(String.t()) :: {:ok, String.t()} | {:error, term()}
  def invalidate_view(_view_id), do: :erlang.nif_error(:nif_not_loaded)
end
