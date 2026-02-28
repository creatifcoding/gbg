defmodule Maiden.Melanie.Eval.Variants.FindConnectionsMinimal do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.FindConnections,
    variant: :minimal,
    description: "Find connections between entities."
end
