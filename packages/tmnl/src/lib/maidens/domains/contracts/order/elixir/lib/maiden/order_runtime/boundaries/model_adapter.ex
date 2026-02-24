defmodule Maiden.OrderRuntime.Boundaries.ModelAdapter do
  @moduledoc """
  Port contract for model inference boundary.

  Keeps model IO side effects outside Jido actions and strategies.
  """

  @callback infer_model(prompt :: String.t(), opts :: map() | keyword()) ::
              {:ok, term()} | {:error, term()}
end
