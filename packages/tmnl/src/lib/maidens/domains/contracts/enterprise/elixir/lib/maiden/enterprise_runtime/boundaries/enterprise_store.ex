defmodule Maiden.EnterpriseRuntime.Boundaries.EnterpriseStore do
  @moduledoc """
  Port contract for Enterprise persistence boundary (Ash/Ecto side).
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
