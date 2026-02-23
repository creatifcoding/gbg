defmodule MyApp.OrderValidatorTest do
  use ExUnit.Case, async: true

  alias MyApp.OrderFSM
  alias MyApp.Validators.OrderValidator

  describe "order_validate/2" do
    test "accepts valid order payload" do
      payload = %{
        "order_id" => "ORD-001",
        "customer" => "Alice",
        "items" => [%{"sku" => "SKU-1", "qty" => 2}],
        "total" => 42.5,
        "cancelled_reason" => nil,
        "shipped_at" => nil,
        "delivered_at" => nil
      }

      assert :ok = OrderValidator.order_validate(payload)
    end

    test "rejects invalid order payload" do
      payload = %{
        "order_id" => "ORD-001",
        "customer" => "Alice",
        "items" => [],
        "total" => "42.5",
        "cancelled_reason" => nil,
        "shipped_at" => nil,
        "delivered_at" => nil
      }

      assert {:error, %{errors: _errors}} = OrderValidator.order_validate(payload)
    end
  end

  describe "transition_event_validate/2 + FSM legality" do
    test "accepts legal transition event" do
      payload = %{
        "order_id" => "ORD-001",
        "from" => "pending",
        "to" => "confirmed",
        "at" => "2026-02-22T06:00:00Z",
        "reason" => nil
      }

      assert :ok = OrderValidator.transition_event_validate(payload)
      assert :ok = OrderFSM.validate_transition_for_jido(payload)
    end

    test "rejects transition that is schema-valid but FSM-invalid" do
      payload = %{
        "order_id" => "ORD-001",
        "from" => "pending",
        "to" => "delivered",
        "at" => "2026-02-22T06:00:00Z"
      }

      assert :ok = OrderValidator.transition_event_validate(payload)

      assert {:error,
              %{
                validator: :fsm,
                from: "pending",
                to: "delivered",
                allowed_next: ["confirmed", "cancelled"]
              }} = OrderFSM.validate_transition_for_jido(payload)
    end
  end
end
