defmodule Maiden.Melanie.Eval.Variants.SummarizeMinimal do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.Summarize,
    variant: :minimal,
    description: "Summarize content into a brief."
end
