defmodule Maiden.WorkcellRuntime.Boundaries.WorkcellStore do
  @moduledoc """
  Port contract for WorkCell persistence boundary.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
