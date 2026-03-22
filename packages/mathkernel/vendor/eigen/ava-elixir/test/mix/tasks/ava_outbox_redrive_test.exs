defmodule Mix.Tasks.Ava.Outbox.RedriveTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureIO

  alias AvaElixir.Repo

  setup do
    Repo.query!("TRUNCATE TABLE oban_jobs, ava_outbox RESTART IDENTITY CASCADE")
    :ok
  end

  test "defaults to dry-run and failed+unpublished filter" do
    failed_id = Ecto.UUID.generate()
    success_id = Ecto.UUID.generate()
    published_id = Ecto.UUID.generate()

    Repo.query!(
      """
      INSERT INTO ava_outbox (id, event_id, topic, payload, headers, publish_attempts, available_at, published_at, last_error, inserted_at, updated_at)
      VALUES ($1, $2::uuid, $3, $4::jsonb, '{}'::jsonb, 1, now(), NULL, 'boom', now(), now())
      """,
      [Ecto.UUID.dump!(Ecto.UUID.generate()), Ecto.UUID.dump!(failed_id), "tmnl.failed", Jason.encode!(%{"x" => 1})]
    )

    Repo.query!(
      """
      INSERT INTO ava_outbox (id, event_id, topic, payload, headers, publish_attempts, available_at, published_at, last_error, inserted_at, updated_at)
      VALUES ($1, $2::uuid, $3, $4::jsonb, '{}'::jsonb, 0, now(), NULL, NULL, now(), now())
      """,
      [Ecto.UUID.dump!(Ecto.UUID.generate()), Ecto.UUID.dump!(success_id), "tmnl.unfailed", Jason.encode!(%{"x" => 2})]
    )

    Repo.query!(
      """
      INSERT INTO ava_outbox (id, event_id, topic, payload, headers, publish_attempts, available_at, published_at, last_error, inserted_at, updated_at)
      VALUES ($1, $2::uuid, $3, $4::jsonb, '{}'::jsonb, 1, now(), now(), 'old', now(), now())
      """,
      [Ecto.UUID.dump!(Ecto.UUID.generate()), Ecto.UUID.dump!(published_id), "tmnl.published", Jason.encode!(%{"x" => 3})]
    )

    output =
      capture_io(fn ->
        assert {:ok, %{selected: 1, enqueued: 0, dry_run: true, all: false}} =
                 Mix.Tasks.Ava.Outbox.Redrive.run([])
      end)

    assert output =~ "selected=1"
    assert output =~ "dry_run=true"
    assert output =~ "dry-run: would enqueue 1 jobs"
    assert output =~ "sample_ids="

    # Selection guarantees only one failed+unpublished row is targeted.
    refute output =~ success_id
    refute output =~ published_id

    %{rows: [[job_count]]} = Repo.query!("SELECT COUNT(*) FROM oban_jobs")
    assert job_count == 0
  end

  test "parses --all and --limit in dry-run mode" do
    Repo.query!(
      """
      INSERT INTO ava_outbox (id, event_id, topic, payload, headers, publish_attempts, available_at, published_at, last_error, inserted_at, updated_at)
      VALUES
        ($1, $2::uuid, 'tmnl.1', '{}'::jsonb, '{}'::jsonb, 0, now(), NULL, NULL, now(), now()),
        ($3, $4::uuid, 'tmnl.2', '{}'::jsonb, '{}'::jsonb, 0, now(), NULL, NULL, now(), now())
      """,
      [
        Ecto.UUID.dump!(Ecto.UUID.generate()),
        Ecto.UUID.dump!(Ecto.UUID.generate()),
        Ecto.UUID.dump!(Ecto.UUID.generate()),
        Ecto.UUID.dump!(Ecto.UUID.generate())
      ]
    )

    output =
      capture_io(fn ->
        assert {:ok, %{selected: 1, enqueued: 0, dry_run: true, all: true}} =
                 Mix.Tasks.Ava.Outbox.Redrive.run(["--all", "--limit", "1"])
      end)

    assert output =~ "selected=1"
    assert output =~ "all=true"
  end
end
