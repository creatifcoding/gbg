defmodule Maiden.PlantRuntime.Boundaries.NoopPlantStore do
  @moduledoc """
  Default no-op PlantStore adapter.
  """

  @behaviour Maiden.PlantRuntime.Boundaries.PlantStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
