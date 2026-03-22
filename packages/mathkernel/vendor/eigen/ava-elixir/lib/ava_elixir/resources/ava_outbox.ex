defmodule AvaElixir.Resources.AvaOutbox do
  @moduledoc """
  Outbox rows for publication with publish markers and retry state.
  """

  use Ash.Resource,
    domain: AvaElixir.Ash.Domain,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "ava_outbox"
    repo AvaElixir.Repo
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [
        :event_id,
        :topic,
        :partition_key,
        :payload,
        :headers,
        :publish_attempts,
        :available_at,
        :published_at,
        :last_error
      ]
    end

    update :update do
      accept [
        :event_id,
        :topic,
        :partition_key,
        :payload,
        :headers,
        :publish_attempts,
        :available_at,
        :published_at,
        :last_error
      ]
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :event_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :topic, :string do
      allow_nil? false
      public? true
    end

    attribute :partition_key, :string do
      allow_nil? true
      public? true
    end

    attribute :payload, :map do
      allow_nil? false
      default %{}
      public? true
    end

    attribute :headers, :map do
      allow_nil? false
      default %{}
      public? true
    end

    attribute :publish_attempts, :integer do
      allow_nil? false
      default 0
      constraints min: 0
      public? true
    end

    attribute :available_at, :utc_datetime_usec do
      allow_nil? false
      default &DateTime.utc_now/0
      public? true
    end

    attribute :published_at, :utc_datetime_usec do
      allow_nil? true
      public? true
    end

    attribute :last_error, :string do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  identities do
    identity :unique_event_delivery, [:event_id]
  end
end
