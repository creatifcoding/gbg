defmodule Maiden.AssetRuntime.Boundaries.AssetStore do
  @moduledoc """
  Port contract for asset transition persistence boundary.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
