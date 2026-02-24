defmodule Maiden.LineRuntime.Actions.SetLineStatus do
  @moduledoc """
  Generic transition action that updates line status when preflight passes.
  """

  alias Maiden.LineRuntime.FSM

  use Jido.Action,
    name: "set_line_status",
    description: "Set line status for a validated transition",
    schema: [
      line_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      at: [type: :string, required: true],
      reason: [type: :string],
      initiated_by: [type: :string]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    line_id = fetch(params, :line_id)
    from = fetch(params, :from)
    to = fetch(params, :to)
    at = fetch(params, :at)

    cond do
      context.state[:line_id] != line_id ->
        {:error, "line_id mismatch between transition payload and agent state"}

      context.state[:status] != from ->
        {:error, "from state mismatch between transition payload and agent state"}

      not FSM.legal_transition?(from, to) ->
        {:error, "transition is illegal for line FSM"}

      true ->
        metadata =
          context.state[:metadata]
          |> ensure_map()
          |> Map.put("last_transition", %{
            "from" => from,
            "to" => to,
            "at" => at,
            "reason" => fetch(params, :reason),
            "initiated_by" => fetch(params, :initiated_by)
          })

        {:ok, %{status: to, updated_at: at, metadata: metadata}}
    end
  end

  def run(_params, _context), do: {:error, "set_line_status requires a transition payload"}

  defp fetch(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))

  defp ensure_map(value) when is_map(value), do: value
  defp ensure_map(_value), do: %{}
end
