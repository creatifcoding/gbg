defmodule AvaElixir.Resources.AvaEvent do
  @moduledoc """
  Durable event stream row with deterministic stream ordering.
  """

  use Ash.Resource,
    domain: AvaElixir.Ash.Domain,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "ava_events"
    repo AvaElixir.Repo
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [
        :command_id,
        :event_type,
        :stream_name,
        :stream_key,
        :stream_version,
        :global_position,
        :causation_id,
        :correlation_id,
        :payload,
        :metadata
      ]
    end

    update :update do
      accept [
        :command_id,
        :event_type,
        :stream_name,
        :stream_key,
        :stream_version,
        :global_position,
        :causation_id,
        :correlation_id,
        :payload,
        :metadata
      ]
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :command_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :event_type, :string do
      allow_nil? false
      public? true
    end

    attribute :stream_name, :string do
      allow_nil? false
      public? true
    end

    attribute :stream_key, :string do
      allow_nil? false
      public? true
    end

    attribute :stream_version, :integer do
      allow_nil? false
      constraints min: 0
      public? true
    end

    attribute :global_position, :integer do
      allow_nil? false
      constraints min: 0
      public? true
    end

    attribute :causation_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :correlation_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :payload, :map do
      allow_nil? false
      default %{}
      public? true
    end

    attribute :metadata, :map do
      allow_nil? false
      default %{}
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  identities do
    identity :unique_global_position, [:global_position]
    identity :unique_stream_position, [:stream_name, :stream_key, :stream_version]
  end
end
