defmodule AvaElixirWeb.ChannelCase do
  use ExUnit.CaseTemplate

  using do
    quote do
      import Phoenix.ChannelTest

      @endpoint AvaElixirWeb.Endpoint
    end
  end
end
