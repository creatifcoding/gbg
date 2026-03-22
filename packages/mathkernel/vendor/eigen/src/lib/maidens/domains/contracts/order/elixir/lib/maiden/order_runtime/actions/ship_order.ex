defmodule Maiden.OrderRuntime.Actions.ShipOrder do
  @moduledoc """
  Explicit transition action: confirmed -> shipped.
  """

  use Jido.Action,
    name: "ship_order",
    description: "Ship a confirmed order",
    schema: [
      order_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      at: [type: :string, required: true]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    order_id = fetch_param(params, :order_id)
    from = fetch_param(params, :from)
    to = fetch_param(params, :to)
    at = fetch_param(params, :at)

    cond do
      from != "confirmed" or to != "shipped" ->
        {:error, "ShipOrder requires from=confirmed and to=shipped"}

      context.state[:order_id] != order_id ->
        {:error, "order_id mismatch between transition payload and agent state"}

      true ->
        {:ok, %{shipped_at: at}}
    end
  end

  def run(_params, _context) do
    {:error, "ShipOrder requires from=confirmed and to=shipped"}
  end

  defp fetch_param(params, key) do
    Map.get(params, key) || Map.get(params, Atom.to_string(key))
  end
end
