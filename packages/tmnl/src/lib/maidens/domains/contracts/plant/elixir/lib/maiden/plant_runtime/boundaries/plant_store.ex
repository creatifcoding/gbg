defmodule Maiden.PlantRuntime.Boundaries.PlantStore do
  @moduledoc """
  Port contract for plant transition persistence boundary.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
