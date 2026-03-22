defmodule Maiden.SensorRuntime.Boundaries.NoopSensorStore do
  @moduledoc """
  Default no-op SensorStore adapter.
  """

  @behaviour Maiden.SensorRuntime.Boundaries.SensorStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
