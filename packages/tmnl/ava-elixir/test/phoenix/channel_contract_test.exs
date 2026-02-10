defmodule AvaElixirWeb.ChannelContractTest do
  use AvaElixirWeb.ChannelCase, async: true

  test "channel join + envelope contract fanout" do
    {:ok, token} = AvaElixir.ChannelToken.issue("user-1")

    {:ok, socket} =
      connect(AvaElixirWeb.UserSocket, %{},
        connect_info: %{auth_token: token}
      )

    topic = AvaElixir.ChannelTopics.workspace_events("ws-1")

    assert {:ok, _reply, _socket} =
             subscribe_and_join(socket, AvaElixirWeb.AvaEventChannel, topic)

    envelope =
      AvaElixir.EventEnvelope.new("ava.artifact.updated", "ws-1", %{
        artifact_id: "artifact-1"
      })

    assert :ok = AvaElixir.EventBus.publish(topic, envelope)

    assert_push "ava_event", pushed
    assert {:ok, _} = AvaElixir.EventEnvelope.validate(pushed)
    assert pushed["workspace_id"] == "ws-1" or pushed[:workspace_id] == "ws-1"
  end

  test "invalid topic join is rejected" do
    {:ok, token} = AvaElixir.ChannelToken.issue("user-1")

    {:ok, socket} =
      connect(AvaElixirWeb.UserSocket, %{},
        connect_info: %{auth_token: token}
      )

    assert {:error, %{reason: "unauthorized_topic"}} =
             subscribe_and_join(socket, AvaElixirWeb.AvaEventChannel, "ava:invalid")
  end
end
