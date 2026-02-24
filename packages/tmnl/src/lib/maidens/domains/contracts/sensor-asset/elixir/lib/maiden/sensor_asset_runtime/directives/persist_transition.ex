defmodule Maiden.SensorAssetRuntime.Directives.PersistTransition do
  @moduledoc """
  Runtime directive: persist a validated transition via SensorAssetStore boundary.
  """

  @enforce_keys [:event, :metadata]
  defstruct [:event, :metadata]

  @type t :: %__MODULE__{
          event: map(),
          metadata: map()
        }
end
