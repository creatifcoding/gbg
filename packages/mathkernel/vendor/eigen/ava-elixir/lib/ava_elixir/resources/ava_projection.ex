defmodule AvaElixir.Resources.AvaProjection do
  @moduledoc """
  Durable projection snapshot keyed by view and projection type.
  """

  use Ash.Resource,
    domain: AvaElixir.Ash.Domain,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "ava_projections"
    repo AvaElixir.Repo
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [
        :view_id,
        :projection_type,
        :payload,
        :checksum,
        :source_global_position
      ]
    end

    update :update do
      accept [
        :view_id,
        :projection_type,
        :payload,
        :checksum,
        :source_global_position
      ]
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :view_id, :string do
      allow_nil? false
      public? true
    end

    attribute :projection_type, :string do
      allow_nil? false
      public? true
    end

    attribute :payload, :map do
      allow_nil? false
      default %{}
      public? true
    end

    attribute :checksum, :string do
      allow_nil? false
      public? true
    end

    attribute :source_global_position, :integer do
      allow_nil? false
      default 0
      constraints min: 0
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  identities do
    identity :unique_view_projection_type, [:view_id, :projection_type]
  end
end
