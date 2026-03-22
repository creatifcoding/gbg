defmodule Maiden.SiteRuntime.Boundaries.NoopSiteStore do
  @moduledoc """
  Default no-op SiteStore adapter.
  """

  @behaviour Maiden.SiteRuntime.Boundaries.SiteStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
