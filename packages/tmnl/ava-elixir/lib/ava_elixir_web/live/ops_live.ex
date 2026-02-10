defmodule AvaElixirWeb.OpsLive do
  use AvaElixirWeb, :live_view

  @impl true
  def mount(%{"workspace_id" => workspace_id}, _session, socket) do
    topic = AvaElixir.ChannelTopics.workspace_events(workspace_id)

    if connected?(socket), do: AvaElixir.EventBus.subscribe(topic)

    {:ok,
     socket
     |> assign(:workspace_id, workspace_id)
     |> assign(:topic, topic)
     |> assign(:events, [])}
  end

  @impl true
  def handle_info({:ava_event, envelope}, socket) do
    events = [envelope | socket.assigns.events] |> Enum.take(25)

    {:noreply,
     socket
     |> assign(:events, events)
     |> push_event("ava_event", envelope)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <main id="ops-live" phx-hook="OpsEventStream" data-workspace-id={@workspace_id}>
      <h1>AVA Ops Live</h1>
      <p>Workspace: <%= @workspace_id %></p>
      <p>Topic: <%= @topic %></p>
      <p id="event-count">Events: <%= length(@events) %></p>

      <ul id="event-list">
        <%= for event <- @events do %>
          <li>
            <strong><%= event["event_type"] || event[:event_type] %></strong>
            <pre><%= inspect(event) %></pre>
          </li>
        <% end %>
      </ul>
    </main>
    """
  end
end
