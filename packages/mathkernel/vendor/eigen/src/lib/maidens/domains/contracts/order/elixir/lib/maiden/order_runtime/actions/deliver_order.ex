defmodule Maiden.OrderRuntime.Actions.DeliverOrder do
  @moduledoc """
  Explicit transition action: shipped -> delivered.
  """

  use Jido.Action,
    name: "deliver_order",
    description: "Mark a shipped order as delivered",
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
      from != "shipped" or to != "delivered" ->
        {:error, "DeliverOrder requires from=shipped and to=delivered"}

      context.state[:order_id] != order_id ->
        {:error, "order_id mismatch between transition payload and agent state"}

      true ->
        {:ok, %{delivered_at: at}}
    end
  end

  def run(_params, _context) do
    {:error, "DeliverOrder requires from=shipped and to=delivered"}
  end

  defp fetch_param(params, key) do
    Map.get(params, key) || Map.get(params, Atom.to_string(key))
  end
end
