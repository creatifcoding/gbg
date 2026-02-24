defmodule Maiden.SensorRuntime.Boundaries.SensorStore do
  @moduledoc """
  Port contract for sensor transition persistence boundary.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
