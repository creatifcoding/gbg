::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Parallel and Sequential Errors {#_top .astro-np5lzwrf}
:::
::::

::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::: sl-markdown-content
When working with Effect, if an error occurs, the default behavior is to
fail with the first error encountered.

**Example** (Failing on the First Error)

Here, the program fails with the first error it encounters,
`"Oh uh!"`{dir="auto"}.

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}
::::::
:::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[fail]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail: &lt;string&gt;(error: string) =&gt; Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that represents a recoverable error.

**When to Use**

Use this function to explicitly signal an error in an `Effect`. The
error will keep propagating unless it is handled. You can handle the
error with functions like

catchAll

or

catchTag

.

**Example** (Creating a Failed Effect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
//      ┌─── Effect&lt;never, Error, never&gt;//      ▼const failure = Effect.fail(  new Error(&quot;Operation failed due to network error&quot;))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [succeed to create an effect
that represents a successful value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fail]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Oh
uh!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const die: Effect.Effect&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[die]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const dieMessage: (message: string) =&gt; Effect.Effect&lt;never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an effect that terminates a fiber with a `RuntimeException`
containing the specified message.

**Details**

This function is used to signal a defect, representing a critical and
unexpected error in the code. When invoked, it produces an effect that
terminates the fiber with a `RuntimeException` carrying the given
message.

The resulting effect has an error channel of type `never`, indicating it
does not handle or recover from the error.

**When to Use**

Use this function when you want to terminate a fiber due to an
unrecoverable defect and include a clear explanation in the message.

**Example** (Terminating on Division by Zero with a Specified Message)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const divide = (a: number, b: number) =&gt;  b === 0    ? Effect.dieMessage(&quot;Cannot divide by zero&quot;)    : Effect.succeed(a / b)
//      ┌─── Effect&lt;number, never, never&gt;//      ▼const program = divide(1, 0)
Effect.runPromise(program).catch(console.error)// Output:// (FiberFailure) RuntimeException: Cannot divide by zero//   ...stack trace...</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [die for a variant that throws
a specified error.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [dieSync for a variant that
throws a specified error, evaluated
lazily.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[dieMessage]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Boom!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[// Run both effects sequentially]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

:::::::::::::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;[never, never], string, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::::::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const all: &lt;readonly [Effect.Effect&lt;never, string, never&gt;, Effect.Effect&lt;never, never, never&gt;], NoExcessProperties&lt;{    readonly concurrency?: Concurrency | undefined;    readonly batching?: boolean | &quot;inherit&quot; | undefined;    readonly discard?: boolean | undefined;    readonly mode?: &quot;default&quot; | &quot;validate&quot; | &quot;either&quot; | undefined;    readonly concurrentFinalizers?: boolean | undefined;}, unknown&gt;&gt;(arg: readonly [Effect.Effect&lt;never, string, never&gt;, Effect.Effect&lt;never, never, never&gt;], options?: NoExcessProperties&lt;{    readonly concurrency?: Concurrency | undefined;    readonly batching?: boolean | &quot;inherit&quot; | undefined;    readonly discard?: boolean | undefined;    readonly mode?: &quot;default&quot; | &quot;validate&quot; | &quot;either&quot; | undefined;    readonly concurrentFinalizers?: boolean | undefined;}, unknown&gt; | undefined) =&gt; Effect.Effect&lt;...&gt;</code></pre>
</figure>
:::

::::::::::: twoslash-popup-docs
Combines multiple effects into one, returning results based on the input
structure.

**Details**

Use this function when you need to run multiple effects and combine
their results into a single output. It supports tuples, iterables,
structs, and records, making it flexible for different input types.

For instance, if the input is a tuple:

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>//         ┌─── a tuple of effects//         ▼Effect.all([effect1, effect2, ...])</code></pre>
</figure>
:::

the effects are executed sequentially, and the result is a new effect
containing the results as a tuple. The results in the tuple match the
order of the effects passed to `Effect.all`.

**Concurrency**

You can control the execution order (e.g., sequential vs. concurrent)
using the `concurrency` option.

**Short-Circuiting Behavior**

This function stops execution on the first error it encounters, this is
called \"short-circuiting\". If any effect in the collection fails, the
remaining effects will not run, and the error will be propagated. To
change this behavior, you can use the `mode` option, which allows all
effects to run and collect results as `Either` or `Option`.

**The `mode` option**

The `{ mode: "either" }` option changes the behavior of `Effect.all` to
ensure all effects run, even if some fail. Instead of stopping on the
first failure, this mode collects both successes and failures, returning
an array of `Either` instances where each result is either a `Right`
(success) or a `Left` (failure).

Similarly, the `{ mode: "validate" }` option uses `Option` to indicate
success or failure. Each effect returns `None` for success and `Some`
with the error for failure.

**Example** (Combining Effects in Tuples)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const tupleOfEffects = [  Effect.succeed(42).pipe(Effect.tap(Console.log)),  Effect.succeed(&quot;Hello&quot;).pipe(Effect.tap(Console.log))] as const
//      ┌─── Effect&lt;[number, string], never, never&gt;//      ▼const resultsAsTuple = Effect.all(tupleOfEffects)
Effect.runPromise(resultsAsTuple).then(console.log)// Output:// 42// Hello// [ 42, &#39;Hello&#39; ]</code></pre>
</figure>
:::

**Example** (Combining Effects in Iterables)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const iterableOfEffects: Iterable&lt;Effect.Effect&lt;number&gt;&gt; = [1, 2, 3].map(  (n) =&gt; Effect.succeed(n).pipe(Effect.tap(Console.log)))
//      ┌─── Effect&lt;number[], never, never&gt;//      ▼const resultsAsArray = Effect.all(iterableOfEffects)
Effect.runPromise(resultsAsArray).then(console.log)// Output:// 1// 2// 3// [ 1, 2, 3 ]</code></pre>
</figure>
:::

**Example** (Combining Effects in Structs)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const structOfEffects = {  a: Effect.succeed(42).pipe(Effect.tap(Console.log)),  b: Effect.succeed(&quot;Hello&quot;).pipe(Effect.tap(Console.log))}
//      ┌─── Effect&lt;{ a: number; b: string; }, never, never&gt;//      ▼const resultsAsStruct = Effect.all(structOfEffects)
Effect.runPromise(resultsAsStruct).then(console.log)// Output:// 42// Hello// { a: 42, b: &#39;Hello&#39; }</code></pre>
</figure>
:::

**Example** (Combining Effects in Records)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const recordOfEffects: Record&lt;string, Effect.Effect&lt;number&gt;&gt; = {  key1: Effect.succeed(1).pipe(Effect.tap(Console.log)),  key2: Effect.succeed(2).pipe(Effect.tap(Console.log))}
//      ┌─── Effect&lt;{ [x: string]: number; }, never, never&gt;//      ▼const resultsAsRecord = Effect.all(recordOfEffects)
Effect.runPromise(resultsAsRecord).then(console.log)// Output:// 1// 2// { key1: 1, key2: 2 }</code></pre>
</figure>
:::

**Example** (Short-Circuiting Behavior)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const program = Effect.all([  Effect.succeed(&quot;Task1&quot;).pipe(Effect.tap(Console.log)),  Effect.fail(&quot;Task2: Oh no!&quot;).pipe(Effect.tap(Console.log)),  // Won&#39;t execute due to earlier failure  Effect.succeed(&quot;Task3&quot;).pipe(Effect.tap(Console.log))])
Effect.runPromiseExit(program).then(console.log)// Output:// Task1// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Failure&#39;,//   cause: { _id: &#39;Cause&#39;, _tag: &#39;Fail&#39;, failure: &#39;Task2: Oh no!&#39; }// }</code></pre>
</figure>
:::

**Example** (Collecting Results with `mode: "either"`)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const effects = [  Effect.succeed(&quot;Task1&quot;).pipe(Effect.tap(Console.log)),  Effect.fail(&quot;Task2: Oh no!&quot;).pipe(Effect.tap(Console.log)),  Effect.succeed(&quot;Task3&quot;).pipe(Effect.tap(Console.log))]
const program = Effect.all(effects, { mode: &quot;either&quot; })
Effect.runPromiseExit(program).then(console.log)// Output:// Task1// Task3// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Success&#39;,//   value: [//     { _id: &#39;Either&#39;, _tag: &#39;Right&#39;, right: &#39;Task1&#39; },//     { _id: &#39;Either&#39;, _tag: &#39;Left&#39;, left: &#39;Task2: Oh no!&#39; },//     { _id: &#39;Either&#39;, _tag: &#39;Right&#39;, right: &#39;Task3&#39; }//   ]// }</code></pre>
</figure>
:::

**Example** (Collecting Results with `mode: "validate"`)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const effects = [  Effect.succeed(&quot;Task1&quot;).pipe(Effect.tap(Console.log)),  Effect.fail(&quot;Task2: Oh no!&quot;).pipe(Effect.tap(Console.log)),  Effect.succeed(&quot;Task3&quot;).pipe(Effect.tap(Console.log))]
const program = Effect.all(effects, { mode: &quot;validate&quot; })
Effect.runPromiseExit(program).then((result) =&gt; console.log(&quot;%o&quot;, result))// Output:// Task1// Task3// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Failure&#39;,//   cause: {//     _id: &#39;Cause&#39;,//     _tag: &#39;Fail&#39;,//     failure: [//       { _id: &#39;Option&#39;, _tag: &#39;None&#39; },//       { _id: &#39;Option&#39;, _tag: &#39;Some&#39;, value: &#39;Task2: Oh no!&#39; },//       { _id: &#39;Option&#39;, _tag: &#39;None&#39; }//     ]//   }// }</code></pre>
</figure>
:::
:::::::::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forEach for iterating over
elements and applying an effect.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [allWith for a data-last
version of this function.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::::::::

[all]{style="--0:#6F42C1;--1:#B392F0"}[(\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[fail]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const die: Effect.Effect&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[die]{style="--0:#24292E;--1:#E1E4E8"}[\])]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::
:::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
:::
::::::

::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

:::::::::::::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runPromiseExit: &lt;[never, never], string&gt;(effect: Effect.Effect&lt;[never, never], string, never&gt;, options?: {    readonly signal?: AbortSignal;} | undefined) =&gt; Promise&lt;Exit&lt;[never, never], string&gt;&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Runs an effect and returns a `Promise` that resolves to an `Exit`,
representing the outcome.

**Details**

This function executes an effect and resolves to an `Exit` object. The
`Exit` type provides detailed information about the result of the
effect:

- If the effect succeeds, the `Exit` will be of type `Success` and
  include the value produced by the effect.
- If the effect fails, the `Exit` will be of type `Failure` and contain
  a `Cause` object, detailing the failure.

Using this function allows you to examine both successful results and
failure cases in a unified way, while still leveraging `Promise` for
handling the asynchronous behavior of the effect.

**When to Use**

Use this function when you need to understand the outcome of an effect,
whether it succeeded or failed, and want to work with this result using
`Promise` syntax. This is particularly useful when integrating with
systems that rely on promises but need more detailed error handling than
a simple rejection.

**Example** (Handling Results as Exit)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
// Execute a successful effect and get the Exit result as a PromiseEffect.runPromiseExit(Effect.succeed(1)).then(console.log)// Output:// {//   _id: &quot;Exit&quot;,//   _tag: &quot;Success&quot;,//   value: 1// }
// Execute a failing effect and get the Exit result as a PromiseEffect.runPromiseExit(Effect.fail(&quot;my error&quot;)).then(console.log)// Output:// {//   _id: &quot;Exit&quot;,//   _tag: &quot;Failure&quot;,//   cause: {//     _id: &quot;Cause&quot;,//     _tag: &quot;Fail&quot;,//     failure: &quot;my error&quot;//   }// }</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[runPromiseExit]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;[never, never], string, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Promise&lt;Exit&lt;[never, never], string&gt;&gt;.then&lt;void, never&gt;(onfulfilled?: ((value: Exit&lt;[never, never], string&gt;) =&gt; void | PromiseLike&lt;void&gt;) | null | undefined, onrejected?: ((reason: any) =&gt; PromiseLike&lt;never&gt;) | null | undefined): Promise&lt;void&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Attaches callbacks for the resolution and/or rejection of the Promise.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [onfulfilled The callback to
execute when the Promise is resolved.]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [onrejected The callback to
execute when the Promise is rejected.]{.twoslash-popup-docs-tag-value}

[\@returns]{.twoslash-popup-docs-tag-name} ― [A Promise for the
completion of which ever callback is
executed.]{.twoslash-popup-docs-tag-value}
:::
::::::

[then]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var console: Console</code></pre>
</figure>
:::

::::: twoslash-popup-docs
The `console` module provides a simple debugging console that is similar
to the JavaScript console mechanism provided by web browsers.

The module exports two specific components:

- A `Console` class with methods such as `console.log()`,
  `console.error()` and `console.warn()` that can be used to write to
  any Node.js stream.
- A global `console` instance configured to write to
  [`process.stdout`](https://nodejs.org/docs/latest-v22.x/api/process.html#processstdout)
  and
  [`process.stderr`](https://nodejs.org/docs/latest-v22.x/api/process.html#processstderr).
  The global `console` can be used without importing the `node:console`
  module.

***Warning***: The global console object\'s methods are neither
consistently synchronous like the browser APIs they resemble, nor are
they consistently asynchronous like all other Node.js streams. See the
[`note on process I/O`](https://nodejs.org/docs/latest-v22.x/api/process.html#a-note-on-process-io)
for more information.

Example using the global `console`:

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>console.log(&#39;hello world&#39;);// Prints: hello world, to stdoutconsole.log(&#39;hello %s&#39;, &#39;world&#39;);// Prints: hello world, to stdoutconsole.error(new Error(&#39;Whoops, something bad happened&#39;));// Prints error message and stack trace to stderr://   Error: Whoops, something bad happened//     at [eval]:5:15//     at Script.runInThisContext (node:vm:132:18)//     at Object.runInThisContext (node:vm:309:38)//     at node:internal/process/execution:77:19//     at [eval]-wrapper:6:22//     at evalScript (node:internal/process/execution:76:60)//     at node:internal/main/eval_string:23:3
const name = &#39;Will Robinson&#39;;console.warn(`Danger ${name}! Danger!`);// Prints: Danger Will Robinson! Danger!, to stderr</code></pre>
</figure>
:::

Example using the `Console` class:

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>const out = getStreamSomehow();const err = getStreamSomehow();const myConsole = new console.Console(out, err);
myConsole.log(&#39;hello world&#39;);// Prints: hello world, to outmyConsole.log(&#39;hello %s&#39;, &#39;world&#39;);// Prints: hello world, to outmyConsole.error(new Error(&#39;Whoops, something bad happened&#39;));// Prints: [Error: Whoops, something bad happened], to err
const name = &#39;Will Robinson&#39;;myConsole.warn(`Danger ${name}! Danger!`);// Prints: Danger Will Robinson! Danger!, to err</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ―
[[source](https://github.com/nodejs/node/blob/v22.x/lib/console.js)]{.twoslash-popup-docs-tag-value}
:::
::::::::

[console]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Prints to `stdout` with newline. Multiple arguments can be passed, with
the first used as the primary message and all additional used as
substitution values similar to
[`printf(3)`](http://man7.org/linux/man-pages/man3/printf.3.html) (the
arguments are all passed to
[`util.format()`](https://nodejs.org/docs/latest-v22.x/api/util.html#utilformatformat-args)).

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>const count = 5;console.log(&#39;count: %d&#39;, count);// Prints: count: 5, to stdoutconsole.log(&#39;count:&#39;, count);// Prints: count: 5, to stdout</code></pre>
</figure>
:::

See
[`util.format()`](https://nodejs.org/docs/latest-v22.x/api/util.html#utilformatformat-args)
for more information.
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[v0.1.100]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::::
:::::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_id:
\'Exit\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_tag:
\'Failure\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[cause: { \_id:
\'Cause\', \_tag: \'Fail\', failure: \'Oh uh!\'
}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[\*/]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Parallel Errors

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#parallel-errors){.anchor-link
aria-labelledby="parallel-errors"}
:::

In some cases, you might encounter multiple errors, especially during
concurrent computations. When tasks are run concurrently, multiple
errors can happen at the same time.

**Example** (Handling Multiple Errors in Concurrent Computations)

In this example, both the `fail`{dir="auto"} and `die`{dir="auto"}
effects are executed concurrently. Since both fail, the program will
report multiple errors in the output.

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[fail]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail: &lt;string&gt;(error: string) =&gt; Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that represents a recoverable error.

**When to Use**

Use this function to explicitly signal an error in an `Effect`. The
error will keep propagating unless it is handled. You can handle the
error with functions like

catchAll

or

catchTag

.

**Example** (Creating a Failed Effect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
//      ┌─── Effect&lt;never, Error, never&gt;//      ▼const failure = Effect.fail(  new Error(&quot;Operation failed due to network error&quot;))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [succeed to create an effect
that represents a successful value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fail]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Oh
uh!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const die: Effect.Effect&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[die]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const dieMessage: (message: string) =&gt; Effect.Effect&lt;never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an effect that terminates a fiber with a `RuntimeException`
containing the specified message.

**Details**

This function is used to signal a defect, representing a critical and
unexpected error in the code. When invoked, it produces an effect that
terminates the fiber with a `RuntimeException` carrying the given
message.

The resulting effect has an error channel of type `never`, indicating it
does not handle or recover from the error.

**When to Use**

Use this function when you want to terminate a fiber due to an
unrecoverable defect and include a clear explanation in the message.

**Example** (Terminating on Division by Zero with a Specified Message)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const divide = (a: number, b: number) =&gt;  b === 0    ? Effect.dieMessage(&quot;Cannot divide by zero&quot;)    : Effect.succeed(a / b)
//      ┌─── Effect&lt;number, never, never&gt;//      ▼const program = divide(1, 0)
Effect.runPromise(program).catch(console.error)// Output:// (FiberFailure) RuntimeException: Cannot divide by zero//   ...stack trace...</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [die for a variant that throws
a specified error.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [dieSync for a variant that
throws a specified error, evaluated
lazily.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[dieMessage]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Boom!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[// Run both effects concurrently]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

:::::::::::::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, string, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::::::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const all: &lt;readonly [Effect.Effect&lt;never, string, never&gt;, Effect.Effect&lt;never, never, never&gt;], {    concurrency: &quot;unbounded&quot;;}&gt;(arg: readonly [Effect.Effect&lt;never, string, never&gt;, Effect.Effect&lt;never, never, never&gt;], options?: {    concurrency: &quot;unbounded&quot;;} | undefined) =&gt; Effect.Effect&lt;[never, never], string, never&gt;</code></pre>
</figure>
:::

::::::::::: twoslash-popup-docs
Combines multiple effects into one, returning results based on the input
structure.

**Details**

Use this function when you need to run multiple effects and combine
their results into a single output. It supports tuples, iterables,
structs, and records, making it flexible for different input types.

For instance, if the input is a tuple:

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>//         ┌─── a tuple of effects//         ▼Effect.all([effect1, effect2, ...])</code></pre>
</figure>
:::

the effects are executed sequentially, and the result is a new effect
containing the results as a tuple. The results in the tuple match the
order of the effects passed to `Effect.all`.

**Concurrency**

You can control the execution order (e.g., sequential vs. concurrent)
using the `concurrency` option.

**Short-Circuiting Behavior**

This function stops execution on the first error it encounters, this is
called \"short-circuiting\". If any effect in the collection fails, the
remaining effects will not run, and the error will be propagated. To
change this behavior, you can use the `mode` option, which allows all
effects to run and collect results as `Either` or `Option`.

**The `mode` option**

The `{ mode: "either" }` option changes the behavior of `Effect.all` to
ensure all effects run, even if some fail. Instead of stopping on the
first failure, this mode collects both successes and failures, returning
an array of `Either` instances where each result is either a `Right`
(success) or a `Left` (failure).

Similarly, the `{ mode: "validate" }` option uses `Option` to indicate
success or failure. Each effect returns `None` for success and `Some`
with the error for failure.

**Example** (Combining Effects in Tuples)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const tupleOfEffects = [  Effect.succeed(42).pipe(Effect.tap(Console.log)),  Effect.succeed(&quot;Hello&quot;).pipe(Effect.tap(Console.log))] as const
//      ┌─── Effect&lt;[number, string], never, never&gt;//      ▼const resultsAsTuple = Effect.all(tupleOfEffects)
Effect.runPromise(resultsAsTuple).then(console.log)// Output:// 42// Hello// [ 42, &#39;Hello&#39; ]</code></pre>
</figure>
:::

**Example** (Combining Effects in Iterables)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const iterableOfEffects: Iterable&lt;Effect.Effect&lt;number&gt;&gt; = [1, 2, 3].map(  (n) =&gt; Effect.succeed(n).pipe(Effect.tap(Console.log)))
//      ┌─── Effect&lt;number[], never, never&gt;//      ▼const resultsAsArray = Effect.all(iterableOfEffects)
Effect.runPromise(resultsAsArray).then(console.log)// Output:// 1// 2// 3// [ 1, 2, 3 ]</code></pre>
</figure>
:::

**Example** (Combining Effects in Structs)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const structOfEffects = {  a: Effect.succeed(42).pipe(Effect.tap(Console.log)),  b: Effect.succeed(&quot;Hello&quot;).pipe(Effect.tap(Console.log))}
//      ┌─── Effect&lt;{ a: number; b: string; }, never, never&gt;//      ▼const resultsAsStruct = Effect.all(structOfEffects)
Effect.runPromise(resultsAsStruct).then(console.log)// Output:// 42// Hello// { a: 42, b: &#39;Hello&#39; }</code></pre>
</figure>
:::

**Example** (Combining Effects in Records)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const recordOfEffects: Record&lt;string, Effect.Effect&lt;number&gt;&gt; = {  key1: Effect.succeed(1).pipe(Effect.tap(Console.log)),  key2: Effect.succeed(2).pipe(Effect.tap(Console.log))}
//      ┌─── Effect&lt;{ [x: string]: number; }, never, never&gt;//      ▼const resultsAsRecord = Effect.all(recordOfEffects)
Effect.runPromise(resultsAsRecord).then(console.log)// Output:// 1// 2// { key1: 1, key2: 2 }</code></pre>
</figure>
:::

**Example** (Short-Circuiting Behavior)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const program = Effect.all([  Effect.succeed(&quot;Task1&quot;).pipe(Effect.tap(Console.log)),  Effect.fail(&quot;Task2: Oh no!&quot;).pipe(Effect.tap(Console.log)),  // Won&#39;t execute due to earlier failure  Effect.succeed(&quot;Task3&quot;).pipe(Effect.tap(Console.log))])
Effect.runPromiseExit(program).then(console.log)// Output:// Task1// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Failure&#39;,//   cause: { _id: &#39;Cause&#39;, _tag: &#39;Fail&#39;, failure: &#39;Task2: Oh no!&#39; }// }</code></pre>
</figure>
:::

**Example** (Collecting Results with `mode: "either"`)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const effects = [  Effect.succeed(&quot;Task1&quot;).pipe(Effect.tap(Console.log)),  Effect.fail(&quot;Task2: Oh no!&quot;).pipe(Effect.tap(Console.log)),  Effect.succeed(&quot;Task3&quot;).pipe(Effect.tap(Console.log))]
const program = Effect.all(effects, { mode: &quot;either&quot; })
Effect.runPromiseExit(program).then(console.log)// Output:// Task1// Task3// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Success&#39;,//   value: [//     { _id: &#39;Either&#39;, _tag: &#39;Right&#39;, right: &#39;Task1&#39; },//     { _id: &#39;Either&#39;, _tag: &#39;Left&#39;, left: &#39;Task2: Oh no!&#39; },//     { _id: &#39;Either&#39;, _tag: &#39;Right&#39;, right: &#39;Task3&#39; }//   ]// }</code></pre>
</figure>
:::

**Example** (Collecting Results with `mode: "validate"`)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const effects = [  Effect.succeed(&quot;Task1&quot;).pipe(Effect.tap(Console.log)),  Effect.fail(&quot;Task2: Oh no!&quot;).pipe(Effect.tap(Console.log)),  Effect.succeed(&quot;Task3&quot;).pipe(Effect.tap(Console.log))]
const program = Effect.all(effects, { mode: &quot;validate&quot; })
Effect.runPromiseExit(program).then((result) =&gt; console.log(&quot;%o&quot;, result))// Output:// Task1// Task3// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Failure&#39;,//   cause: {//     _id: &#39;Cause&#39;,//     _tag: &#39;Fail&#39;,//     failure: [//       { _id: &#39;Option&#39;, _tag: &#39;None&#39; },//       { _id: &#39;Option&#39;, _tag: &#39;Some&#39;, value: &#39;Task2: Oh no!&#39; },//       { _id: &#39;Option&#39;, _tag: &#39;None&#39; }//     ]//   }// }</code></pre>
</figure>
:::
:::::::::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forEach for iterating over
elements and applying an effect.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [allWith for a data-last
version of this function.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::::::::

[all]{style="--0:#6F42C1;--1:#B392F0"}[(\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[fail]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const die: Effect.Effect&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[die]{style="--0:#24292E;--1:#E1E4E8"}[\],
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::
:::::::::::::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>concurrency: &quot;unbounded&quot;</code></pre>
</figure>
:::
::::

[concurrency]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"unbounded\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

:::::::::::: code
[}).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;[never, never], string, never&gt;, Effect.Effect&lt;void, string, never&gt;&gt;(this: Effect.Effect&lt;[never, never], string, never&gt;, ab: (_: Effect.Effect&lt;[never, never], string, never&gt;) =&gt; Effect.Effect&lt;void, string, never&gt;): Effect.Effect&lt;void, string, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const asVoid: &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
This function maps the success value of an `Effect` value to `void`. If
the original `Effect` value succeeds, the returned `Effect` value will
also succeed. If the original `Effect` value fails, the returned
`Effect` value will fail with the same error.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[asVoid]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
:::
::::::

::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

:::::::::::::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runPromiseExit: &lt;void, string&gt;(effect: Effect.Effect&lt;void, string, never&gt;, options?: {    readonly signal?: AbortSignal;} | undefined) =&gt; Promise&lt;Exit&lt;void, string&gt;&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Runs an effect and returns a `Promise` that resolves to an `Exit`,
representing the outcome.

**Details**

This function executes an effect and resolves to an `Exit` object. The
`Exit` type provides detailed information about the result of the
effect:

- If the effect succeeds, the `Exit` will be of type `Success` and
  include the value produced by the effect.
- If the effect fails, the `Exit` will be of type `Failure` and contain
  a `Cause` object, detailing the failure.

Using this function allows you to examine both successful results and
failure cases in a unified way, while still leveraging `Promise` for
handling the asynchronous behavior of the effect.

**When to Use**

Use this function when you need to understand the outcome of an effect,
whether it succeeded or failed, and want to work with this result using
`Promise` syntax. This is particularly useful when integrating with
systems that rely on promises but need more detailed error handling than
a simple rejection.

**Example** (Handling Results as Exit)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
// Execute a successful effect and get the Exit result as a PromiseEffect.runPromiseExit(Effect.succeed(1)).then(console.log)// Output:// {//   _id: &quot;Exit&quot;,//   _tag: &quot;Success&quot;,//   value: 1// }
// Execute a failing effect and get the Exit result as a PromiseEffect.runPromiseExit(Effect.fail(&quot;my error&quot;)).then(console.log)// Output:// {//   _id: &quot;Exit&quot;,//   _tag: &quot;Failure&quot;,//   cause: {//     _id: &quot;Cause&quot;,//     _tag: &quot;Fail&quot;,//     failure: &quot;my error&quot;//   }// }</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[runPromiseExit]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, string, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Promise&lt;Exit&lt;void, string&gt;&gt;.then&lt;void, never&gt;(onfulfilled?: ((value: Exit&lt;void, string&gt;) =&gt; void | PromiseLike&lt;void&gt;) | null | undefined, onrejected?: ((reason: any) =&gt; PromiseLike&lt;never&gt;) | null | undefined): Promise&lt;void&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Attaches callbacks for the resolution and/or rejection of the Promise.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [onfulfilled The callback to
execute when the Promise is resolved.]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [onrejected The callback to
execute when the Promise is rejected.]{.twoslash-popup-docs-tag-value}

[\@returns]{.twoslash-popup-docs-tag-name} ― [A Promise for the
completion of which ever callback is
executed.]{.twoslash-popup-docs-tag-value}
:::
::::::

[then]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var console: Console</code></pre>
</figure>
:::

::::: twoslash-popup-docs
The `console` module provides a simple debugging console that is similar
to the JavaScript console mechanism provided by web browsers.

The module exports two specific components:

- A `Console` class with methods such as `console.log()`,
  `console.error()` and `console.warn()` that can be used to write to
  any Node.js stream.
- A global `console` instance configured to write to
  [`process.stdout`](https://nodejs.org/docs/latest-v22.x/api/process.html#processstdout)
  and
  [`process.stderr`](https://nodejs.org/docs/latest-v22.x/api/process.html#processstderr).
  The global `console` can be used without importing the `node:console`
  module.

***Warning***: The global console object\'s methods are neither
consistently synchronous like the browser APIs they resemble, nor are
they consistently asynchronous like all other Node.js streams. See the
[`note on process I/O`](https://nodejs.org/docs/latest-v22.x/api/process.html#a-note-on-process-io)
for more information.

Example using the global `console`:

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>console.log(&#39;hello world&#39;);// Prints: hello world, to stdoutconsole.log(&#39;hello %s&#39;, &#39;world&#39;);// Prints: hello world, to stdoutconsole.error(new Error(&#39;Whoops, something bad happened&#39;));// Prints error message and stack trace to stderr://   Error: Whoops, something bad happened//     at [eval]:5:15//     at Script.runInThisContext (node:vm:132:18)//     at Object.runInThisContext (node:vm:309:38)//     at node:internal/process/execution:77:19//     at [eval]-wrapper:6:22//     at evalScript (node:internal/process/execution:76:60)//     at node:internal/main/eval_string:23:3
const name = &#39;Will Robinson&#39;;console.warn(`Danger ${name}! Danger!`);// Prints: Danger Will Robinson! Danger!, to stderr</code></pre>
</figure>
:::

Example using the `Console` class:

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>const out = getStreamSomehow();const err = getStreamSomehow();const myConsole = new console.Console(out, err);
myConsole.log(&#39;hello world&#39;);// Prints: hello world, to outmyConsole.log(&#39;hello %s&#39;, &#39;world&#39;);// Prints: hello world, to outmyConsole.error(new Error(&#39;Whoops, something bad happened&#39;));// Prints: [Error: Whoops, something bad happened], to err
const name = &#39;Will Robinson&#39;;myConsole.warn(`Danger ${name}! Danger!`);// Prints: Danger Will Robinson! Danger!, to err</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ―
[[source](https://github.com/nodejs/node/blob/v22.x/lib/console.js)]{.twoslash-popup-docs-tag-value}
:::
::::::::

[console]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Prints to `stdout` with newline. Multiple arguments can be passed, with
the first used as the primary message and all additional used as
substitution values similar to
[`printf(3)`](http://man7.org/linux/man-pages/man3/printf.3.html) (the
arguments are all passed to
[`util.format()`](https://nodejs.org/docs/latest-v22.x/api/util.html#utilformatformat-args)).

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>const count = 5;console.log(&#39;count: %d&#39;, count);// Prints: count: 5, to stdoutconsole.log(&#39;count:&#39;, count);// Prints: count: 5, to stdout</code></pre>
</figure>
:::

See
[`util.format()`](https://nodejs.org/docs/latest-v22.x/api/util.html#utilformatformat-args)
for more information.
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[v0.1.100]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::::
:::::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_id:
\'Exit\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_tag:
\'Failure\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[cause:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_id:
\'Cause\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_tag:
\'Parallel\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[left: { \_id: \'Cause\',
\_tag: \'Fail\', failure: \'Oh uh!\'
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[right: { \_id:
\'Cause\', \_tag: \'Die\', defect: \[Object\]
}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[\*/]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### parallelErrors

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#parallelerrors){.anchor-link
aria-labelledby="parallelerrors"}
:::

Effect provides a function called `Effect.parallelErrors`{dir="auto"}
that captures all failure errors from concurrent operations in the error
channel.

**Example** (Capturing Multiple Concurrent Failures)

In this example, `Effect.parallelErrors`{dir="auto"} combines the errors
from `fail1`{dir="auto"} and `fail2`{dir="auto"} into a single error.

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail1: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[fail1]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail: &lt;string&gt;(error: string) =&gt; Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that represents a recoverable error.

**When to Use**

Use this function to explicitly signal an error in an `Effect`. The
error will keep propagating unless it is handled. You can handle the
error with functions like

catchAll

or

catchTag

.

**Example** (Creating a Failed Effect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
//      ┌─── Effect&lt;never, Error, never&gt;//      ▼const failure = Effect.fail(  new Error(&quot;Operation failed due to network error&quot;))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [succeed to create an effect
that represents a successful value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fail]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Oh
uh!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail2: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[fail2]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail: &lt;string&gt;(error: string) =&gt; Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that represents a recoverable error.

**When to Use**

Use this function to explicitly signal an error in an `Effect`. The
error will keep propagating unless it is handled. You can handle the
error with functions like

catchAll

or

catchTag

.

**Example** (Creating a Failed Effect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
//      ┌─── Effect&lt;never, Error, never&gt;//      ▼const failure = Effect.fail(  new Error(&quot;Operation failed due to network error&quot;))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [succeed to create an effect
that represents a successful value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fail]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Oh
no!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const die: Effect.Effect&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[die]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const dieMessage: (message: string) =&gt; Effect.Effect&lt;never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an effect that terminates a fiber with a `RuntimeException`
containing the specified message.

**Details**

This function is used to signal a defect, representing a critical and
unexpected error in the code. When invoked, it produces an effect that
terminates the fiber with a `RuntimeException` carrying the given
message.

The resulting effect has an error channel of type `never`, indicating it
does not handle or recover from the error.

**When to Use**

Use this function when you want to terminate a fiber due to an
unrecoverable defect and include a clear explanation in the message.

**Example** (Terminating on Division by Zero with a Specified Message)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const divide = (a: number, b: number) =&gt;  b === 0    ? Effect.dieMessage(&quot;Cannot divide by zero&quot;)    : Effect.succeed(a / b)
//      ┌─── Effect&lt;number, never, never&gt;//      ▼const program = divide(1, 0)
Effect.runPromise(program).catch(console.error)// Output:// (FiberFailure) RuntimeException: Cannot divide by zero//   ...stack trace...</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [die for a variant that throws
a specified error.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [dieSync for a variant that
throws a specified error, evaluated
lazily.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[dieMessage]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Boom!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[// Run all effects concurrently and capture all
errors]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

:::::::::::::::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, string[], never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::::::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const all: &lt;readonly [Effect.Effect&lt;never, string, never&gt;, Effect.Effect&lt;never, string, never&gt;, Effect.Effect&lt;never, never, never&gt;], {    concurrency: &quot;unbounded&quot;;}&gt;(arg: readonly [Effect.Effect&lt;never, string, never&gt;, Effect.Effect&lt;never, string, never&gt;, Effect.Effect&lt;never, never, never&gt;], options?: {    concurrency: &quot;unbounded&quot;;} | undefined) =&gt; Effect.Effect&lt;[never, never, never], string, never&gt;</code></pre>
</figure>
:::

::::::::::: twoslash-popup-docs
Combines multiple effects into one, returning results based on the input
structure.

**Details**

Use this function when you need to run multiple effects and combine
their results into a single output. It supports tuples, iterables,
structs, and records, making it flexible for different input types.

For instance, if the input is a tuple:

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>//         ┌─── a tuple of effects//         ▼Effect.all([effect1, effect2, ...])</code></pre>
</figure>
:::

the effects are executed sequentially, and the result is a new effect
containing the results as a tuple. The results in the tuple match the
order of the effects passed to `Effect.all`.

**Concurrency**

You can control the execution order (e.g., sequential vs. concurrent)
using the `concurrency` option.

**Short-Circuiting Behavior**

This function stops execution on the first error it encounters, this is
called \"short-circuiting\". If any effect in the collection fails, the
remaining effects will not run, and the error will be propagated. To
change this behavior, you can use the `mode` option, which allows all
effects to run and collect results as `Either` or `Option`.

**The `mode` option**

The `{ mode: "either" }` option changes the behavior of `Effect.all` to
ensure all effects run, even if some fail. Instead of stopping on the
first failure, this mode collects both successes and failures, returning
an array of `Either` instances where each result is either a `Right`
(success) or a `Left` (failure).

Similarly, the `{ mode: "validate" }` option uses `Option` to indicate
success or failure. Each effect returns `None` for success and `Some`
with the error for failure.

**Example** (Combining Effects in Tuples)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const tupleOfEffects = [  Effect.succeed(42).pipe(Effect.tap(Console.log)),  Effect.succeed(&quot;Hello&quot;).pipe(Effect.tap(Console.log))] as const
//      ┌─── Effect&lt;[number, string], never, never&gt;//      ▼const resultsAsTuple = Effect.all(tupleOfEffects)
Effect.runPromise(resultsAsTuple).then(console.log)// Output:// 42// Hello// [ 42, &#39;Hello&#39; ]</code></pre>
</figure>
:::

**Example** (Combining Effects in Iterables)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const iterableOfEffects: Iterable&lt;Effect.Effect&lt;number&gt;&gt; = [1, 2, 3].map(  (n) =&gt; Effect.succeed(n).pipe(Effect.tap(Console.log)))
//      ┌─── Effect&lt;number[], never, never&gt;//      ▼const resultsAsArray = Effect.all(iterableOfEffects)
Effect.runPromise(resultsAsArray).then(console.log)// Output:// 1// 2// 3// [ 1, 2, 3 ]</code></pre>
</figure>
:::

**Example** (Combining Effects in Structs)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const structOfEffects = {  a: Effect.succeed(42).pipe(Effect.tap(Console.log)),  b: Effect.succeed(&quot;Hello&quot;).pipe(Effect.tap(Console.log))}
//      ┌─── Effect&lt;{ a: number; b: string; }, never, never&gt;//      ▼const resultsAsStruct = Effect.all(structOfEffects)
Effect.runPromise(resultsAsStruct).then(console.log)// Output:// 42// Hello// { a: 42, b: &#39;Hello&#39; }</code></pre>
</figure>
:::

**Example** (Combining Effects in Records)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const recordOfEffects: Record&lt;string, Effect.Effect&lt;number&gt;&gt; = {  key1: Effect.succeed(1).pipe(Effect.tap(Console.log)),  key2: Effect.succeed(2).pipe(Effect.tap(Console.log))}
//      ┌─── Effect&lt;{ [x: string]: number; }, never, never&gt;//      ▼const resultsAsRecord = Effect.all(recordOfEffects)
Effect.runPromise(resultsAsRecord).then(console.log)// Output:// 1// 2// { key1: 1, key2: 2 }</code></pre>
</figure>
:::

**Example** (Short-Circuiting Behavior)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const program = Effect.all([  Effect.succeed(&quot;Task1&quot;).pipe(Effect.tap(Console.log)),  Effect.fail(&quot;Task2: Oh no!&quot;).pipe(Effect.tap(Console.log)),  // Won&#39;t execute due to earlier failure  Effect.succeed(&quot;Task3&quot;).pipe(Effect.tap(Console.log))])
Effect.runPromiseExit(program).then(console.log)// Output:// Task1// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Failure&#39;,//   cause: { _id: &#39;Cause&#39;, _tag: &#39;Fail&#39;, failure: &#39;Task2: Oh no!&#39; }// }</code></pre>
</figure>
:::

**Example** (Collecting Results with `mode: "either"`)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const effects = [  Effect.succeed(&quot;Task1&quot;).pipe(Effect.tap(Console.log)),  Effect.fail(&quot;Task2: Oh no!&quot;).pipe(Effect.tap(Console.log)),  Effect.succeed(&quot;Task3&quot;).pipe(Effect.tap(Console.log))]
const program = Effect.all(effects, { mode: &quot;either&quot; })
Effect.runPromiseExit(program).then(console.log)// Output:// Task1// Task3// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Success&#39;,//   value: [//     { _id: &#39;Either&#39;, _tag: &#39;Right&#39;, right: &#39;Task1&#39; },//     { _id: &#39;Either&#39;, _tag: &#39;Left&#39;, left: &#39;Task2: Oh no!&#39; },//     { _id: &#39;Either&#39;, _tag: &#39;Right&#39;, right: &#39;Task3&#39; }//   ]// }</code></pre>
</figure>
:::

**Example** (Collecting Results with `mode: "validate"`)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const effects = [  Effect.succeed(&quot;Task1&quot;).pipe(Effect.tap(Console.log)),  Effect.fail(&quot;Task2: Oh no!&quot;).pipe(Effect.tap(Console.log)),  Effect.succeed(&quot;Task3&quot;).pipe(Effect.tap(Console.log))]
const program = Effect.all(effects, { mode: &quot;validate&quot; })
Effect.runPromiseExit(program).then((result) =&gt; console.log(&quot;%o&quot;, result))// Output:// Task1// Task3// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Failure&#39;,//   cause: {//     _id: &#39;Cause&#39;,//     _tag: &#39;Fail&#39;,//     failure: [//       { _id: &#39;Option&#39;, _tag: &#39;None&#39; },//       { _id: &#39;Option&#39;, _tag: &#39;Some&#39;, value: &#39;Task2: Oh no!&#39; },//       { _id: &#39;Option&#39;, _tag: &#39;None&#39; }//     ]//   }// }</code></pre>
</figure>
:::
:::::::::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forEach for iterating over
elements and applying an effect.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [allWith for a data-last
version of this function.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::::::::

[all]{style="--0:#6F42C1;--1:#B392F0"}[(\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail1: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[fail1]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail2: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[fail2]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const die: Effect.Effect&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[die]{style="--0:#24292E;--1:#E1E4E8"}[\],
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::
:::::::::::::::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>concurrency: &quot;unbounded&quot;</code></pre>
</figure>
:::
::::

[concurrency]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"unbounded\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

:::::::::::::::::::: code
[}).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;[never, never, never], string, never&gt;, Effect.Effect&lt;void, string, never&gt;, Effect.Effect&lt;void, string[], never&gt;&gt;(this: Effect.Effect&lt;[never, never, never], string, never&gt;, ab: (_: Effect.Effect&lt;[never, never, never], string, never&gt;) =&gt; Effect.Effect&lt;void, string, never&gt;, bc: (_: Effect.Effect&lt;void, string, never&gt;) =&gt; Effect.Effect&lt;void, string[], never&gt;): Effect.Effect&lt;void, string[], never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const asVoid: &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
This function maps the success value of an `Effect` value to `void`. If
the original `Effect` value succeeds, the returned `Effect` value will
also succeed. If the original `Effect` value fails, the returned
`Effect` value will fail with the same error.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[asVoid]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const parallelErrors: &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, Array&lt;E&gt;, R&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Combines all errors from concurrent operations into a single error.

**Details**

This function is used when you have multiple operations running at the
same time, and you want to capture all the errors that occur across
those operations. Instead of handling each error separately, it combines
all the errors into one unified error.

**When to Use**

When using this function, any errors that occur in the concurrently
running operations will be grouped together into a single error. This
helps simplify error handling in cases where you don\'t need to
differentiate between each failure, but simply want to know that
multiple failures occurred.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fail1 = Effect.fail(&quot;Oh uh!&quot;)const fail2 = Effect.fail(&quot;Oh no!&quot;)const die = Effect.dieMessage(&quot;Boom!&quot;)
// Run all effects concurrently and capture all errorsconst program = Effect.all([fail1, fail2, die], {  concurrency: &quot;unbounded&quot;}).pipe(Effect.asVoid, Effect.parallelErrors)
Effect.runPromiseExit(program).then(console.log)// Output:// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Failure&#39;,//   cause: { _id: &#39;Cause&#39;, _tag: &#39;Fail&#39;, failure: [ &#39;Oh uh!&#39;, &#39;Oh no!&#39; ] }// }</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[parallelErrors]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::
:::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
:::
::::::

::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

:::::::::::::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runPromiseExit: &lt;void, string[]&gt;(effect: Effect.Effect&lt;void, string[], never&gt;, options?: {    readonly signal?: AbortSignal;} | undefined) =&gt; Promise&lt;Exit&lt;void, string[]&gt;&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Runs an effect and returns a `Promise` that resolves to an `Exit`,
representing the outcome.

**Details**

This function executes an effect and resolves to an `Exit` object. The
`Exit` type provides detailed information about the result of the
effect:

- If the effect succeeds, the `Exit` will be of type `Success` and
  include the value produced by the effect.
- If the effect fails, the `Exit` will be of type `Failure` and contain
  a `Cause` object, detailing the failure.

Using this function allows you to examine both successful results and
failure cases in a unified way, while still leveraging `Promise` for
handling the asynchronous behavior of the effect.

**When to Use**

Use this function when you need to understand the outcome of an effect,
whether it succeeded or failed, and want to work with this result using
`Promise` syntax. This is particularly useful when integrating with
systems that rely on promises but need more detailed error handling than
a simple rejection.

**Example** (Handling Results as Exit)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
// Execute a successful effect and get the Exit result as a PromiseEffect.runPromiseExit(Effect.succeed(1)).then(console.log)// Output:// {//   _id: &quot;Exit&quot;,//   _tag: &quot;Success&quot;,//   value: 1// }
// Execute a failing effect and get the Exit result as a PromiseEffect.runPromiseExit(Effect.fail(&quot;my error&quot;)).then(console.log)// Output:// {//   _id: &quot;Exit&quot;,//   _tag: &quot;Failure&quot;,//   cause: {//     _id: &quot;Cause&quot;,//     _tag: &quot;Fail&quot;,//     failure: &quot;my error&quot;//   }// }</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[runPromiseExit]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, string[], never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Promise&lt;Exit&lt;void, string[]&gt;&gt;.then&lt;void, never&gt;(onfulfilled?: ((value: Exit&lt;void, string[]&gt;) =&gt; void | PromiseLike&lt;void&gt;) | null | undefined, onrejected?: ((reason: any) =&gt; PromiseLike&lt;never&gt;) | null | undefined): Promise&lt;void&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Attaches callbacks for the resolution and/or rejection of the Promise.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [onfulfilled The callback to
execute when the Promise is resolved.]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [onrejected The callback to
execute when the Promise is rejected.]{.twoslash-popup-docs-tag-value}

[\@returns]{.twoslash-popup-docs-tag-name} ― [A Promise for the
completion of which ever callback is
executed.]{.twoslash-popup-docs-tag-value}
:::
::::::

[then]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var console: Console</code></pre>
</figure>
:::

::::: twoslash-popup-docs
The `console` module provides a simple debugging console that is similar
to the JavaScript console mechanism provided by web browsers.

The module exports two specific components:

- A `Console` class with methods such as `console.log()`,
  `console.error()` and `console.warn()` that can be used to write to
  any Node.js stream.
- A global `console` instance configured to write to
  [`process.stdout`](https://nodejs.org/docs/latest-v22.x/api/process.html#processstdout)
  and
  [`process.stderr`](https://nodejs.org/docs/latest-v22.x/api/process.html#processstderr).
  The global `console` can be used without importing the `node:console`
  module.

***Warning***: The global console object\'s methods are neither
consistently synchronous like the browser APIs they resemble, nor are
they consistently asynchronous like all other Node.js streams. See the
[`note on process I/O`](https://nodejs.org/docs/latest-v22.x/api/process.html#a-note-on-process-io)
for more information.

Example using the global `console`:

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>console.log(&#39;hello world&#39;);// Prints: hello world, to stdoutconsole.log(&#39;hello %s&#39;, &#39;world&#39;);// Prints: hello world, to stdoutconsole.error(new Error(&#39;Whoops, something bad happened&#39;));// Prints error message and stack trace to stderr://   Error: Whoops, something bad happened//     at [eval]:5:15//     at Script.runInThisContext (node:vm:132:18)//     at Object.runInThisContext (node:vm:309:38)//     at node:internal/process/execution:77:19//     at [eval]-wrapper:6:22//     at evalScript (node:internal/process/execution:76:60)//     at node:internal/main/eval_string:23:3
const name = &#39;Will Robinson&#39;;console.warn(`Danger ${name}! Danger!`);// Prints: Danger Will Robinson! Danger!, to stderr</code></pre>
</figure>
:::

Example using the `Console` class:

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>const out = getStreamSomehow();const err = getStreamSomehow();const myConsole = new console.Console(out, err);
myConsole.log(&#39;hello world&#39;);// Prints: hello world, to outmyConsole.log(&#39;hello %s&#39;, &#39;world&#39;);// Prints: hello world, to outmyConsole.error(new Error(&#39;Whoops, something bad happened&#39;));// Prints: [Error: Whoops, something bad happened], to err
const name = &#39;Will Robinson&#39;;myConsole.warn(`Danger ${name}! Danger!`);// Prints: Danger Will Robinson! Danger!, to err</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ―
[[source](https://github.com/nodejs/node/blob/v22.x/lib/console.js)]{.twoslash-popup-docs-tag-value}
:::
::::::::

[console]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Prints to `stdout` with newline. Multiple arguments can be passed, with
the first used as the primary message and all additional used as
substitution values similar to
[`printf(3)`](http://man7.org/linux/man-pages/man3/printf.3.html) (the
arguments are all passed to
[`util.format()`](https://nodejs.org/docs/latest-v22.x/api/util.html#utilformatformat-args)).

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>const count = 5;console.log(&#39;count: %d&#39;, count);// Prints: count: 5, to stdoutconsole.log(&#39;count:&#39;, count);// Prints: count: 5, to stdout</code></pre>
</figure>
:::

See
[`util.format()`](https://nodejs.org/docs/latest-v22.x/api/util.html#utilformatformat-args)
for more information.
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[v0.1.100]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::::
:::::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_id:
\'Exit\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_tag:
\'Failure\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[cause: { \_id:
\'Cause\', \_tag: \'Fail\', failure: \[ \'Oh uh!\', \'Oh no!\' \]
}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[\*/]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9InN0YXJsaWdodC1hc2lkZV9faWNvbiBhc3Ryby00cmd5N2NycCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Ym94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciIgc3R5bGU9Ii0tc2wtaWNvbi1zaXplOiAxZW07Ij48cGF0aCBkPSJNMTIgMTFhMSAxIDAgMCAwLTEgMXY0YTEgMSAwIDAgMCAyIDB2LTRhMSAxIDAgMCAwLTEtMVptLjM4LTMuOTJhMSAxIDAgMCAwLS43NiAwIDEgMSAwIDAgMC0uMzMuMjEgMS4xNSAxLjE1IDAgMCAwLS4yMS4zMyAxIDEgMCAwIDAgLjIxIDEuMDljLjA5Ny4wODguMjA5LjE2LjMzLjIxQTEgMSAwIDAgMCAxMyA4YTEuMDUgMS4wNSAwIDAgMC0uMjktLjcxIDEgMSAwIDAgMC0uMzMtLjIxWk0xMiAyYTEwIDEwIDAgMSAwIDAgMjAgMTAgMTAgMCAwIDAgMC0yMFptMCAxOGE4IDggMCAxIDEgMC0xNi4wMDFBOCA4IDAgMCAxIDEyIDIwWiIgLz48L3N2Zz4=){.starlight-aside__icon
.astro-4rgy7crp} Applicability

::: starlight-aside__content
Note that `Effect.parallelErrors`{dir="auto"} is only for failures, not
defects or interruptions.
:::

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Sequential Errors

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#sequential-errors){.anchor-link
aria-labelledby="sequential-errors"}
:::

When working with resource-safety operators like
`Effect.ensuring`{dir="auto"}, you may encounter multiple sequential
errors. This happens because regardless of whether the original effect
has any errors or not, the finalizer is uninterruptible and will always
run.

**Example** (Handling Multiple Sequential Errors)

In this example, both `fail`{dir="auto"} and the finalizer
`die`{dir="auto"} result in sequential errors, and both are captured.

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::: code
[// Simulate an effect that fails]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[fail]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail: &lt;string&gt;(error: string) =&gt; Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that represents a recoverable error.

**When to Use**

Use this function to explicitly signal an error in an `Effect`. The
error will keep propagating unless it is handled. You can handle the
error with functions like

catchAll

or

catchTag

.

**Example** (Creating a Failed Effect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
//      ┌─── Effect&lt;never, Error, never&gt;//      ▼const failure = Effect.fail(  new Error(&quot;Operation failed due to network error&quot;))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [succeed to create an effect
that represents a successful value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fail]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Oh
uh!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[// Simulate a finalizer that causes a
defect]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const die: Effect.Effect&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[die]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const dieMessage: (message: string) =&gt; Effect.Effect&lt;never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an effect that terminates a fiber with a `RuntimeException`
containing the specified message.

**Details**

This function is used to signal a defect, representing a critical and
unexpected error in the code. When invoked, it produces an effect that
terminates the fiber with a `RuntimeException` carrying the given
message.

The resulting effect has an error channel of type `never`, indicating it
does not handle or recover from the error.

**When to Use**

Use this function when you want to terminate a fiber due to an
unrecoverable defect and include a clear explanation in the message.

**Example** (Terminating on Division by Zero with a Specified Message)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const divide = (a: number, b: number) =&gt;  b === 0    ? Effect.dieMessage(&quot;Cannot divide by zero&quot;)    : Effect.succeed(a / b)
//      ┌─── Effect&lt;number, never, never&gt;//      ▼const program = divide(1, 0)
Effect.runPromise(program).catch(console.error)// Output:// (FiberFailure) RuntimeException: Cannot divide by zero//   ...stack trace...</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [die for a variant that throws
a specified error.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [dieSync for a variant that
throws a specified error, evaluated
lazily.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[dieMessage]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Boom!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[// The finalizer \'die\' will always run, even if \'fail\'
fails]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fail: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[fail]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;never, string, never&gt;, Effect.Effect&lt;never, string, never&gt;&gt;(this: Effect.Effect&lt;never, string, never&gt;, ab: (_: Effect.Effect&lt;never, string, never&gt;) =&gt; Effect.Effect&lt;never, string, never&gt;): Effect.Effect&lt;never, string, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ensuring: &lt;never, never&gt;(finalizer: Effect.Effect&lt;never, never, never&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, R&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Guarantees the execution of a finalizer when an effect starts execution.

**Details**

This function allows you to specify a `finalizer` effect that will
always be run once the effect starts execution, regardless of whether
the effect succeeds, fails, or is interrupted.

**When to Use**

This is useful when you need to ensure that certain cleanup or final
steps are executed in all cases, such as releasing resources or
performing necessary logging.

While this function provides strong guarantees about executing the
finalizer, it is considered a low-level tool, which may not be ideal for
more complex resource management. For higher-level resource management
with automatic acquisition and release, see the

acquireRelease

family of functions. For use cases where you need access to the result
of an effect, consider using

onExit

.

**Example** (Running a Finalizer in All Outcomes)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Console, Effect } from &quot;effect&quot;
// Define a cleanup effectconst handler = Effect.ensuring(Console.log(&quot;Cleanup completed&quot;))
// Define a successful effectconst success = Console.log(&quot;Task completed&quot;).pipe(  Effect.as(&quot;some result&quot;),  handler)
Effect.runFork(success)// Output:// Task completed// Cleanup completed
// Define a failing effectconst failure = Console.log(&quot;Task failed&quot;).pipe(  Effect.andThen(Effect.fail(&quot;some error&quot;)),  handler)
Effect.runFork(failure)// Output:// Task failed// Cleanup completed
// Define an interrupted effectconst interruption = Console.log(&quot;Task interrupted&quot;).pipe(  Effect.andThen(Effect.interrupt),  handler)
Effect.runFork(interruption)// Output:// Task interrupted// Cleanup completed</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [onExit for a version that
provides access to the result of an
effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[ensuring]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const die: Effect.Effect&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[die]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::
::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
:::
::::::

::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

:::::::::::::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Effect</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runPromiseExit: &lt;never, string&gt;(effect: Effect.Effect&lt;never, string, never&gt;, options?: {    readonly signal?: AbortSignal;} | undefined) =&gt; Promise&lt;Exit&lt;never, string&gt;&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Runs an effect and returns a `Promise` that resolves to an `Exit`,
representing the outcome.

**Details**

This function executes an effect and resolves to an `Exit` object. The
`Exit` type provides detailed information about the result of the
effect:

- If the effect succeeds, the `Exit` will be of type `Success` and
  include the value produced by the effect.
- If the effect fails, the `Exit` will be of type `Failure` and contain
  a `Cause` object, detailing the failure.

Using this function allows you to examine both successful results and
failure cases in a unified way, while still leveraging `Promise` for
handling the asynchronous behavior of the effect.

**When to Use**

Use this function when you need to understand the outcome of an effect,
whether it succeeded or failed, and want to work with this result using
`Promise` syntax. This is particularly useful when integrating with
systems that rely on promises but need more detailed error handling than
a simple rejection.

**Example** (Handling Results as Exit)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
// Execute a successful effect and get the Exit result as a PromiseEffect.runPromiseExit(Effect.succeed(1)).then(console.log)// Output:// {//   _id: &quot;Exit&quot;,//   _tag: &quot;Success&quot;,//   value: 1// }
// Execute a failing effect and get the Exit result as a PromiseEffect.runPromiseExit(Effect.fail(&quot;my error&quot;)).then(console.log)// Output:// {//   _id: &quot;Exit&quot;,//   _tag: &quot;Failure&quot;,//   cause: {//     _id: &quot;Cause&quot;,//     _tag: &quot;Fail&quot;,//     failure: &quot;my error&quot;//   }// }</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[runPromiseExit]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;never, string, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Promise&lt;Exit&lt;never, string&gt;&gt;.then&lt;void, never&gt;(onfulfilled?: ((value: Exit&lt;never, string&gt;) =&gt; void | PromiseLike&lt;void&gt;) | null | undefined, onrejected?: ((reason: any) =&gt; PromiseLike&lt;never&gt;) | null | undefined): Promise&lt;void&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Attaches callbacks for the resolution and/or rejection of the Promise.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [onfulfilled The callback to
execute when the Promise is resolved.]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [onrejected The callback to
execute when the Promise is rejected.]{.twoslash-popup-docs-tag-value}

[\@returns]{.twoslash-popup-docs-tag-name} ― [A Promise for the
completion of which ever callback is
executed.]{.twoslash-popup-docs-tag-value}
:::
::::::

[then]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var console: Console</code></pre>
</figure>
:::

::::: twoslash-popup-docs
The `console` module provides a simple debugging console that is similar
to the JavaScript console mechanism provided by web browsers.

The module exports two specific components:

- A `Console` class with methods such as `console.log()`,
  `console.error()` and `console.warn()` that can be used to write to
  any Node.js stream.
- A global `console` instance configured to write to
  [`process.stdout`](https://nodejs.org/docs/latest-v22.x/api/process.html#processstdout)
  and
  [`process.stderr`](https://nodejs.org/docs/latest-v22.x/api/process.html#processstderr).
  The global `console` can be used without importing the `node:console`
  module.

***Warning***: The global console object\'s methods are neither
consistently synchronous like the browser APIs they resemble, nor are
they consistently asynchronous like all other Node.js streams. See the
[`note on process I/O`](https://nodejs.org/docs/latest-v22.x/api/process.html#a-note-on-process-io)
for more information.

Example using the global `console`:

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>console.log(&#39;hello world&#39;);// Prints: hello world, to stdoutconsole.log(&#39;hello %s&#39;, &#39;world&#39;);// Prints: hello world, to stdoutconsole.error(new Error(&#39;Whoops, something bad happened&#39;));// Prints error message and stack trace to stderr://   Error: Whoops, something bad happened//     at [eval]:5:15//     at Script.runInThisContext (node:vm:132:18)//     at Object.runInThisContext (node:vm:309:38)//     at node:internal/process/execution:77:19//     at [eval]-wrapper:6:22//     at evalScript (node:internal/process/execution:76:60)//     at node:internal/main/eval_string:23:3
const name = &#39;Will Robinson&#39;;console.warn(`Danger ${name}! Danger!`);// Prints: Danger Will Robinson! Danger!, to stderr</code></pre>
</figure>
:::

Example using the `Console` class:

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>const out = getStreamSomehow();const err = getStreamSomehow();const myConsole = new console.Console(out, err);
myConsole.log(&#39;hello world&#39;);// Prints: hello world, to outmyConsole.log(&#39;hello %s&#39;, &#39;world&#39;);// Prints: hello world, to outmyConsole.error(new Error(&#39;Whoops, something bad happened&#39;));// Prints: [Error: Whoops, something bad happened], to err
const name = &#39;Will Robinson&#39;;myConsole.warn(`Danger ${name}! Danger!`);// Prints: Danger Will Robinson! Danger!, to err</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ―
[[source](https://github.com/nodejs/node/blob/v22.x/lib/console.js)]{.twoslash-popup-docs-tag-value}
:::
::::::::

[console]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Prints to `stdout` with newline. Multiple arguments can be passed, with
the first used as the primary message and all additional used as
substitution values similar to
[`printf(3)`](http://man7.org/linux/man-pages/man3/printf.3.html) (the
arguments are all passed to
[`util.format()`](https://nodejs.org/docs/latest-v22.x/api/util.html#utilformatformat-args)).

::: expressive-code
<figure class="frame">
<pre data-language="js"><code>const count = 5;console.log(&#39;count: %d&#39;, count);// Prints: count: 5, to stdoutconsole.log(&#39;count:&#39;, count);// Prints: count: 5, to stdout</code></pre>
</figure>
:::

See
[`util.format()`](https://nodejs.org/docs/latest-v22.x/api/util.html#utilformatformat-args)
for more information.
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[v0.1.100]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::::
:::::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_id:
\'Exit\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_tag:
\'Failure\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[cause:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_id:
\'Cause\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_tag:
\'Sequential\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[left: { \_id: \'Cause\',
\_tag: \'Fail\', failure: \'Oh uh!\'
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[right: { \_id:
\'Cause\', \_tag: \'Die\', defect: \[Object\]
}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
[\*/]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

::: {.meta .sl-flex .astro-lfnsiwle}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXF4bnlic3ZxIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuMmVtOyI+PHBhdGggZD0iTTIyIDcuMjRhMSAxIDAgMCAwLS4yOS0uNzFsLTQuMjQtNC4yNGExIDEgMCAwIDAtMS4xLS4yMiAxIDEgMCAwIDAtLjMyLjIybC0yLjgzIDIuODNMMi4yOSAxNi4wNWExIDEgMCAwIDAtLjI5LjcxVjIxYTEgMSAwIDAgMCAxIDFoNC4yNGExIDEgMCAwIDAgLjc2LS4yOWwxMC44Ny0xMC45M0wyMS43MSA4Yy4xLS4xLjE3LS4yLjIyLS4zM2ExIDEgMCAwIDAgMC0uMjR2LS4xNGwuMDctLjA1Wk02LjgzIDIwSDR2LTIuODNsOS45My05LjkzIDIuODMgMi44M0w2LjgzIDIwWk0xOC4xNyA4LjY2bC0yLjgzLTIuODMgMS40Mi0xLjQxIDIuODIgMi44Mi0xLjQxIDEuNDJaIiAvPjwvc3ZnPg==){.astro-qxnybsvq
.astro-4rgy7crp} Edit
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/error-management/parallel-and-sequential-errors.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Error Channel Operations]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../error-channel-operations/index.html){.astro-u5aomj4k
rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[Yieldable Errors]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../yieldable-errors/index.html){.astro-u5aomj4k
rel="next"}
:::
:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
