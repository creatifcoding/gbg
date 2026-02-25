defmodule AvaElixir.Projections.Replay do
  @moduledoc """
  Deterministic replay helpers for projection checksums.
  """

  @type fold_result :: %{
          checksum: String.t(),
          count: non_neg_integer(),
          last_position: integer() | nil
        }

  @spec checksum_payload(map()) :: String.t()
  def checksum_payload(payload) when is_map(payload) do
    payload
    |> canonical_term()
    |> :erlang.term_to_binary()
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
  end

  @spec fold_events([map()]) :: fold_result()
  def fold_events(events) when is_list(events) do
    initial = %{count: 0, last_position: nil, accumulator: :crypto.hash_init(:sha256)}

    result =
      Enum.reduce(events, initial, fn envelope, acc ->
        payload = Map.get(envelope, :payload) || Map.get(envelope, "payload") || %{}

        encoded_payload =
          payload
          |> canonical_term()
          |> :erlang.term_to_binary()

        position = Map.get(envelope, :position) || Map.get(envelope, "position")

        %{
          count: acc.count + 1,
          last_position: position,
          accumulator: :crypto.hash_update(acc.accumulator, encoded_payload)
        }
      end)

    %{
      checksum:
        result.accumulator
        |> :crypto.hash_final()
        |> Base.encode16(case: :lower),
      count: result.count,
      last_position: result.last_position
    }
  end

  @spec verify_projection_checksum([map()], String.t()) :: :ok | {:error, :checksum_mismatch}
  def verify_projection_checksum(events, expected_checksum)
      when is_list(events) and is_binary(expected_checksum) do
    actual_checksum = events |> fold_events() |> Map.fetch!(:checksum)

    if actual_checksum == expected_checksum do
      :ok
    else
      {:error, :checksum_mismatch}
    end
  end

  defp canonical_term(value) when is_map(value) do
    value
    |> Map.to_list()
    |> Enum.map(fn {key, val} -> {canonical_term(key), canonical_term(val)} end)
    |> Enum.sort()
  end

  defp canonical_term(value) when is_list(value) do
    Enum.map(value, &canonical_term/1)
  end

  defp canonical_term(value) when is_tuple(value) do
    value
    |> Tuple.to_list()
    |> Enum.map(&canonical_term/1)
    |> List.to_tuple()
  end

  defp canonical_term(value), do: value
end
