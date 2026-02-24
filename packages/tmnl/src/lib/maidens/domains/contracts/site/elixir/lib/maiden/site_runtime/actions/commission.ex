defmodule Maiden.SiteRuntime.Actions.Commission do
  @moduledoc """
  Explicit transition action: under_construction -> operational.
  """

  use Jido.Action,
    name: "commission",
    description: "Set site status to operational after commissioning",
    schema: [
      site_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      action: [type: :string],
      at: [type: :string, required: true],
      reason: [type: :string],
      initiated_by: [type: :string]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    site_id = fetch_param(params, :site_id)
    from = fetch_param(params, :from)
    to = fetch_param(params, :to)

    cond do
      from != "under_construction" or to != "operational" ->
        {:error, "Commission requires from=under_construction and to=operational"}

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
