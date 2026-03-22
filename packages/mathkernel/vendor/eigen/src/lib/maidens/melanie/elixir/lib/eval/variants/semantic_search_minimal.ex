defmodule Maiden.Melanie.Eval.Variants.SemanticSearchMinimal do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.SemanticSearch,
    variant: :minimal,
    description: "Search the knowledge base."
end
