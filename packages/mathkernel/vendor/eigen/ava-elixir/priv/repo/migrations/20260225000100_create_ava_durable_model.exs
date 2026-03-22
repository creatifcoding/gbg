defmodule AvaElixir.Repo.Migrations.CreateAvaDurableModel do
  use Ecto.Migration

  def change do
    create table(:ava_commands, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :command_type, :text, null: false
      add :idempotency_key, :text, null: false
      add :stream_name, :text, null: false
      add :stream_key, :text, null: false
      add :expected_stream_version, :bigint
      add :payload, :map, null: false, default: %{}
      add :metadata, :map, null: false, default: %{}

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:ava_commands, [:idempotency_key], name: :ava_commands_unique_idempotency_key)
    create index(:ava_commands, [:stream_name, :stream_key], name: :ava_commands_stream_idx)

    create table(:ava_events, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :command_id, :uuid, null: false
      add :event_type, :text, null: false
      add :stream_name, :text, null: false
      add :stream_key, :text, null: false
      add :stream_version, :bigint, null: false
      add :global_position, :bigint, null: false
      add :causation_id, :uuid
      add :correlation_id, :uuid
      add :payload, :map, null: false, default: %{}
      add :metadata, :map, null: false, default: %{}

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:ava_events, [:global_position], name: :ava_events_unique_global_position)

    create unique_index(:ava_events, [:stream_name, :stream_key, :stream_version],
             name: :ava_events_unique_stream_position
           )

    create index(:ava_events, [:command_id], name: :ava_events_command_idx)

    create table(:ava_outbox, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :event_id, :uuid, null: false
      add :topic, :text, null: false
      add :partition_key, :text
      add :payload, :map, null: false, default: %{}
      add :headers, :map, null: false, default: %{}
      add :publish_attempts, :integer, null: false, default: 0
      add :available_at, :utc_datetime_usec, null: false
      add :published_at, :utc_datetime_usec
      add :last_error, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:ava_outbox, [:event_id], name: :ava_outbox_unique_event_delivery)

    create index(:ava_outbox, [:published_at, :available_at], name: :ava_outbox_publish_scan_idx)

    create index(:ava_outbox, [:topic, :partition_key], name: :ava_outbox_topic_partition_idx)

    create table(:ava_checkpoints, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :consumer_name, :text, null: false
      add :last_global_position, :bigint, null: false, default: 0
      add :last_event_id, :uuid
      add :metadata, :map, null: false, default: %{}

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:ava_checkpoints, [:consumer_name], name: :ava_checkpoints_unique_consumer_name)
  end
end
