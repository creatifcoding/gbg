defmodule AvaElixir.Ash.Domain do
  @moduledoc """
  Ash domain for Ava durable command/event/outbox/checkpoint resources.
  """

  use Ash.Domain

  resources do
    resource AvaElixir.Resources.AvaCommand
    resource AvaElixir.Resources.AvaEvent
    resource AvaElixir.Resources.AvaOutbox
    resource AvaElixir.Resources.AvaCheckpoint
    resource AvaElixir.Resources.AvaProjection
  end
end
