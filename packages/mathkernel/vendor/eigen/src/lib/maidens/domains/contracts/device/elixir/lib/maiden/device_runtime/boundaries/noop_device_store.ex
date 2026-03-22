defmodule Maiden.DeviceRuntime.Boundaries.NoopDeviceStore do
  @moduledoc """
  Default no-op DeviceStore adapter.
  """

  @behaviour Maiden.DeviceRuntime.Boundaries.DeviceStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
