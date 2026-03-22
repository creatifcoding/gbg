defmodule Maiden.AssetRuntime.Actions.SetAssetStatus do
  @moduledoc """
  Generic transition action that updates asset status when preflight passes.

  Side effects are intentionally absent here; external effects are emitted as
  directives and executed through boundary adapters.
  """

  alias Maiden.AssetRuntime.FSM

  use Jido.Action,
    name: "set_asset_status",
    description: "Set asset status for a validated transition",
    schema: [
      asset_id: [type: :string, required: true],
      kind: [type: :string],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      action: [type: :string],
      at: [type: :string, required: true],
      reason: [type: :string],
      initiated_by: [type: :string]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    asset_id = fetch(params, :asset_id)
    from = fetch(params, :from)
    to = fetch(params, :to)
    at = fetch(params, :at)

    cond do
      context.state[:asset_id] != asset_id ->
        {:error, "asset_id mismatch between transition payload and agent state"}

      context.state[:status] != from ->
        {:error, "from state mismatch between transition payload and agent state"}

      not FSM.legal_transition?(from, to) ->
        {:error, "transition is illegal for asset FSM"}

      true ->
        metadata =
          context.state[:metadata]
          |> ensure_map()
          |> Map.put("last_transition", %{
            "from" => from,
            "to" => to,
            "at" => at,
            "action" => fetch(params, :action),
            "reason" => fetch(params, :reason),
            "initiated_by" => fetch(params, :initiated_by)
          })

        {:ok, %{status: to, updated_at: at, metadata: metadata}}
    end
  end

  def run(_params, _context), do: {:error, "set_asset_status requires a transition payload"}

  defp fetch(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))

  defp ensure_map(value) when is_map(value), do: value
  defp ensure_map(_value), do: %{}
end
