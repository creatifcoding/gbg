defmodule Maiden.LineRuntime.Boundaries.NoopLineStore do
  @moduledoc """
  Default no-op LineStore adapter.

  Replace via `config :maiden_line_runtime, :line_store_adapter, YourAdapter`.
  """

  @behaviour Maiden.LineRuntime.Boundaries.LineStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
