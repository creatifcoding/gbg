defmodule Maiden.OrderRuntime.Persistence.PostgresStorage do
  @moduledoc """
  Ecto/Postgres-backed `Jido.Storage` adapter for durable ORDER runtime persistence.

  Configuration precedence (highest to lowest):
  1. Explicit storage overrides passed by caller
  2. `config :maiden_order_runtime, :order_postgres, ...`
  3. Legacy `ORDER_POSTGRES_*` env vars
  4. Internal defaults

  Recommended: set `:order_postgres` in `config/runtime.exs` and keep runtime code
  free from direct env parsing.
  """

  @behaviour Jido.Storage

  alias Ecto.Adapters.SQL
  alias Jido.Thread
  alias Jido.Thread.Entry
  alias Jido.Thread.EntryNormalizer
  alias Maiden.OrderRuntime.Persistence.Repo

  @default_port 5432
  @default_pool_size 5
  @default_timeout_ms 15_000
  @default_table_prefix "maiden_order_runtime"

  @truthy MapSet.new(["1", "true", "yes", "on"])
  @app :maiden_order_runtime

  @type opts :: keyword()

  @spec storage_from_config(keyword()) :: {module(), keyword()}
  def storage_from_config(overrides \\ []) do
    {__MODULE__, storage_opts(overrides)}
  end

  @spec storage_from_env(keyword()) :: {module(), keyword()}
  def storage_from_env(overrides \\ []) do
    storage_from_config(overrides)
  end

  @spec storage_opts(keyword()) :: keyword()
  def storage_opts(overrides \\ []) do
    default_storage_opts()
    |> Keyword.merge(legacy_env_storage_opts())
    |> Keyword.merge(app_storage_opts())
    |> Keyword.merge(overrides)
  end

  @spec env_storage_opts(keyword()) :: keyword()
  def env_storage_opts(overrides \\ []), do: storage_opts(overrides)

  defp default_storage_opts do
    [
      port: @default_port,
      ssl: false,
      pool_size: @default_pool_size,
      timeout_ms: @default_timeout_ms,
      table_prefix: @default_table_prefix
    ]
  end

  defp app_storage_opts do
    case Application.get_env(@app, :order_postgres, []) do
      opts when is_list(opts) -> opts
      _ -> []
    end
  end

  defp legacy_env_storage_opts do
    [
      hostname: System.get_env("ORDER_POSTGRES_HOST"),
      port: parse_int(System.get_env("ORDER_POSTGRES_PORT")),
      username: System.get_env("ORDER_POSTGRES_USER"),
      password: System.get_env("ORDER_POSTGRES_PASSWORD"),
      database: System.get_env("ORDER_POSTGRES_DATABASE"),
      ssl: parse_optional_bool(System.get_env("ORDER_POSTGRES_SSL")),
      pool_size: parse_int(System.get_env("ORDER_POSTGRES_POOL_SIZE")),
      timeout_ms: parse_int(System.get_env("ORDER_POSTGRES_TIMEOUT_MS")),
      table_prefix: System.get_env("ORDER_POSTGRES_TABLE_PREFIX")
    ]
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
  end

  @impl true
  def get_checkpoint(key, opts) do
    with_repo(opts, fn repo ->
      key_hash = key_hash(key)

      case query(
             repo,
             "SELECT checkpoint_binary FROM #{table_name(opts, :checkpoints)} WHERE key_hash = $1",
             [key_hash],
             opts
           ) do
        {:ok, %{rows: [[checkpoint_binary]]}} -> decode_term(checkpoint_binary)
        {:ok, %{rows: []}} -> :not_found
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  @impl true
  def put_checkpoint(key, data, opts) do
    with_repo(opts, fn repo ->
      key_hash = key_hash(key)
      key_binary = :erlang.term_to_binary(key)
      checkpoint_binary = :erlang.term_to_binary(data)
      now = now_ms()

      sql = """
      INSERT INTO #{table_name(opts, :checkpoints)}
        (key_hash, key_binary, checkpoint_binary, inserted_at_ms, updated_at_ms)
      VALUES ($1, $2, $3, $4, $4)
      ON CONFLICT (key_hash)
      DO UPDATE SET
        key_binary = EXCLUDED.key_binary,
        checkpoint_binary = EXCLUDED.checkpoint_binary,
        updated_at_ms = EXCLUDED.updated_at_ms
      """

      case query(repo, sql, [key_hash, key_binary, checkpoint_binary, now], opts) do
        {:ok, _} -> :ok
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  @impl true
  def delete_checkpoint(key, opts) do
    with_repo(opts, fn repo ->
      case query(
             repo,
             "DELETE FROM #{table_name(opts, :checkpoints)} WHERE key_hash = $1",
             [key_hash(key)],
             opts
           ) do
        {:ok, _} -> :ok
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  @impl true
  def load_thread(thread_id, opts) do
    with_repo(opts, fn repo ->
      with {:ok, meta} <- fetch_thread_meta(repo, thread_id, opts),
           {:ok, entries} <- fetch_thread_entries(repo, thread_id, opts) do
        build_thread(thread_id, meta, entries)
      end
    end)
  end

  @impl true
  def append_thread(thread_id, entries, opts) do
    with_repo(opts, fn repo ->
      expected_rev = Keyword.get(opts, :expected_rev)
      tx_timeout = query_timeout_ms(opts)

      case repo.transaction(
             fn ->
               with {:ok, _} <- advisory_lock(repo, thread_id, opts),
                    {:ok, current_meta} <- fetch_thread_meta_for_update(repo, thread_id, opts),
                    :ok <- validate_expected_rev(expected_rev, current_meta.rev),
                    {:ok, prepared_entries} <- normalize_entries(entries, current_meta.rev),
                    :ok <- insert_entries(repo, thread_id, prepared_entries, opts),
                    :ok <-
                      upsert_thread_meta(repo, thread_id, current_meta, prepared_entries, opts),
                    {:ok, entries_after} <- fetch_thread_entries(repo, thread_id, opts),
                    {:ok, meta_after} <- fetch_thread_meta(repo, thread_id, opts),
                    {:ok, thread} <- build_thread(thread_id, meta_after, entries_after) do
                 thread
               else
                 {:error, reason} -> repo.rollback(reason)
               end
             end,
             timeout: tx_timeout
           ) do
        {:ok, thread} -> {:ok, thread}
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  @impl true
  def delete_thread(thread_id, opts) do
    with_repo(opts, fn repo ->
      tx_timeout = query_timeout_ms(opts)

      case repo.transaction(
             fn ->
               with {:ok, _} <-
                      query(
                        repo,
                        "DELETE FROM #{table_name(opts, :thread_entries)} WHERE thread_id = $1",
                        [thread_id],
                        opts
                      ),
                    {:ok, _} <-
                      query(
                        repo,
                        "DELETE FROM #{table_name(opts, :thread_meta)} WHERE thread_id = $1",
                        [thread_id],
                        opts
                      ) do
                 :ok
               else
                 {:error, reason} -> repo.rollback(reason)
               end
             end,
             timeout: tx_timeout
           ) do
        {:ok, :ok} -> :ok
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  defp with_repo(opts, fun) when is_function(fun, 1) do
    with :ok <- ensure_repo_started(opts),
         :ok <- ensure_tables(opts) do
      fun.(Repo)
    end
  end

  defp ensure_repo_started(opts) do
    with {:ok, repo_opts} <- repo_start_opts(opts) do
      identity = repo_identity(repo_opts)

      case Process.whereis(Repo) do
        nil -> start_repo(repo_opts, identity)
        _pid -> ensure_repo_identity(identity)
      end
    end
  end

  defp start_repo(repo_opts, identity) do
    case Repo.start_link(repo_opts) do
      {:ok, _pid} ->
        :persistent_term.put(repo_identity_key(), identity)
        :ok

      {:error, {:already_started, _pid}} ->
        ensure_repo_identity(identity)

      {:error, reason} ->
        {:error, {:repo_start_failed, reason}}
    end
  end

  defp ensure_repo_identity(identity) do
    case :persistent_term.get(repo_identity_key(), :missing) do
      :missing ->
        :persistent_term.put(repo_identity_key(), identity)
        :ok

      ^identity ->
        :ok

      existing ->
        {:error,
         {:repo_config_mismatch,
          %{existing: redact_repo_identity(existing), requested: redact_repo_identity(identity)}}}
    end
  end

  defp repo_start_opts(opts) do
    storage_opts = storage_opts(opts)

    with {:ok, hostname} <- fetch_required_opt(storage_opts, :hostname, "ORDER_POSTGRES_HOST"),
         {:ok, username} <- fetch_required_opt(storage_opts, :username, "ORDER_POSTGRES_USER"),
         {:ok, database} <- fetch_required_opt(storage_opts, :database, "ORDER_POSTGRES_DATABASE") do
      {:ok,
       [
         hostname: hostname,
         port: Keyword.get(storage_opts, :port, @default_port),
         username: username,
         password: Keyword.get(storage_opts, :password),
         database: database,
         ssl: Keyword.get(storage_opts, :ssl, false),
         pool_size: Keyword.get(storage_opts, :pool_size, @default_pool_size),
         timeout: query_timeout_ms(storage_opts)
       ]}
    end
  end

  defp repo_identity(repo_opts) do
    %{
      hostname: Keyword.get(repo_opts, :hostname),
      port: Keyword.get(repo_opts, :port),
      username: Keyword.get(repo_opts, :username),
      database: Keyword.get(repo_opts, :database),
      ssl: Keyword.get(repo_opts, :ssl, false)
    }
  end

  defp redact_repo_identity(identity) when is_map(identity) do
    identity
  end

  defp repo_identity_key, do: {__MODULE__, :repo_identity}

  defp fetch_required_opt(opts, key, env_name) do
    case Keyword.get(opts, key) do
      value when is_binary(value) and value != "" -> {:ok, value}
      _ -> {:error, {:missing_env, env_name}}
    end
  end

  defp ensure_tables(opts) do
    cache_key = {__MODULE__, :tables_ready, storage_cache_identity(opts)}

    case :persistent_term.get(cache_key, :missing) do
      :ready ->
        :ok

      :missing ->
        with :ok <- create_tables(opts) do
          :persistent_term.put(cache_key, :ready)
          :ok
        end
    end
  end

  defp create_tables(opts) do
    checkpoints = table_name(opts, :checkpoints)
    thread_entries = table_name(opts, :thread_entries)
    thread_meta = table_name(opts, :thread_meta)

    statements = [
      """
      CREATE TABLE IF NOT EXISTS #{checkpoints} (
        key_hash TEXT PRIMARY KEY,
        key_binary BYTEA NOT NULL,
        checkpoint_binary BYTEA NOT NULL,
        inserted_at_ms BIGINT NOT NULL,
        updated_at_ms BIGINT NOT NULL
      )
      """,
      """
      CREATE TABLE IF NOT EXISTS #{thread_meta} (
        thread_id TEXT PRIMARY KEY,
        rev BIGINT NOT NULL,
        created_at_ms BIGINT NOT NULL,
        updated_at_ms BIGINT NOT NULL,
        metadata_binary BYTEA NOT NULL
      )
      """,
      """
      CREATE TABLE IF NOT EXISTS #{thread_entries} (
        thread_id TEXT NOT NULL,
        seq BIGINT NOT NULL,
        entry_binary BYTEA NOT NULL,
        inserted_at_ms BIGINT NOT NULL,
        PRIMARY KEY (thread_id, seq)
      )
      """,
      "CREATE INDEX IF NOT EXISTS #{checkpoints}_updated_idx ON #{checkpoints} (updated_at_ms)",
      "CREATE INDEX IF NOT EXISTS #{thread_entries}_thread_seq_idx ON #{thread_entries} (thread_id, seq)",
      "CREATE INDEX IF NOT EXISTS #{thread_meta}_updated_idx ON #{thread_meta} (updated_at_ms)"
    ]

    Enum.reduce_while(statements, :ok, fn sql, _acc ->
      case query(Repo, sql, [], opts) do
        {:ok, _} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp advisory_lock(repo, thread_id, opts) do
    query(repo, "SELECT pg_advisory_xact_lock(hashtext($1))", [thread_id], opts)
  end

  defp fetch_thread_meta(repo, thread_id, opts) do
    sql =
      "SELECT rev, created_at_ms, updated_at_ms, metadata_binary FROM #{table_name(opts, :thread_meta)} WHERE thread_id = $1"

    case query(repo, sql, [thread_id], opts) do
      {:ok, %{rows: [[rev, created_at, updated_at, metadata_binary]]}} ->
        with {:ok, metadata} <- decode_term(metadata_binary) do
          {:ok, %{rev: rev, created_at: created_at, updated_at: updated_at, metadata: metadata}}
        end

      {:ok, %{rows: []}} ->
        {:ok, %{rev: 0, created_at: nil, updated_at: nil, metadata: %{}}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp fetch_thread_meta_for_update(repo, thread_id, opts) do
    sql =
      "SELECT rev, created_at_ms, updated_at_ms, metadata_binary FROM #{table_name(opts, :thread_meta)} WHERE thread_id = $1 FOR UPDATE"

    case query(repo, sql, [thread_id], opts) do
      {:ok, %{rows: [[rev, created_at, updated_at, metadata_binary]]}} ->
        with {:ok, metadata} <- decode_term(metadata_binary) do
          {:ok, %{rev: rev, created_at: created_at, updated_at: updated_at, metadata: metadata}}
        end

      {:ok, %{rows: []}} ->
        {:ok, %{rev: 0, created_at: nil, updated_at: nil, metadata: %{}}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp fetch_thread_entries(repo, thread_id, opts) do
    sql =
      "SELECT entry_binary FROM #{table_name(opts, :thread_entries)} WHERE thread_id = $1 ORDER BY seq ASC"

    case query(repo, sql, [thread_id], opts) do
      {:ok, %{rows: rows}} ->
        rows
        |> Enum.reduce_while({:ok, []}, fn [entry_binary], {:ok, acc} ->
          case decode_term(entry_binary) do
            {:ok, decoded} -> {:cont, {:ok, [decoded | acc]}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end)
        |> case do
          {:ok, entries} -> {:ok, Enum.reverse(entries)}
          {:error, _} = error -> error
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp build_thread(thread_id, %{rev: rev} = meta, entries) when is_list(entries) do
    cond do
      rev == 0 and entries == [] ->
        :not_found

      rev != length(entries) ->
        {:error, {:thread_rev_mismatch, rev, length(entries)}}

      true ->
        {:ok,
         %Thread{
           id: thread_id,
           rev: rev,
           entries: entries,
           created_at: meta.created_at || (List.first(entries) && List.first(entries).at),
           updated_at: meta.updated_at || (List.last(entries) && List.last(entries).at),
           metadata: meta.metadata || %{},
           stats: %{entry_count: length(entries)}
         }}
    end
  end

  defp validate_expected_rev(nil, _current_rev), do: :ok
  defp validate_expected_rev(expected_rev, expected_rev), do: :ok
  defp validate_expected_rev(_expected_rev, _current_rev), do: {:error, :conflict}

  defp normalize_entries(entries, current_rev) do
    now = now_ms()
    {:ok, EntryNormalizer.normalize_many(entries, current_rev, now)}
  end

  defp insert_entries(_repo, _thread_id, [], _opts), do: :ok

  defp insert_entries(repo, thread_id, entries, opts) do
    sql = """
    INSERT INTO #{table_name(opts, :thread_entries)} (thread_id, seq, entry_binary, inserted_at_ms)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (thread_id, seq)
    DO UPDATE SET
      entry_binary = EXCLUDED.entry_binary,
      inserted_at_ms = EXCLUDED.inserted_at_ms
    """

    Enum.reduce_while(entries, :ok, fn %Entry{} = entry, _acc ->
      case query(repo, sql, [thread_id, entry.seq, :erlang.term_to_binary(entry), now_ms()], opts) do
        {:ok, _} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp upsert_thread_meta(repo, thread_id, current_meta, prepared_entries, opts) do
    now = now_ms()
    new_rev = current_meta.rev + length(prepared_entries)

    created_at = current_meta.created_at || now

    metadata =
      if current_meta.rev == 0 do
        Keyword.get(opts, :metadata, %{})
      else
        current_meta.metadata
      end

    metadata_binary = :erlang.term_to_binary(metadata)

    sql = """
    INSERT INTO #{table_name(opts, :thread_meta)}
      (thread_id, rev, created_at_ms, updated_at_ms, metadata_binary)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (thread_id)
    DO UPDATE SET
      rev = EXCLUDED.rev,
      updated_at_ms = EXCLUDED.updated_at_ms,
      metadata_binary = EXCLUDED.metadata_binary
    """

    case query(repo, sql, [thread_id, new_rev, created_at, now, metadata_binary], opts) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp query(repo, sql, params, opts) do
    SQL.query(repo, sql, params, timeout: query_timeout_ms(opts))
  rescue
    error -> {:error, {:sql_exception, Exception.message(error)}}
  end

  defp key_hash(key) do
    key
    |> :erlang.term_to_binary()
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
  end

  defp decode_term(binary) when is_binary(binary) do
    {:ok, :erlang.binary_to_term(binary, [:safe])}
  rescue
    ArgumentError -> {:error, :invalid_term}
  end

  defp table_name(opts, suffix) do
    "#{table_prefix(opts)}_#{suffix}"
  end

  defp table_prefix(opts) do
    opts
    |> Keyword.get(:table_prefix, @default_table_prefix)
    |> sanitize_identifier()
  end

  defp storage_cache_identity(opts) do
    storage_opts = storage_opts(opts)

    %{
      hostname: Keyword.get(storage_opts, :hostname),
      port: Keyword.get(storage_opts, :port),
      username: Keyword.get(storage_opts, :username),
      database: Keyword.get(storage_opts, :database),
      table_prefix: table_prefix(storage_opts)
    }
  end

  defp sanitize_identifier(nil), do: @default_table_prefix

  defp sanitize_identifier(value) do
    value
    |> to_string()
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9_]/, "_")
    |> case do
      "" -> @default_table_prefix
      sanitized -> sanitized
    end
  end

  defp query_timeout_ms(opts) do
    case Keyword.get(opts, :timeout_ms, @default_timeout_ms) do
      timeout when is_integer(timeout) and timeout > 0 -> timeout
      timeout when is_binary(timeout) -> parse_int(timeout) || @default_timeout_ms
      _ -> @default_timeout_ms
    end
  end

  defp parse_int(nil), do: nil

  defp parse_int(value) when is_integer(value), do: value

  defp parse_int(value) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, ""} -> parsed
      _ -> nil
    end
  end

  defp parse_optional_bool(nil), do: nil

  defp parse_optional_bool(value) when is_boolean(value), do: value

  defp parse_optional_bool(value) when is_binary(value) do
    value
    |> String.downcase()
    |> then(&MapSet.member?(@truthy, &1))
  end

  defp now_ms, do: System.system_time(:millisecond)
end
