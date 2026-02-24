defmodule Maiden.AreaRuntime.Boundaries.AreaStore do
  @moduledoc """
  Port contract for area transition persistence boundary.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
