defmodule AvaElixir.Resources.AvaCommand do
  @moduledoc """
  Durable command ingestion record with idempotency guarantees.
  """

  use Ash.Resource,
    domain: AvaElixir.Ash.Domain,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "ava_commands"
    repo AvaElixir.Repo
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [
        :command_type,
        :idempotency_key,
        :stream_name,
        :stream_key,
        :expected_stream_version,
        :payload,
        :metadata
      ]
    end

    update :update do
      accept [
        :command_type,
        :idempotency_key,
        :stream_name,
        :stream_key,
        :expected_stream_version,
        :payload,
        :metadata
      ]
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :command_type, :string do
      allow_nil? false
      public? true
    end

    attribute :idempotency_key, :string do
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

    attribute :expected_stream_version, :integer do
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
    identity :unique_idempotency_key, [:idempotency_key]
    identity :stream_command_identity, [:stream_name, :stream_key, :id]
  end
end
