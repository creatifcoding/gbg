defmodule AvaElixir.Workers.AvaCommandWorkerTest do
  use ExUnit.Case, async: false

  alias AvaElixir.Repo
  alias AvaElixir.Workers.AvaCommandWorker
  alias Ecto.Adapters.SQL
  alias Oban.Job

  setup do
    Repo.query!("TRUNCATE TABLE ava_outbox, ava_events, ava_commands RESTART IDENTITY CASCADE")
    :ok
  end

  describe "new/2 uniqueness semantics" do
    test "worker config encodes idempotency keys for duplicate args" do
      opts = AvaCommandWorker.__opts__()
      unique_opts = Keyword.fetch!(opts, :unique)

      assert Keyword.fetch!(unique_opts, :keys) == [:action, :view_id]
      assert Keyword.fetch!(unique_opts, :fields) == [:worker, :queue, :args]
      assert Keyword.fetch!(unique_opts, :period) == 60

      assert :retryable in Keyword.fetch!(unique_opts, :states)
      assert :executing in Keyword.fetch!(unique_opts, :states)
    end

    test "new/2 builds stable queue+worker metadata for duplicate jobs" do
      args = %{"action" => "invalidate", "view_id" => "view-123", "trace" => "a"}

      first = AvaCommandWorker.new(args)
      second = AvaCommandWorker.new(args)

      assert Ecto.Changeset.get_change(first, :worker) ==
               "AvaElixir.Workers.AvaCommandWorker"

      assert Ecto.Changeset.get_change(first, :queue) == "ava_commands"
      assert Ecto.Changeset.get_change(first, :args) == Ecto.Changeset.get_change(second, :args)
    end
  end

  describe "backoff/1" do
    test "is monotonic and bounded" do
      values =
        1..25
        |> Enum.map(fn attempt ->
          AvaCommandWorker.backoff(%Job{attempt: attempt})
        end)

      assert values == Enum.sort(values)
      assert Enum.max(values) <= 300
      assert hd(values) >= 0
    end
  end

  describe "perform/1" do
    test "malformed args return :ok and do not crash" do
      malformed = [
        %{},
        %{"action" => "invalidate"},
        %{"view_id" => "view-123"},
        %{"action" => 100, "view_id" => "view-123"},
        %{"action" => "invalidate", "view_id" => nil}
      ]

      for args <- malformed do
        assert :ok = AvaCommandWorker.perform(%Job{args: args})
      end
    end

    test "valid command persists command/event/outbox through ash boundary" do
      args = %{"action" => "invalidate", "view_id" => "view-ash-1", "trace" => "trace-1"}

      assert :ok = AvaCommandWorker.perform(%Job{args: args})

      command_count =
        SQL.query!(Repo, "SELECT count(*) FROM ava_commands WHERE payload->>'view_id' = $1", ["view-ash-1"]).rows

      event_count =
        SQL.query!(Repo, "SELECT count(*) FROM ava_events WHERE payload->>'view_id' = $1", ["view-ash-1"]).rows

      outbox_rows =
        SQL.query!(
          Repo,
          "SELECT topic, payload->>'view_id' FROM ava_outbox WHERE topic = $1",
          ["tmnl.ava.invalidate.view-ash-1"]
        ).rows

      assert [[1]] = command_count
      assert [[1]] = event_count
      assert [["tmnl.ava.invalidate.view-ash-1", "view-ash-1"]] = outbox_rows
    end
  end
end
