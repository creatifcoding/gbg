defmodule Maiden.EnterpriseRuntime.Actions.SetDissolvedState do
  @moduledoc """
  Explicit transition action: active|restructuring -> dissolved.
  """

  use Jido.Action,
    name: "set_dissolved_state",
    description: "Set enterprise status to dissolved",
    schema: [
      enterprise_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      at: [type: :string, required: true],
      reason: [type: :string]
    ]

  @allowed_from ["active", "restructuring"]

  @impl true
  def run(params, context) when is_map(params) do
    enterprise_id = fetch_param(params, :enterprise_id)
    from = fetch_param(params, :from)
    to = fetch_param(params, :to)

    cond do
      from not in @allowed_from or to != "dissolved" ->
        {:error, "SetDissolvedState requires to=dissolved and from active|restructuring"}

      context.state[:enterprise_id] != enterprise_id ->
        {:error, "enterprise_id mismatch between transition payload and agent state"}

      true ->
        {:ok,
         %{
           status: "dissolved",
           updated_at: fetch_param(params, :at)
         }}
    end
  end

  def run(_params, _context), do: {:error, "invalid transition payload"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end
