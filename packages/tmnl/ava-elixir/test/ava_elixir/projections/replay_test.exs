defmodule AvaElixir.Projections.ReplayTest do
  use ExUnit.Case, async: true

  alias AvaElixir.Projections.Replay

  describe "checksum_payload/1" do
    test "same payload with different key order yields same checksum" do
      payload_a = %{alpha: 1, beta: %{x: 10, y: 20}, gamma: [1, 2, 3]}
      payload_b = %{gamma: [1, 2, 3], beta: %{y: 20, x: 10}, alpha: 1}

      assert Replay.checksum_payload(payload_a) == Replay.checksum_payload(payload_b)
    end

    test "different payload yields different checksum" do
      payload_a = %{alpha: 1, beta: 2}
      payload_b = %{alpha: 1, beta: 3}

      refute Replay.checksum_payload(payload_a) == Replay.checksum_payload(payload_b)
    end
  end

  describe "fold_events/1" do
    test "deterministic fold for same event sequence" do
      events = [
        %{position: 1, payload: %{event: "created", value: 1}},
        %{position: 2, payload: %{event: "updated", value: 2}}
      ]

      folded_once = Replay.fold_events(events)
      folded_twice = Replay.fold_events(events)

      assert folded_once == folded_twice
      assert folded_once.count == 2
      assert folded_once.last_position == 2
      assert is_binary(folded_once.checksum)
      assert String.length(folded_once.checksum) == 64
    end
  end

  describe "verify_projection_checksum/2" do
    test "returns checksum mismatch on mismatch" do
      events = [
        %{position: 1, payload: %{event: "created", value: 1}},
        %{position: 2, payload: %{event: "updated", value: 2}}
      ]

      assert {:error, :checksum_mismatch} = Replay.verify_projection_checksum(events, String.duplicate("0", 64))
    end

    test "returns :ok when checksum matches" do
      events = [
        %{position: 10, payload: %{event: "created", value: 3}},
        %{position: 11, payload: %{event: "updated", value: 4}}
      ]

      expected = events |> Replay.fold_events() |> Map.fetch!(:checksum)

      assert :ok = Replay.verify_projection_checksum(events, expected)
    end
  end
end
