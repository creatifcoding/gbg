defmodule Maiden.WorkcellRuntime.Boundaries.NoopWorkcellStore do
  @moduledoc """
  Default no-op WorkcellStore adapter.
  """

  @behaviour Maiden.WorkcellRuntime.Boundaries.WorkcellStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
