defmodule AvaElixir.ChannelTopics do
  @moduledoc """
  Topic taxonomy helpers for AVA Phoenix channels.
  """

  @spec workspace_events(String.t()) :: String.t()
  def workspace_events(workspace_id), do: "ava:workspace:#{workspace_id}:events"

  @spec workspace_presence(String.t()) :: String.t()
  def workspace_presence(workspace_id), do: "ava:workspace:#{workspace_id}:presence"

  @spec user_inbox(String.t()) :: String.t()
  def user_inbox(user_id), do: "ava:user:#{user_id}:inbox"

  @spec parse_workspace_events(String.t()) :: {:ok, String.t()} | {:error, :invalid_topic}
  def parse_workspace_events("ava:workspace:" <> rest) do
    case String.split(rest, ":", parts: 2) do
      [workspace_id, "events"] when workspace_id != "" -> {:ok, workspace_id}
      _ -> {:error, :invalid_topic}
    end
  end

  def parse_workspace_events(_), do: {:error, :invalid_topic}
end
