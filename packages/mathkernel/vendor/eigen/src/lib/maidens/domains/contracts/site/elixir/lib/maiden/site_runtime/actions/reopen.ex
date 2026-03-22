defmodule Maiden.SiteRuntime.Actions.Reopen do
  @moduledoc """
  Explicit transition action: seasonal_shutdown|closed -> operational.
  """

  use Jido.Action,
    name: "reopen",
    description: "Set site status to operational from seasonal_shutdown or closed",
    schema: [
      site_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      action: [type: :string],
      at: [type: :string, required: true],
      reason: [type: :string],
      initiated_by: [type: :string]
    ]

  @allowed_from ["seasonal_shutdown", "closed"]

  @impl true
  def run(params, context) when is_map(params) do
    site_id = fetch_param(params, :site_id)
    from = fetch_param(params, :from)
    to = fetch_param(params, :to)

    cond do
      from not in @allowed_from or to != "operational" ->
        {:error, "Reopen requires to=operational and from in [seasonal_shutdown, closed]"}

      context.state[:site_id] != site_id ->
        {:error, "site_id mismatch between transition payload and agent state"}

      context.state[:status] != from ->
        {:error, "from state mismatch between transition payload and agent state"}

      true ->
        {:ok,
         %{
           status: "operational",
           updated_at: fetch_param(params, :at)
         }}
    end
  end

  def run(_params, _context), do: {:error, "invalid transition payload"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end
