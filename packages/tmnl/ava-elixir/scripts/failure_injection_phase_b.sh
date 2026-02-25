#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AVA_DIR="${ROOT_DIR}/ava-elixir"
REPORT_DIR="${AVA_DIR}/reports/phase_b"
BATCH_LIMIT="${REDRIVE_BATCH_LIMIT:-250}"

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }

run_logged() {
  local label="$1"
  local logfile="$2"
  shift 2

  echo "[run] ${label}"

  if "$@" >"${logfile}" 2>&1; then
    pass "${label}"
  else
    cat "${logfile}"
    fail "${label}"
  fi
}

mkdir -p "${REPORT_DIR}"
cd "${AVA_DIR}"

echo "[phase-b] starting failure injection drill"
echo "[phase-b] batch_limit=${BATCH_LIMIT}"
echo "[phase-b] log_dir=${REPORT_DIR}"

run_logged \
  "a) malformed envelope rejection check (nats_ingress test)" \
  "${REPORT_DIR}/01_nats_ingress_pre_pressure.log" \
  mix test test/ava_elixir/bridge/nats_ingress_test.exs

run_logged \
  "b0) seed queue pressure backlog in ava_outbox" \
  "${REPORT_DIR}/02_seed_outbox_pressure.log" \
  env PHASE_B_BATCH_LIMIT="${BATCH_LIMIT}" mix run -e '
    Mix.Task.run("app.start")
    alias AvaElixir.Repo

    limit =
      case Integer.parse(System.get_env("PHASE_B_BATCH_LIMIT", "250")) do
        {value, _} -> max(value, 1)
        :error -> 250
      end

    run_id = System.system_time(:millisecond)
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    rows =
      for i <- 1..limit do
        view_id = "f762-phase-b-#{run_id}-#{i}"

        %{
          id: Ecto.UUID.dump!(Ecto.UUID.generate()),
          event_id: Ecto.UUID.dump!(Ecto.UUID.generate()),
          topic: "tmnl.ava.status." <> view_id,
          partition_key: nil,
          payload: %{"view_id" => view_id, "seq" => i, "source" => "failure_injection_phase_b"},
          headers: %{"source" => "failure_injection_phase_b", "phase" => "b", "run_id" => run_id},
          publish_attempts: 2,
          available_at: now,
          published_at: nil,
          last_error: "seeded pressure backlog",
          inserted_at: now,
          updated_at: now
        }
      end

    {count, _} = Repo.insert_all("ava_outbox", rows, on_conflict: :nothing)
    IO.puts("seeded=#{count}")
  '

seeded_count="$(grep -Eo 'seeded=[0-9]+' "${REPORT_DIR}/02_seed_outbox_pressure.log" | tail -n 1 | cut -d= -f2 || true)"

if [[ -z "${seeded_count}" ]]; then
  cat "${REPORT_DIR}/02_seed_outbox_pressure.log"
  fail "b0) seed queue pressure backlog in ava_outbox (missing seeded count)"
fi

if [[ "${seeded_count}" -lt 1 ]]; then
  cat "${REPORT_DIR}/02_seed_outbox_pressure.log"
  fail "b0) seed queue pressure backlog in ava_outbox (seeded_count=${seeded_count})"
fi

pass "b0) seeded_count=${seeded_count}"

run_logged \
  "b1) redrive dry-run under queue pressure" \
  "${REPORT_DIR}/03_redrive_dry_run.log" \
  mix ava.outbox.redrive --limit "${BATCH_LIMIT}" --dry-run

run_logged \
  "b2) redrive enqueue pass under queue pressure" \
  "${REPORT_DIR}/04_redrive_real_enqueue.log" \
  mix ava.outbox.redrive --limit "${BATCH_LIMIT}" --no-dry-run

run_logged \
  "b3) command path responsiveness after pressure (nats_ingress test)" \
  "${REPORT_DIR}/05_nats_ingress_post_pressure.log" \
  mix test test/ava_elixir/bridge/nats_ingress_test.exs

run_logged \
  "c) bridge restart drill (restart NatsConsumer + validate NatsIngress :ok)" \
  "${REPORT_DIR}/06_bridge_restart_drill.log" \
  mix run scripts/bridge_restart_drill.exs

echo "[phase-b] completed ✅"
echo "[phase-b] logs:"
printf '  - %s\n' \
  "${REPORT_DIR}/01_nats_ingress_pre_pressure.log" \
  "${REPORT_DIR}/02_seed_outbox_pressure.log" \
  "${REPORT_DIR}/03_redrive_dry_run.log" \
  "${REPORT_DIR}/04_redrive_real_enqueue.log" \
  "${REPORT_DIR}/05_nats_ingress_post_pressure.log" \
  "${REPORT_DIR}/06_bridge_restart_drill.log"
