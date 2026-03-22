defmodule Maiden.SensorAssetRuntime.Boundaries.NoopSensorAssetStore do
  @moduledoc """
  Default no-op SensorAssetStore adapter.
  """

  @behaviour Maiden.SensorAssetRuntime.Boundaries.SensorAssetStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
