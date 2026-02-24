defmodule Maiden.OrderRuntime.Directives.CallModelInference do
  @moduledoc """
  Runtime directive: invoke model inference through ModelAdapter boundary.
  """

  @enforce_keys [:request_id, :model, :prompt]
  defstruct [:request_id, :model, :prompt, options: %{}]

  @type t :: %__MODULE__{
          request_id: String.t(),
          model: String.t(),
          prompt: String.t(),
          options: map()
        }
end
