defmodule AvaElixirWeb.ChannelAuthTest do
  use AvaElixirWeb.ChannelCase, async: true

  alias AvaElixir.ChannelToken

  test "connect succeeds with valid short-lived token" do
    {:ok, token} = ChannelToken.issue("user-123")

    assert {:ok, socket} =
             connect(AvaElixirWeb.UserSocket, %{}, connect_info: %{auth_token: token})

    assert socket.assigns.channel_claims.user_id == "user-123"
  end

  test "connect fails with invalid token" do
    assert :error =
             connect(AvaElixirWeb.UserSocket, %{}, connect_info: %{auth_token: "invalid-token"})
  end

  test "connect fails with expired token" do
    ttl = AvaElixir.ChannelToken.token_ttl_seconds()
    signed_at = System.os_time(:second) - ttl - 10
    {:ok, token} = ChannelToken.issue("user-expired", signed_at: signed_at)

    assert :error =
             connect(AvaElixirWeb.UserSocket, %{}, connect_info: %{auth_token: token})
  end
end
