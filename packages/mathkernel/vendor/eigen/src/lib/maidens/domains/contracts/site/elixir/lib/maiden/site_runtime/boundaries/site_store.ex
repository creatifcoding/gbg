defmodule Maiden.SiteRuntime.Boundaries.SiteStore do
  @moduledoc """
  Port contract for site transition persistence boundary.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
