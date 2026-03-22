defmodule AvaElixir.Workers.AvaOutboxWorkerTest do
  use ExUnit.Case, async: false

  alias AvaElixir.Ash.Api
  alias AvaElixir.Repo
  alias AvaElixir.Resources.AvaOutbox
  alias AvaElixir.Workers.AvaOutboxWorker
  alias Ecto.Adapters.SQL
  alias Oban.Job

  setup do
    Repo.query!("TRUNCATE TABLE ava_outbox RESTART IDENTITY CASCADE")
    :ok
  end

  defp insert_outbox!(event_id) do
    attrs = %{
      event_id: event_id,
      topic: "tmnl.ava.invalidate.view-outbox-1",
      partition_key: "view-outbox-1",
      payload: %{"view_id" => "view-outbox-1", "event_id" => event_id},
      headers: %{"source" => "test"},
      publish_attempts: 0,
      available_at: DateTime.utc_now(),
      last_error: nil
    }

    changeset = Ash.Changeset.for_create(AvaOutbox, :create, attrs)

    case Api.create(changeset, Api.job_context_opts(%{"source" => "worker_test"})) do
      {:ok, record} -> record
      {:error, reason} -> flunk("failed to insert outbox fixture: #{inspect(reason)}")
    end
  end

  describe "new/2 uniqueness semantics" do
    test "worker config encodes idempotency keys for duplicate args" do
      opts = AvaOutboxWorker.__opts__()
      unique_opts = Keyword.fetch!(opts, :unique)

      assert Keyword.fetch!(unique_opts, :keys) == [:subject, :event_id]
      assert Keyword.fetch!(unique_opts, :fields) == [:worker, :queue, :args]
      assert Keyword.fetch!(unique_opts, :period) == 120

      assert :retryable in Keyword.fetch!(unique_opts, :states)
      assert :scheduled in Keyword.fetch!(unique_opts, :states)
    end

    test "new/2 builds stable queue+worker metadata for duplicate jobs" do
      args = %{"subject" => "ava.events", "event_id" => "evt-123", "payload" => %{}}

      first = AvaOutboxWorker.new(args)
      second = AvaOutboxWorker.new(args)

      assert Ecto.Changeset.get_change(first, :worker) ==
               "AvaElixir.Workers.AvaOutboxWorker"

      assert Ecto.Changeset.get_change(first, :queue) == "ava_outbox"
      assert Ecto.Changeset.get_change(first, :args) == Ecto.Changeset.get_change(second, :args)
    end
  end

  describe "backoff/1" do
    test "is monotonic and bounded" do
      values =
        1..50
        |> Enum.map(fn attempt ->
          AvaOutboxWorker.backoff(%Job{attempt: attempt})
        end)

      assert values == Enum.sort(values)
      assert Enum.max(values) <= 600
      assert hd(values) >= 0
    end
  end

  describe "perform/1" do
    test "malformed args return :ok and do not crash" do
      malformed = [
        %{},
        %{"subject" => "ava.events"},
        %{"payload" => %{}},
        %{"subject" => 100, "payload" => %{}},
        %{"subject" => "ava.events", "payload" => "not-a-map"}
      ]

      for args <- malformed do
        assert :ok = AvaOutboxWorker.perform(%Job{args: args})
      end
    end

    test "marks outbox row published on successful publish" do
      event_id = Ecto.UUID.generate()
      _row = insert_outbox!(event_id)

      args = %{
        "subject" => "tmnl.ava.invalidate.view-outbox-1",
        "payload" => %{"view_id" => "view-outbox-1"},
        "event_id" => event_id
      }

      assert :ok = AvaOutboxWorker.perform(%Job{args: args})

      rows =
        SQL.query!(
          Repo,
          "SELECT published_at IS NOT NULL, publish_attempts, last_error FROM ava_outbox WHERE event_id::text = $1",
          [event_id]
        ).rows

      assert [[true, 0, nil]] = rows
    end

    test "records publish failure metadata when egress is disabled" do
      event_id = Ecto.UUID.generate()
      _row = insert_outbox!(event_id)

      previous = Application.get_env(:ava_elixir, :nats_egress_disabled, false)
      Application.put_env(:ava_elixir, :nats_egress_disabled, true)

      on_exit(fn ->
        Application.put_env(:ava_elixir, :nats_egress_disabled, previous)
      end)

      args = %{
        "subject" => "tmnl.ava.invalidate.view-outbox-1",
        "payload" => %{"view_id" => "view-outbox-1"},
        "event_id" => event_id
      }

      assert :ok = AvaOutboxWorker.perform(%Job{args: args})

      rows =
        SQL.query!(
          Repo,
          "SELECT publish_attempts, last_error FROM ava_outbox WHERE event_id::text = $1",
          [event_id]
        ).rows

      assert [[1, last_error]] = rows
      assert is_binary(last_error)
      assert String.contains?(last_error, "egress_disabled")
    end
  end
end
