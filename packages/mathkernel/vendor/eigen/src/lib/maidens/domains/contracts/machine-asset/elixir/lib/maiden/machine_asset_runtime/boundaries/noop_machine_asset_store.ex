defmodule Maiden.MachineAssetRuntime.Boundaries.NoopMachineAssetStore do
  @moduledoc """
  Default no-op MachineAssetStore adapter.
  """

  @behaviour Maiden.MachineAssetRuntime.Boundaries.MachineAssetStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
