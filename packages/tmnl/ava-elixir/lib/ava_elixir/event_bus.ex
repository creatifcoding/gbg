defmodule AvaElixir.EventBus do
  @moduledoc """
  PubSub wrapper for AVA event fanout.
  """

  @pubsub AvaElixir.PubSub

  @spec subscribe(String.t()) :: :ok | {:error, term()}
  def subscribe(topic) when is_binary(topic) do
    Phoenix.PubSub.subscribe(@pubsub, topic)
  end

  @spec unsubscribe(String.t()) :: :ok
  def unsubscribe(topic) when is_binary(topic) do
    Phoenix.PubSub.unsubscribe(@pubsub, topic)
  end

  @spec publish(String.t(), map()) :: :ok | {:error, term()}
  def publish(topic, event) when is_binary(topic) and is_map(event) do
    Phoenix.PubSub.broadcast(@pubsub, topic, {:ava_event, event})
  end

  @spec publish_workspace_event(String.t(), map()) :: :ok | {:error, term()}
  def publish_workspace_event(workspace_id, envelope) do
    publish(AvaElixir.ChannelTopics.workspace_events(workspace_id), envelope)
  end
end
