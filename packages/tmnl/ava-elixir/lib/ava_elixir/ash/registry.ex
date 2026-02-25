defmodule AvaElixir.Ash.Registry do
  @moduledoc """
  Compatibility shim for resource registry references.

  Ash v3 domain wiring in this project uses `AvaElixir.Ash.Domain` as the
  canonical resource surface, so this module intentionally exposes a static list
  without depending on `Ash.Registry` macros.
  """

  @resources [
    AvaElixir.Resources.AvaCommand,
    AvaElixir.Resources.AvaEvent,
    AvaElixir.Resources.AvaOutbox,
    AvaElixir.Resources.AvaCheckpoint
  ]

  @spec resources() :: [module()]
  def resources, do: @resources
end
