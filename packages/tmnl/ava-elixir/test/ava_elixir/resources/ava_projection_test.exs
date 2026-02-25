defmodule AvaElixir.Resources.AvaProjectionTest do
  use ExUnit.Case, async: false

  alias AvaElixir.Ash.Api
  alias AvaElixir.Repo
  alias AvaElixir.Resources.AvaProjection

  setup do
    Repo.query!("TRUNCATE TABLE ava_projections RESTART IDENTITY CASCADE")
    :ok
  end

  test "creates and updates a projection via Ash API" do
    create_changeset =
      AvaProjection
      |> Ash.Changeset.for_create(:create, %{
        view_id: "view-1",
        projection_type: "profile",
        payload: %{"name" => "Alice"},
        checksum: "sha256:create",
        source_global_position: 10
      })

    assert {:ok, projection} = Api.create(create_changeset)
    assert projection.view_id == "view-1"
    assert projection.projection_type == "profile"
    assert projection.payload == %{"name" => "Alice"}
    assert projection.checksum == "sha256:create"
    assert projection.source_global_position == 10

    update_changeset =
      projection
      |> Ash.Changeset.for_update(:update, %{
        payload: %{"name" => "Alice", "status" => "active"},
        checksum: "sha256:update",
        source_global_position: 11
      })

    assert {:ok, updated_projection} = Api.update(update_changeset)
    assert updated_projection.payload == %{"name" => "Alice", "status" => "active"}
    assert updated_projection.checksum == "sha256:update"
    assert updated_projection.source_global_position == 11
  end
end
