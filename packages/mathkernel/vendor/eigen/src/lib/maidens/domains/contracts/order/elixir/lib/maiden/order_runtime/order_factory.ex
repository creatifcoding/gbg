defmodule Maiden.OrderRuntime.OrderFactory do
  @moduledoc """
  Shared order payload constructor for Elixir runtime tests and adapters.

  Canonical shape mirrors Effect Schema Order contract.
  """

  alias Maiden.OrderRuntime.OrderId

  @spec new_order(map() | keyword()) :: map()
  def new_order(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug) || "ORD"

    order_id =
      Map.get(attrs, :order_id) ||
        OrderId.make(slug, Map.get(attrs, :uuid))

    %{
      order_id: order_id,
      customer: Map.get(attrs, :customer, "Unknown Customer"),
      items: Map.get(attrs, :items, []),
      total: Map.get(attrs, :total, 0.0),
      cancelled_reason: Map.get(attrs, :cancelled_reason, nil),
      shipped_at: Map.get(attrs, :shipped_at, nil),
      delivered_at: Map.get(attrs, :delivered_at, nil)
    }
  end

  @spec new_transition_event(map() | keyword()) :: map()
  def new_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug) || "ORD"

    %{
      order_id: Map.get(attrs, :order_id) || OrderId.make(slug, Map.get(attrs, :uuid)),
      from: Map.fetch!(attrs, :from),
      to: Map.fetch!(attrs, :to),
      at: Map.fetch!(attrs, :at),
      reason: Map.get(attrs, :reason, nil)
    }
  end

  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)
  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
end
