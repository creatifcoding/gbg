import * as Schema from "effect/Schema"

try {
  class FetchError extends Schema.TaggedErrorClass("@t/FetchError")("FetchError", {
    status: Schema.optional(Schema.Number),
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  }) {}
  console.log("class defined OK")
  const e = new FetchError({ message: "x" })
  console.log("instance OK", e)
} catch (err) {
  console.log("ERR", err)
}
