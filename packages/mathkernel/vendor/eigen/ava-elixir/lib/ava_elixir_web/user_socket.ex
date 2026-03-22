defmodule AvaElixirWeb.UserSocket do
  use Phoenix.Socket

  channel("ava:*", AvaElixirWeb.AvaEventChannel)

  @impl true
  def connect(_params, socket, connect_info) do
    with token when is_binary(token) <- connect_info[:auth_token],
         {:ok, claims} <- AvaElixir.ChannelToken.verify(token) do
      {:ok, assign(socket, :channel_claims, claims)}
    else
      _ -> :error
    end
  end

  @impl true
  def id(socket) do
    case socket.assigns[:channel_claims] do
      %{user_id: user_id} -> "user_socket:#{user_id}"
      _ -> nil
    end
  end
end
