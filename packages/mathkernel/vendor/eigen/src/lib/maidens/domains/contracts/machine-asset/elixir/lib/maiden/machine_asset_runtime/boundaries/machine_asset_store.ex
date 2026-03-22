defmodule Maiden.MachineAssetRuntime.Boundaries.MachineAssetStore do
  @moduledoc """
  Port contract for machine-asset transition persistence boundary.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
