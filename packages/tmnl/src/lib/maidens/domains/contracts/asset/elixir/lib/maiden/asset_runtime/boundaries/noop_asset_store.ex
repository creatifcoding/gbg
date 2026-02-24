defmodule Maiden.AssetRuntime.Boundaries.NoopAssetStore do
  @moduledoc """
  Default no-op AssetStore adapter.
  """

  @behaviour Maiden.AssetRuntime.Boundaries.AssetStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
