import * as Schema from "effect/Schema"

function tryIt(label, fn) {
  try {
    fn()
    console.log(label, "OK")
  } catch (e) {
    console.log(label, "ERR", e.message?.slice(0, 80))
  }
}

tryIt("Schema.Defect alone", () => {
  const s = Schema.Defect
  console.log(s)
})

tryIt("Schema.optional(Schema.Defect)", () => {
  const s = Schema.optional(Schema.Defect)
  console.log(s)
})

tryIt("TaggedErrorClass with cause: optional(Defect)", () => {
  class FetchError extends Schema.TaggedErrorClass("@t/FetchError")("FetchError", {
    cause: Schema.optional(Schema.Defect),
  }) {}
})

tryIt("TaggedErrorClass simple", () => {
  class E extends Schema.TaggedErrorClass("@t/E")("E", {
    value: Schema.String,
  }) {}
})
