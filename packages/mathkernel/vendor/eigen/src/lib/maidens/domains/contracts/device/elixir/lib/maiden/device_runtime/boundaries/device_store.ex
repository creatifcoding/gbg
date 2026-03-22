defmodule Maiden.DeviceRuntime.Boundaries.DeviceStore do
  @moduledoc """
  Port contract for device transition persistence boundary.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
