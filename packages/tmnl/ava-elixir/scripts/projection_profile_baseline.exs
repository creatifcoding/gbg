require Logger

Logger.configure(level: :warning)
Mix.Task.run("app.start")

defmodule AvaElixir.Scripts.ProjectionProfileBaseline do
  @moduledoc false

  alias AvaElixir.Projections.Replay
  alias AvaElixir.Repo

  @projection_seed {2_787, 8_141, 5_159}
  @events_seed {2_787, 3_321, 9_733}

  @lookup_sql """
  SELECT id, checksum, source_global_position
  FROM ava_projections
  WHERE view_id = $1 AND projection_type = $2
  LIMIT 1
  """

  @defaults %{
    projection_rows: 10_000,
    event_count: 2_000,
    lookup_iterations: 4_000,
    fold_iterations: 500,
    verify_iterations: 500
  }

  @type benchmark_result :: %{
          label: String.t(),
          iterations: pos_integer(),
          loop_total_us: non_neg_integer(),
          avg_us: float(),
          p50_us: non_neg_integer(),
          p95_us: non_neg_integer(),
          min_us: non_neg_integer(),
          max_us: non_neg_integer()
        }

  def run do
    config = load_config()

    ensure_projection_table!()

    %{lookup_key: lookup_key} = seed_projection_rows(config.projection_rows)

    events = build_synthetic_events(config.event_count)
    expected_checksum = events |> Replay.fold_events() |> Map.fetch!(:checksum)

    benches = [
      benchmark(
        "projection read lookup (view_id, projection_type)",
        config.lookup_iterations,
        fn ->
          case Repo.query!(@lookup_sql, [lookup_key.view_id, lookup_key.projection_type],
                 log: false
               ) do
            %{num_rows: 1} ->
              :ok

            result ->
              raise "expected exactly one row from projection lookup, got #{inspect(result.num_rows)}"
          end
        end
      ),
      benchmark("replay fold checksum", config.fold_iterations, fn ->
        %{checksum: checksum, count: count} = Replay.fold_events(events)

        if is_binary(checksum) and count == config.event_count do
          :ok
        else
          raise "unexpected fold result: checksum=#{inspect(checksum)} count=#{inspect(count)}"
        end
      end),
      benchmark("checksum verify path", config.verify_iterations, fn ->
        case Replay.verify_projection_checksum(events, expected_checksum) do
          :ok -> :ok
          other -> raise "verify path returned unexpected result: #{inspect(other)}"
        end
      end)
    ]

    print_report(config, benches)
  end

  defp load_config do
    %{
      projection_rows:
        parse_pos_int_env("AVA_PROFILE_PROJECTION_ROWS", @defaults.projection_rows),
      event_count: parse_pos_int_env("AVA_PROFILE_EVENT_COUNT", @defaults.event_count),
      lookup_iterations:
        parse_pos_int_env("AVA_PROFILE_LOOKUP_ITERATIONS", @defaults.lookup_iterations),
      fold_iterations:
        parse_pos_int_env("AVA_PROFILE_FOLD_ITERATIONS", @defaults.fold_iterations),
      verify_iterations:
        parse_pos_int_env("AVA_PROFILE_VERIFY_ITERATIONS", @defaults.verify_iterations)
    }
  end

  defp parse_pos_int_env(name, default) do
    case System.get_env(name) do
      nil ->
        default

      raw ->
        case Integer.parse(raw) do
          {value, ""} when value > 0 -> value
          _ -> default
        end
    end
  end

  defp ensure_projection_table! do
    case Repo.query("SELECT 1 FROM ava_projections LIMIT 1", [], log: false) do
      {:ok, _} ->
        :ok

      {:error, %Postgrex.Error{postgres: %{code: :undefined_table}}} ->
        raise """
        missing table ava_projections.
        run migrations first: mix ecto.migrate
        """

      {:error, reason} ->
        raise "unable to access ava_projections: #{Exception.message(reason)}"
    end
  end

  defp seed_projection_rows(row_count) do
    Repo.query!("TRUNCATE TABLE ava_projections RESTART IDENTITY CASCADE", [], log: false)

    :rand.seed(:exsplus, @projection_seed)
    timestamp = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    rows =
      Enum.map(1..row_count, fn idx ->
        view_id = "view-#{pad4(idx)}"
        projection_type = projection_type_for(idx)

        payload = %{
          "view_id" => view_id,
          "projection_type" => projection_type,
          "status" => if(rem(idx, 2) == 0, do: "active", else: "pending"),
          "version" => 1 + rem(idx, 8),
          "metrics" => %{
            "latency_ms" => :rand.uniform(500),
            "score" => Float.round(:rand.uniform() * 100.0, 3)
          }
        }

        %{
          id: Ecto.UUID.bingenerate(),
          view_id: view_id,
          projection_type: projection_type,
          payload: payload,
          checksum: Replay.checksum_payload(payload),
          source_global_position: idx,
          inserted_at: timestamp,
          updated_at: timestamp
        }
      end)

    inserted =
      rows
      |> Enum.chunk_every(1_000)
      |> Enum.reduce(0, fn chunk, acc ->
        {chunk_count, _} = Repo.insert_all("ava_projections", chunk, log: false)
        acc + chunk_count
      end)

    if inserted != row_count do
      raise "seed insert mismatch: expected #{row_count}, inserted #{inserted}"
    end

    lookup_idx = div(row_count, 2)

    %{
      lookup_key: %{
        view_id: "view-#{pad4(lookup_idx)}",
        projection_type: projection_type_for(lookup_idx)
      }
    }
  end

  defp build_synthetic_events(event_count) do
    :rand.seed(:exsplus, @events_seed)

    Enum.map(1..event_count, fn idx ->
      %{
        position: idx,
        payload: %{
          "event_type" => event_type_for(idx),
          "view_id" => "view-#{pad4(rem(idx, 1_000) + 1)}",
          "projection_type" => projection_type_for(idx),
          "attributes" => %{
            "counter" => idx,
            "sample" => :rand.uniform(10_000),
            "coefficient" => Float.round(:rand.uniform(), 6)
          },
          "tags" => ["segment-#{rem(idx, 5)}", "phase-#{rem(idx, 7)}"]
        }
      }
    end)
  end

  defp event_type_for(idx) do
    case rem(idx, 3) do
      0 -> "projection.created"
      1 -> "projection.updated"
      _ -> "projection.snapshotted"
    end
  end

  defp projection_type_for(idx) do
    case rem(idx, 3) do
      0 -> "profile"
      1 -> "status"
      _ -> "dashboard"
    end
  end

  defp pad4(value) when is_integer(value) and value >= 0 do
    value
    |> Integer.to_string()
    |> String.pad_leading(4, "0")
  end

  defp benchmark(label, iterations, fun) when is_function(fun, 0) do
    monotonic_samples_us =
      Enum.map(1..iterations, fn _ ->
        started = System.monotonic_time()
        :ok = fun.()
        elapsed_native = System.monotonic_time() - started
        System.convert_time_unit(elapsed_native, :native, :microsecond)
      end)

    {loop_total_us, _} =
      :timer.tc(fn ->
        Enum.each(1..iterations, fn _ ->
          :ok = fun.()
        end)
      end)

    sorted = Enum.sort(monotonic_samples_us)

    %{
      label: label,
      iterations: iterations,
      loop_total_us: loop_total_us,
      avg_us: loop_total_us / iterations,
      p50_us: percentile(sorted, 0.50),
      p95_us: percentile(sorted, 0.95),
      min_us: hd(sorted),
      max_us: List.last(sorted)
    }
  end

  defp percentile([], _), do: 0

  defp percentile(sorted, ratio) when is_list(sorted) and ratio >= 0.0 and ratio <= 1.0 do
    rank = max(0, ceil(length(sorted) * ratio) - 1)
    Enum.at(sorted, rank, 0)
  end

  defp print_report(config, benches) do
    IO.puts("# AVA projection profile baseline")
    IO.puts("")
    IO.puts("mix_env: #{Mix.env()}")
    IO.puts("elixir: #{System.version()}")
    IO.puts("otp: #{System.otp_release()}")
    IO.puts("projection_seed: #{inspect(@projection_seed)}")
    IO.puts("events_seed: #{inspect(@events_seed)}")
    IO.puts("projection_rows: #{config.projection_rows}")
    IO.puts("synthetic_events: #{config.event_count}")
    IO.puts("")

    IO.puts(
      "| benchmark | iterations | loop total (µs) | avg / iter (µs) | p50 (µs) | p95 (µs) | min (µs) | max (µs) |"
    )

    IO.puts("|---|---:|---:|---:|---:|---:|---:|---:|")

    Enum.each(benches, fn bench ->
      IO.puts(
        "| #{bench.label} | #{bench.iterations} | #{bench.loop_total_us} | #{format_float(bench.avg_us)} | #{bench.p50_us} | #{bench.p95_us} | #{bench.min_us} | #{bench.max_us} |"
      )
    end)
  end

  defp format_float(value) when is_float(value) do
    :erlang.float_to_binary(value, decimals: 2)
  end
end

AvaElixir.Scripts.ProjectionProfileBaseline.run()
