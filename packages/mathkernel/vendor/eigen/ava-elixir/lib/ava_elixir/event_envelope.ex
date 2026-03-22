defmodule AvaElixir.EventEnvelope do
  @moduledoc """
  Canonical event envelope for Phoenix Channels + LiveView fanout.
  """

  @required_keys ~w(event_id schema_version event_type workspace_id occurred_at payload)a

  @type t :: %{
          required(:event_id) => String.t(),
          required(:schema_version) => pos_integer(),
          required(:event_type) => String.t(),
          required(:workspace_id) => String.t(),
          required(:occurred_at) => String.t(),
          required(:payload) => map()
        }

  @spec new(String.t(), String.t(), map(), keyword()) :: t()
  def new(event_type, workspace_id, payload, opts \\ []) do
    event_id = Keyword.get(opts, :event_id, "evt-#{System.unique_integer([:positive])}")
    occurred_at = Keyword.get(opts, :occurred_at, DateTime.utc_now() |> DateTime.to_iso8601())

    %{
      event_id: event_id,
      schema_version: 1,
      event_type: event_type,
      workspace_id: workspace_id,
      occurred_at: occurred_at,
      payload: payload
    }
  end

  @spec validate(map()) :: {:ok, t()} | {:error, {:invalid_envelope, term()}}
  def validate(candidate) when is_map(candidate) do
    missing =
      Enum.reject(@required_keys, fn key ->
        Map.has_key?(candidate, key) or Map.has_key?(candidate, Atom.to_string(key))
      end)

    case missing do
      [] -> {:ok, normalize(candidate)}
      _ -> {:error, {:invalid_envelope, {:missing_keys, missing}}}
    end
  end

  def validate(_), do: {:error, {:invalid_envelope, :not_a_map}}

  @spec normalize(map()) :: t()
  defp normalize(candidate) do
    %{
      event_id: candidate[:event_id] || candidate["event_id"],
      schema_version: candidate[:schema_version] || candidate["schema_version"],
      event_type: candidate[:event_type] || candidate["event_type"],
      workspace_id: candidate[:workspace_id] || candidate["workspace_id"],
      occurred_at: candidate[:occurred_at] || candidate["occurred_at"],
      payload: candidate[:payload] || candidate["payload"]
    }
  end
end
