defmodule Maiden.SiteRuntime.Actions.CloseSite do
  @moduledoc """
  Explicit transition action: operational -> closed.
  """

  use Jido.Action,
    name: "close_site",
    description: "Set site status to closed",
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
      from != "operational" or to != "closed" ->
        {:error, "CloseSite requires from=operational and to=closed"}

      context.state[:site_id] != site_id ->
        {:error, "site_id mismatch between transition payload and agent state"}

      context.state[:status] != from ->
        {:error, "from state mismatch between transition payload and agent state"}

      true ->
        {:ok,
         %{
           status: "closed",
           updated_at: fetch_param(params, :at)
         }}
    end
  end

  def run(_params, _context), do: {:error, "invalid transition payload"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end
