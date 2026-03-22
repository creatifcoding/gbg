defmodule Maiden.OrderRuntime.Actions.ConfirmOrder do
  @moduledoc """
  Explicit transition action: pending -> confirmed.

  Jido agent behavior/strategy:
  - Action is executed via Jido.Agent cmd/2.
  - FSM transition legality is preflighted before dispatch.
  """

  use Jido.Action,
    name: "confirm_order",
    description: "Confirm a pending order",
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

    cond do
      from != "pending" or to != "confirmed" ->
        {:error, "ConfirmOrder requires from=pending and to=confirmed"}

      context.state[:order_id] != order_id ->
        {:error, "order_id mismatch between transition payload and agent state"}

      true ->
        {:ok, %{cancelled_reason: nil}}
    end
  end

  def run(_params, _context) do
    {:error, "ConfirmOrder requires from=pending and to=confirmed"}
  end

  defp fetch_param(params, key) do
    Map.get(params, key) || Map.get(params, Atom.to_string(key))
  end
end
