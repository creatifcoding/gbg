defmodule Maiden.AreaRuntime.Actions.SetAreaStatus do
  @moduledoc """
  Generic transition action that updates area status when preflight passes.
  """

  alias Maiden.AreaRuntime.FSM

  use Jido.Action,
    name: "set_area_status",
    description: "Set area status for a validated transition",
    schema: [
      area_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      at: [type: :string, required: true],
      reason: [type: :string],
      by: [type: :string]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    area_id = fetch(params, :area_id)
    from = fetch(params, :from)
    to = fetch(params, :to)
    at = fetch(params, :at)

    cond do
      context.state[:area_id] != area_id ->
        {:error, "area_id mismatch between transition payload and agent state"}

      context.state[:status] != from ->
        {:error, "from state mismatch between transition payload and agent state"}

      not FSM.legal_transition?(from, to) ->
        {:error, "transition is illegal for area FSM"}

      true ->
        metadata =
          context.state[:metadata]
          |> ensure_map()
          |> Map.put("last_transition", %{
            "from" => from,
            "to" => to,
            "at" => at,
            "reason" => fetch(params, :reason),
            "by" => fetch(params, :by)
          })

        {:ok, %{status: to, updated_at: at, metadata: metadata}}
    end
  end

  def run(_params, _context), do: {:error, "set_area_status requires a transition payload"}

  defp fetch(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))

  defp ensure_map(value) when is_map(value), do: value
  defp ensure_map(_value), do: %{}
end
