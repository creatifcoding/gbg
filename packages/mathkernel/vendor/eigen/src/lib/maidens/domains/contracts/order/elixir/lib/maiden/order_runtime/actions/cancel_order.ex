defmodule Maiden.OrderRuntime.Actions.CancelOrder do
  @moduledoc """
  Explicit transition action: pending|confirmed -> cancelled.
  """

  use Jido.Action,
    name: "cancel_order",
    description: "Cancel an order",
    schema: [
      order_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      at: [type: :string, required: true],
      reason: [type: :string, required: true]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    order_id = fetch_param(params, :order_id)
    from = fetch_param(params, :from)
    to = fetch_param(params, :to)
    reason = fetch_param(params, :reason)

    cond do
      to != "cancelled" or from not in ["pending", "confirmed"] ->
        {:error, "CancelOrder requires to=cancelled and from in [pending, confirmed]"}

      context.state[:order_id] != order_id ->
        {:error, "order_id mismatch between transition payload and agent state"}

      true ->
        {:ok, %{cancelled_reason: reason}}
    end
  end

  def run(_params, _context) do
    {:error, "CancelOrder requires to=cancelled and from in [pending, confirmed]"}
  end

  defp fetch_param(params, key) do
    Map.get(params, key) || Map.get(params, Atom.to_string(key))
  end
end
