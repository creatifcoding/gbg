defmodule AvaElixir.Resources.AvaCheckpoint do
  @moduledoc """
  Consumer checkpoint for resumable stream publication.
  """

  use Ash.Resource,
    domain: AvaElixir.Ash.Domain,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "ava_checkpoints"
    repo AvaElixir.Repo
  end

  actions do
    defaults [:create, :read, :update, :destroy]
  end

  attributes do
    uuid_primary_key :id

    attribute :consumer_name, :string do
      allow_nil? false
      public? true
    end

    attribute :last_global_position, :integer do
      allow_nil? false
      default 0
      constraints min: 0
      public? true
    end

    attribute :last_event_id, :uuid do
      allow_nil? true
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
    identity :unique_consumer_name, [:consumer_name]
  end
end
