defmodule Maiden.EnterpriseRuntime.Boundaries.NoopEnterpriseStore do
  @moduledoc """
  Default no-op EnterpriseStore adapter.
  """

  @behaviour Maiden.EnterpriseRuntime.Boundaries.EnterpriseStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
