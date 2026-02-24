defmodule Maiden.AssetRuntime.Boundaries.JobQueue do
  @moduledoc """
  Port contract for deferred transition job boundary.
  """

  @callback enqueue_transition(event :: map(), opts :: keyword()) :: :ok | {:error, term()}
end
