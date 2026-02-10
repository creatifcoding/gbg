defmodule AvaElixirWeb.LiveviewStreamSmokeTest do
  use AvaElixirWeb.ConnCase, async: false

  test "ops live receives PubSub event and renders count", %{conn: conn} do
    {:ok, view, _html} = live(conn, "/ops/ws-live")

    envelope =
      AvaElixir.EventEnvelope.new("ava.artifact.updated", "ws-live", %{
        artifact_id: "art-live-1"
      })

    :ok = AvaElixir.EventBus.publish_workspace_event("ws-live", envelope)

    assert render(view) =~ "Events: 1"
    assert render(view) =~ "ava.artifact.updated"
  end
end
