defmodule Maiden.OrderRuntime.Boundaries.NoopOrderStore do
  @moduledoc """
  Default no-op OrderStore adapter.

  Replace via `config :maiden_order_runtime, :order_store_adapter, YourAdapter`.
  """

  @behaviour Maiden.OrderRuntime.Boundaries.OrderStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
