defmodule Maiden.AreaRuntime.Boundaries.NoopAreaStore do
  @moduledoc """
  Default no-op AreaStore adapter.
  """

  @behaviour Maiden.AreaRuntime.Boundaries.AreaStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
