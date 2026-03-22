Mix.Task.run("app.start")

alias AvaElixir.Repo

target_view = System.get_env("TARGET_VIEW_ID", "f762-rollout-target")
target_count =
  case Integer.parse(System.get_env("TARGET_VIEW_COUNT", "6")) do
    {value, _} -> max(value, 1)
    :error -> 6
  end

non_target_count =
  case Integer.parse(System.get_env("NON_TARGET_VIEW_COUNT", "4")) do
    {value, _} -> max(value, 0)
    :error -> 4
  end

run_id = System.system_time(:millisecond)
now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

Repo.query!("TRUNCATE TABLE oban_jobs, ava_outbox RESTART IDENTITY CASCADE")

mk_row = fn view_id, failed? ->
  %{
    id: Ecto.UUID.dump!(Ecto.UUID.generate()),
    event_id: Ecto.UUID.dump!(Ecto.UUID.generate()),
    topic: "tmnl.ava.status." <> view_id,
    partition_key: nil,
    payload: %{"view_id" => view_id, "run_id" => run_id, "source" => "targeted_redrive_cohort"},
    headers: %{"source" => "targeted_redrive_cohort", "run_id" => run_id},
    publish_attempts: if(failed?, do: 2, else: 0),
    available_at: now,
    published_at: nil,
    last_error: if(failed?, do: "seeded cohort failure", else: nil),
    inserted_at: now,
    updated_at: now
  }
end

target_rows =
  for i <- 1..target_count do
    mk_row.("#{target_view}-#{i}", true)
  end

non_target_rows =
  for i <- 1..non_target_count do
    mk_row.("f762-other-#{i}", false)
  end

{inserted, _} = Repo.insert_all("ava_outbox", target_rows ++ non_target_rows)

if inserted != target_count + non_target_count do
  raise "seed insert mismatch inserted=#{inserted} expected=#{target_count + non_target_count}"
end

{:ok, %{selected: selected, enqueued: enqueued, dry_run: false}} =
  Mix.Tasks.Ava.Outbox.Redrive.run([
    "--no-dry-run",
    "--limit",
    Integer.to_string(target_count + non_target_count)
  ])

%{rows: [[job_count]]} =
  Repo.query!("SELECT COUNT(*) FROM oban_jobs WHERE queue = 'ava_outbox'")

%{rows: rows} =
  Repo.query!(
    "SELECT DISTINCT args->'payload'->>'view_id' AS view_id FROM oban_jobs WHERE queue = 'ava_outbox' ORDER BY 1"
  )

view_ids = rows |> Enum.map(&List.first/1)

IO.puts("[targeted_redrive] target_view=#{target_view}")
IO.puts("[targeted_redrive] selected=#{selected} enqueued=#{enqueued} job_count=#{job_count}")
IO.puts("[targeted_redrive] enqueued_view_ids=#{inspect(view_ids)}")

if selected != target_count do
  raise "expected selected=#{target_count}, got #{selected}"
end

if enqueued != target_count do
  raise "expected enqueued=#{target_count}, got #{enqueued}"
end

if job_count != target_count do
  raise "expected job_count=#{target_count}, got #{job_count}"
end

if Enum.any?(view_ids, &(!String.starts_with?(&1 || "", target_view <> "-"))) do
  raise "unexpected non-target view_id in enqueued jobs: #{inspect(view_ids)}"
end

IO.puts("[targeted_redrive] cohort stabilization check ✅")
