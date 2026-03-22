defmodule Maiden.EnterpriseRuntime.Actions.SetMergedState do
  @moduledoc """
  Explicit transition action: active -> merged.
  """

  use Jido.Action,
    name: "set_merged_state",
    description: "Set enterprise status to merged",
    schema: [
      enterprise_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      at: [type: :string, required: true],
      reason: [type: :string]
    ]

  @allowed_from ["active"]

  @impl true
  def run(params, context) when is_map(params) do
    enterprise_id = fetch_param(params, :enterprise_id)
    from = fetch_param(params, :from)
    to = fetch_param(params, :to)

    cond do
      from not in @allowed_from or to != "merged" ->
        {:error, "SetMergedState requires to=merged and from=active"}

      context.state[:enterprise_id] != enterprise_id ->
        {:error, "enterprise_id mismatch between transition payload and agent state"}

      true ->
        {:ok,
         %{
           status: "merged",
           updated_at: fetch_param(params, :at)
         }}
    end
  end

  def run(_params, _context), do: {:error, "invalid transition payload"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end
