defmodule AvaElixirWeb.AvaEventChannel do
  use AvaElixirWeb, :channel

  @impl true
  def join(topic, _payload, socket) do
    with {:ok, _workspace_id} <- AvaElixir.ChannelTopics.parse_workspace_events(topic) do
      :ok = AvaElixir.EventBus.subscribe(topic)

      user_id = socket.assigns[:channel_claims][:user_id] || "unknown"
      AvaElixir.Telemetry.emit_channel_lifecycle(:join, topic, user_id)

      {:ok, %{topic: topic}, assign(socket, :topic, topic)}
    else
      _ -> {:error, %{reason: "unauthorized_topic"}}
    end
  end

  @impl true
  def handle_in("ping", payload, socket) do
    {:reply, {:ok, payload}, socket}
  end

  @impl true
  def handle_in("publish", %{"event" => event}, socket) when is_map(event) do
    with {:ok, envelope} <- AvaElixir.EventEnvelope.validate(event),
         :ok <- AvaElixir.EventBus.publish(socket.assigns.topic, envelope) do
      {:reply, {:ok, %{accepted: true}}, socket}
    else
      {:error, reason} -> {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  def handle_in(_event, _payload, socket) do
    {:reply, {:error, %{reason: "unsupported_event"}}, socket}
  end

  @impl true
  def handle_info({:ava_event, envelope}, socket) do
    push(socket, "ava_event", envelope)
    {:noreply, socket}
  end

  def handle_info(_message, socket), do: {:noreply, socket}

  @impl true
  def terminate(_reason, socket) do
    AvaElixir.EventBus.unsubscribe(socket.assigns.topic)

    user_id = socket.assigns[:channel_claims][:user_id] || "unknown"
    AvaElixir.Telemetry.emit_channel_lifecycle(:leave, socket.assigns.topic, user_id)

    :ok
  end
end
