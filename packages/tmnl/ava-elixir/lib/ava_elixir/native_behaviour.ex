defmodule AvaElixir.NativeBehaviour do
  @moduledoc """
  Behaviour contract for AVA native boundary adapters.

  Default implementation is `AvaElixir.Native` (Rustler NIF), but tests and
  fallback adapters can provide alternate modules.
  """

  @callback nif_version() :: String.t()
  @callback runtime_ping(String.t()) :: String.t()
  @callback register_spec_json(String.t()) :: {:ok, String.t()} | {:error, term()}
  @callback invalidate_view(String.t()) :: {:ok, String.t()} | {:error, term()}
end
