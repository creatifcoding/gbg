:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Introduction to Runtime {#_top .astro-np5lzwrf}
:::
::::

:::::::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::::::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::::: sl-markdown-content
The `Runtime<R>`{dir="auto"} data type represents a runtime system that
can **execute effects**. To run an effect,
`Effect<A, E, R>`{dir="auto"}, we need a `Runtime<R>`{dir="auto"} that
contains the required resources, denoted by the `R`{dir="auto"} type
parameter.

A `Runtime<R>`{dir="auto"} consists of three main components:

- A value of type `Context<R>`{dir="auto"}
- A value of type `FiberRefs`{dir="auto"}
- A value of type `RuntimeFlags`{dir="auto"}

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## What is a Runtime System?

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#what-is-a-runtime-system){.anchor-link
aria-labelledby="what-is-a-runtime-system"}
:::

When we write an Effect program, we construct an `Effect`{dir="auto"}
using constructors and combinators. Essentially, we are creating a
blueprint of a program. An `Effect`{dir="auto"} is merely a data
structure that describes the execution of a concurrent program. It
represents a tree-like structure that combines various primitives to
define what the effect should do.

However, this data structure itself does not perform any actions, it is
solely a description of a concurrent program.

To execute this program, the Effect runtime system comes into play. The
`Runtime.run*`{dir="auto"} functions (e.g.,
`Runtime.runPromise`{dir="auto"}, `Runtime.runFork`{dir="auto"}) are
responsible for taking this blueprint and executing it.

When the runtime system runs an effect, it creates a root fiber,
initializing it with:

- The initial
  [context](../requirements-management/services/index.html#how-it-works)
- The initial `FiberRefs`{dir="auto"}
- The initial effect

It then starts a loop, executing the instructions described by the
`Effect`{dir="auto"} step by step.

You can think of the runtime as a system that takes an
[`Effect<A, E, R>`{dir="auto"}](../getting-started/the-effect-type.html)
and its associated context `Context<R>`{dir="auto"} and produces an
[`Exit<A, E>`{dir="auto"}](../data-types/exit/index.html) result.

::: expressive-code
<figure class="frame not-content">
<pre data-language="text"><code>┌────────────────────────────────┐│  Context&lt;R&gt; + Effect&lt;A, E, R&gt;  │└────────────────────────────────┘               │               ▼┌────────────────────────────────┐│      Effect Runtime System     │└────────────────────────────────┘               │               ▼┌────────────────────────────────┐│          Exit&lt;A, E&gt;            │└────────────────────────────────┘</code></pre>
<div class="copy">
<div>

</div>
</div>
</figure>
:::

Runtime Systems have a lot of responsibilities:

  Responsibility                  Description
  ------------------------------- --------------------------------------------------------------------------------------------------------------------
  **Executing the program**       The runtime must execute every step of the effect in a loop until the program completes.
  **Handling errors**             It handles both expected and unexpected errors that occur during execution.
  **Managing concurrency**        The runtime spawns new fibers when `Effect.fork`{dir="auto"} is called to handle concurrent operations.
  **Cooperative yielding**        It ensures fibers don't monopolize resources, yielding control when necessary.
  **Ensuring resource cleanup**   The runtime guarantees finalizers run properly to clean up resources when needed.
  **Handling async callbacks**    The runtime deals with asynchronous operations transparently, allowing you to write async and sync code uniformly.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## The Default Runtime

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#the-default-runtime){.anchor-link
aria-labelledby="the-default-runtime"}
:::

When we use [functions that run
effects](../getting-started/running-effects/index.html) like
`Effect.runPromise`{dir="auto"} or `Effect.runFork`{dir="auto"}, we are
actually using the **default runtime** without explicitly mentioning it.
These functions are designed as convenient shortcuts for executing our
effects using the default runtime.

Each of the `Effect.run*`{dir="auto"} functions internally calls the
corresponding `Runtime.run*`{dir="auto"} function, passing in the
default runtime. For example, `Effect.runPromise`{dir="auto"} is just an
alias for `Runtime.runPromise(defaultRuntime)`{dir="auto"}.

Both of the following executions are functionally equivalent:

**Example** (Running an Effect Using the Default Runtime)

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
::::::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Runtime</code></pre>
</figure>
:::
::::

[Runtime]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::::::::
::::::::::::

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
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, never, never&gt;</code></pre>
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

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const log: (...message: ReadonlyArray&lt;any&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Logs one or more messages or error causes at the current log level.

**Details**

This function provides a simple way to log messages or error causes
during the execution of your effects. By default, logs are recorded at
the `INFO` level, but this can be adjusted using other logging utilities
(`Logger.withMinimumLogLevel`). Multiple items, including `Cause`
instances, can be logged in a single call. When logging `Cause`
instances, detailed error information is included in the log output.

The log output includes useful metadata like the current timestamp, log
level, and fiber ID, making it suitable for debugging and tracking
purposes. This function does not interrupt or alter the effect\'s
execution flow.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Cause, Effect } from &quot;effect&quot;
const program = Effect.log(  &quot;message1&quot;,  &quot;message2&quot;,  Cause.die(&quot;Oh no!&quot;),  Cause.die(&quot;Oh uh!&quot;))
Effect.runFork(program)// Output:// timestamp=... level=INFO fiber=#0 message=message1 message=message2 cause=&quot;Error: Oh no!// Error: Oh uh!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Application
started!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::: code
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

:::::::::::::: code
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runPromise: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;, options?: {    readonly signal?: AbortSignal | undefined;} | undefined) =&gt; Promise&lt;void&gt;</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Executes an effect and returns the result as a `Promise`.

**Details**

This function runs an effect and converts its result into a `Promise`.
If the effect succeeds, the `Promise` will resolve with the successful
result. If the effect fails, the `Promise` will reject with an error,
which includes the failure details of the effect.

The optional `options` parameter allows you to pass an `AbortSignal` for
cancellation, enabling more fine-grained control over asynchronous
tasks.

**When to Use**

Use this function when you need to execute an effect and work with its
result in a promise-based system, such as when integrating with
third-party libraries that expect `Promise` results.

**Example** (Running a Successful Effect as a Promise)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
Effect.runPromise(Effect.succeed(1)).then(console.log)// Output: 1</code></pre>
</figure>
:::

**Example** (Handling a Failing Effect as a Rejected Promise)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
Effect.runPromise(Effect.fail(&quot;my error&quot;)).catch(console.error)// Output:// (FiberFailure) Error: my error</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [runPromiseExit for a version
that returns an `Exit` type instead of
rejecting.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[runPromise]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[timestamp=\... level=INFO fiber=#0 message=\"Application
started!\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[\*/]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

:::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Runtime</code></pre>
</figure>
:::
::::

[Runtime]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runPromise: &lt;never&gt;(runtime: Runtime.Runtime&lt;never&gt;) =&gt; &lt;A, E&gt;(effect: Effect.Effect&lt;A, E, never&gt;, options?: {    readonly signal?: AbortSignal;} | undefined) =&gt; Promise&lt;A&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Runs the `Effect`, returning a JavaScript `Promise` that will be
resolved with the value of the effect once the effect has been executed,
or will be rejected with the first error or exception throw by the
effect.

This method is effectful and should only be used at the edges of your
program.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[runPromise]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Runtime</code></pre>
</figure>
:::
::::

[Runtime]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const defaultRuntime: Runtime.Runtime&lt;never&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[defaultRuntime]{style="--0:#24292E;--1:#E1E4E8"}[)(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

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
[timestamp=\... level=INFO fiber=#0 message=\"Application
started!\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
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

In both cases, the program runs using the default runtime, producing the
same output.

The default runtime includes:

- An empty
  [context](../requirements-management/services/index.html#how-it-works)
- A set of `FiberRefs`{dir="auto"} that include the [default
  services](../requirements-management/default-services/index.html)
- A default configuration for `RuntimeFlags`{dir="auto"} that enables
  `Interruption`{dir="auto"} and `CooperativeYielding`{dir="auto"}

In most scenarios, using the default runtime is sufficient for effect
execution. However, there are cases where it's helpful to create a
custom runtime, particularly when you need to reuse specific
configurations or contexts.

For example, in a React app or when executing operations on a server in
response to API requests, you might create a `Runtime<R>`{dir="auto"} by
initializing a [layer](../requirements-management/layers/index.html)
`Layer<R, Err, RIn>`{dir="auto"}. This allows you to maintain a
consistent context across different execution boundaries.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Locally Scoped Runtime Configuration

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#locally-scoped-runtime-configuration){.anchor-link
aria-labelledby="locally-scoped-runtime-configuration"}
:::

In Effect, runtime configurations are typically **inherited** from their
parent workflows. This means that when we access a runtime configuration
or obtain a runtime inside a workflow, we are essentially using the
configuration of the parent workflow.

However, there are cases where we want to temporarily **override the
runtime configuration for a specific part** of our code. This concept is
known as locally scoped runtime configuration. Once the execution of
that code region is completed, the runtime configuration **reverts** to
its original settings.

To achieve this, we make use of the `Effect.provide`{dir="auto"}
function, which allow us to provide a new runtime configuration to a
specific section of our code.

**Example** (Overriding the Logger Configuration)

In this example, we create a simple logger using
`Logger.replace`{dir="auto"}, which replaces the default logger with a
custom one that logs messages without timestamps or levels. We then use
`Effect.provide`{dir="auto"} to apply this custom logger to the program.

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Logger</code></pre>
</figure>
:::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[,
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

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

:::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const addSimpleLogger: Layer&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[addSimpleLogger]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const replace: &lt;void, void&gt;(self: Logger.Logger&lt;unknown, void&gt;, that: Logger.Logger&lt;unknown, void&gt;) =&gt; Layer&lt;never&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[replace]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

:::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const defaultLogger: Logger.Logger&lt;unknown, void&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[defaultLogger]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
[ ]{.indent}[// Custom logger
implementation]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::::::::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;unknown, void&gt;(log: (options: Logger.Logger&lt;in Message, out Output&gt;.Options&lt;unknown&gt;) =&gt; void) =&gt; Logger.Logger&lt;unknown, void&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a custom logger that formats log messages according to the
provided function.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Logger, LogLevel } from &quot;effect&quot;
const logger = Logger.make(({ logLevel, message }) =&gt; {  globalThis.console.log(`[${logLevel.label}] ${message}`)})
const task1 = Effect.logDebug(&quot;task1 done&quot;)const task2 = Effect.logDebug(&quot;task2 done&quot;)
const program = Effect.gen(function*() {  yield* Effect.log(&quot;start&quot;)  yield* task1  yield* task2  yield* Effect.log(&quot;done&quot;)}).pipe(  Logger.withMinimumLogLevel(LogLevel.Debug),  Effect.provide(Logger.replace(Logger.defaultLogger, logger)))
Effect.runFork(program)// [INFO] start// [DEBUG] task1 done// [DEBUG] task2 done// [INFO] done</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>message: unknown</code></pre>
</figure>
:::
::::

[message]{style="--0:#AE4B07;--1:#FFAB70"}[ })
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#6F42C1;--1:#B392F0"}

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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>message: unknown</code></pre>
</figure>
:::
::::

[message]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::::::
::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, never, never&gt;</code></pre>
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

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Provides a way to write effectful code using generator functions,
simplifying control flow and error handling.

**When to Use**

`Effect.gen` allows you to write code that looks and behaves like
synchronous code, but it can handle asynchronous tasks, errors, and
complex control flow (like loops and conditions). It helps make
asynchronous code more readable and easier to manage.

The generator functions work similarly to `async/await` but with more
explicit control over the execution of effects. You can `yield*` values
from effects and return the final result at the end.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const addServiceCharge = (amount: number) =&gt; amount + 1
const applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
const fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
const fetchDiscountRate = Effect.promise(() =&gt; Promise.resolve(5))
export const program = Effect.gen(function* () {  const transactionAmount = yield* fetchTransactionAmount  const discountRate = yield* fetchDiscountRate  const discountedAmount = yield* applyDiscount(    transactionAmount,    discountRate  )  const finalAmount = addServiceCharge(discountedAmount)  return `Final amount to charge: ${finalAmount}`})</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[gen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[function\*]{style="--0:#BF3441;--1:#F97583"}[
() {]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const log: (...message: ReadonlyArray&lt;any&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Logs one or more messages or error causes at the current log level.

**Details**

This function provides a simple way to log messages or error causes
during the execution of your effects. By default, logs are recorded at
the `INFO` level, but this can be adjusted using other logging utilities
(`Logger.withMinimumLogLevel`). Multiple items, including `Cause`
instances, can be logged in a single call. When logging `Cause`
instances, detailed error information is included in the log output.

The log output includes useful metadata like the current timestamp, log
level, and fiber ID, making it suitable for debugging and tracking
purposes. This function does not interrupt or alter the effect\'s
execution flow.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Cause, Effect } from &quot;effect&quot;
const program = Effect.log(  &quot;message1&quot;,  &quot;message2&quot;,  Cause.die(&quot;Oh no!&quot;),  Cause.die(&quot;Oh uh!&quot;))
Effect.runFork(program)// Output:// timestamp=... level=INFO fiber=#0 message=message1 message=message2 cause=&quot;Error: Oh no!// Error: Oh uh!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Application
started!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const log: (...message: ReadonlyArray&lt;any&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Logs one or more messages or error causes at the current log level.

**Details**

This function provides a simple way to log messages or error causes
during the execution of your effects. By default, logs are recorded at
the `INFO` level, but this can be adjusted using other logging utilities
(`Logger.withMinimumLogLevel`). Multiple items, including `Cause`
instances, can be logged in a single call. When logging `Cause`
instances, detailed error information is included in the log output.

The log output includes useful metadata like the current timestamp, log
level, and fiber ID, making it suitable for debugging and tracking
purposes. This function does not interrupt or alter the effect\'s
execution flow.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Cause, Effect } from &quot;effect&quot;
const program = Effect.log(  &quot;message1&quot;,  &quot;message2&quot;,  Cause.die(&quot;Oh no!&quot;),  Cause.die(&quot;Oh uh!&quot;))
Effect.runFork(program)// Output:// timestamp=... level=INFO fiber=#0 message=message1 message=message2 cause=&quot;Error: Oh no!// Error: Oh uh!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Application
is about to
exit!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[// Running with the default logger]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::::::::::::: code
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
<pre data-language="ts"><code>const runFork: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;, options?: RunForkOptions) =&gt; RuntimeFiber&lt;void, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Runs an effect in the background, returning a fiber that can be observed
or interrupted.

Unless you specifically need a `Promise` or synchronous operation,
`runFork` is a good default choice.

**Details**

This function is the foundational way to execute an effect in the
background. It creates a \"fiber,\" a lightweight, cooperative thread of
execution that can be observed (to access its result), interrupted, or
joined. Fibers are useful for concurrent programming and allow effects
to run independently of the main program flow.

Once the effect is running in a fiber, you can monitor its progress,
cancel it if necessary, or retrieve its result when it completes. If the
effect fails, the fiber will propagate the failure, which you can
observe and handle.

**When to Use**

Use this function when you need to run an effect in the background,
especially if the effect is long-running or performs periodic tasks.
It\'s suitable for tasks that need to run independently but might still
need observation or management, like logging, monitoring, or scheduled
tasks.

This function is ideal if you don\'t need the result immediately or if
the effect is part of a larger concurrent workflow.

**Example** (Running an Effect in the Background)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console, Schedule, Fiber } from &quot;effect&quot;
//      ┌─── Effect&lt;number, never, never&gt;//      ▼const program = Effect.repeat(  Console.log(&quot;running...&quot;),  Schedule.spaced(&quot;200 millis&quot;))
//      ┌─── RuntimeFiber&lt;number, never&gt;//      ▼const fiber = Effect.runFork(program)
setTimeout(() =&gt; {  Effect.runFork(Fiber.interrupt(fiber))}, 500)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[runFork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[timestamp=\... level=INFO fiber=#0 message=\"Application
started!\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[timestamp=\... level=INFO fiber=#0 message=\"Application is about to
exit!\"]{style="--0:#616972;--1:#99A0A6"}
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

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[// Overriding the default logger with a custom
one]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::::::::::::::::::::::::: code
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
<pre data-language="ts"><code>const runFork: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;, options?: RunForkOptions) =&gt; RuntimeFiber&lt;void, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Runs an effect in the background, returning a fiber that can be observed
or interrupted.

Unless you specifically need a `Promise` or synchronous operation,
`runFork` is a good default choice.

**Details**

This function is the foundational way to execute an effect in the
background. It creates a \"fiber,\" a lightweight, cooperative thread of
execution that can be observed (to access its result), interrupted, or
joined. Fibers are useful for concurrent programming and allow effects
to run independently of the main program flow.

Once the effect is running in a fiber, you can monitor its progress,
cancel it if necessary, or retrieve its result when it completes. If the
effect fails, the fiber will propagate the failure, which you can
observe and handle.

**When to Use**

Use this function when you need to run an effect in the background,
especially if the effect is long-running or performs periodic tasks.
It\'s suitable for tasks that need to run independently but might still
need observation or management, like logging, monitoring, or scheduled
tasks.

This function is ideal if you don\'t need the result immediately or if
the effect is part of a larger concurrent workflow.

**Example** (Running an Effect in the Background)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console, Schedule, Fiber } from &quot;effect&quot;
//      ┌─── Effect&lt;number, never, never&gt;//      ▼const program = Effect.repeat(  Console.log(&quot;running...&quot;),  Schedule.spaced(&quot;200 millis&quot;))
//      ┌─── RuntimeFiber&lt;number, never&gt;//      ▼const fiber = Effect.runFork(program)
setTimeout(() =&gt; {  Effect.runFork(Fiber.interrupt(fiber))}, 500)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[runFork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;void, never, never&gt;, ab: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
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
<pre data-language="ts"><code>const provide: &lt;never, never, never&gt;(layer: Layer&lt;never, never, never&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, never&gt;&gt; (+9 overloads)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Provides necessary dependencies to an effect, removing its environmental
requirements.

**Details**

This function allows you to supply the required environment for an
effect. The environment can be provided in the form of one or more
`Layer`s, a `Context`, a `Runtime`, or a `ManagedRuntime`. Once the
environment is provided, the effect can run without requiring external
dependencies.

You can compose layers to create a modular and reusable way of setting
up the environment for effects. For example, layers can be used to
configure databases, logging services, or any other required
dependencies.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Context, Effect, Layer } from &quot;effect&quot;
class Database extends Context.Tag(&quot;Database&quot;)&lt;  Database,  { readonly query: (sql: string) =&gt; Effect.Effect&lt;Array&lt;unknown&gt;&gt; }&gt;() {}
const DatabaseLive = Layer.succeed(  Database,  {    // Simulate a database query    query: (sql: string) =&gt; Effect.log(`Executing query: ${sql}`).pipe(Effect.as([]))  })
//      ┌─── Effect&lt;unknown[], never, Database&gt;//      ▼const program = Effect.gen(function*() {  const database = yield* Database  const result = yield* database.query(&quot;SELECT * FROM users&quot;)  return result})
//      ┌─── Effect&lt;unknown[], never, never&gt;//      ▼const runnable = Effect.provide(program, DatabaseLive)
Effect.runPromise(runnable).then(console.log)// Output:// timestamp=... level=INFO fiber=#0 message=&quot;Executing query: SELECT * FROM users&quot;// []</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [provideService for providing a
service to an effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[provide]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const addSimpleLogger: Layer&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[addSimpleLogger]{style="--0:#24292E;--1:#E1E4E8"}[)))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::::::
::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::: code
[\[ \'Application started!\' \]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
[\[ \'Application is about to exit!\'
\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
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

To ensure that the runtime configuration is only applied to a specific
part of an Effect application, we should provide the configuration layer
exclusively to that particular section.

**Example** (Providing a configuration layer to a nested workflow)

In this example, we demonstrate how to apply a custom logger
configuration only to a specific section of the program. The default
logger is used for most of the program, but when we apply the
`Effect.provide(addSimpleLogger)`{dir="auto"} call, it overrides the
logger within that specific nested block. After that, the configuration
reverts to its original state.

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Logger</code></pre>
</figure>
:::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[,
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

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

:::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const addSimpleLogger: Layer&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[addSimpleLogger]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const replace: &lt;void, void&gt;(self: Logger.Logger&lt;unknown, void&gt;, that: Logger.Logger&lt;unknown, void&gt;) =&gt; Layer&lt;never&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[replace]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

:::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const defaultLogger: Logger.Logger&lt;unknown, void&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[defaultLogger]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
[ ]{.indent}[// Custom logger
implementation]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::::::::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;unknown, void&gt;(log: (options: Logger.Logger&lt;in Message, out Output&gt;.Options&lt;unknown&gt;) =&gt; void) =&gt; Logger.Logger&lt;unknown, void&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a custom logger that formats log messages according to the
provided function.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Logger, LogLevel } from &quot;effect&quot;
const logger = Logger.make(({ logLevel, message }) =&gt; {  globalThis.console.log(`[${logLevel.label}] ${message}`)})
const task1 = Effect.logDebug(&quot;task1 done&quot;)const task2 = Effect.logDebug(&quot;task2 done&quot;)
const program = Effect.gen(function*() {  yield* Effect.log(&quot;start&quot;)  yield* task1  yield* task2  yield* Effect.log(&quot;done&quot;)}).pipe(  Logger.withMinimumLogLevel(LogLevel.Debug),  Effect.provide(Logger.replace(Logger.defaultLogger, logger)))
Effect.runFork(program)// [INFO] start// [DEBUG] task1 done// [DEBUG] task2 done// [INFO] done</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>message: unknown</code></pre>
</figure>
:::
::::

[message]{style="--0:#AE4B07;--1:#FFAB70"}[ })
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#6F42C1;--1:#B392F0"}

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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>message: unknown</code></pre>
</figure>
:::
::::

[message]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::::::
::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
:::
::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const removeDefaultLogger: Layer&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[removeDefaultLogger]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const remove: &lt;void&gt;(logger: Logger.Logger&lt;unknown, void&gt;) =&gt; Layer&lt;never&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[remove]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const defaultLogger: Logger.Logger&lt;unknown, void&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[defaultLogger]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
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
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, never, never&gt;</code></pre>
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

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Provides a way to write effectful code using generator functions,
simplifying control flow and error handling.

**When to Use**

`Effect.gen` allows you to write code that looks and behaves like
synchronous code, but it can handle asynchronous tasks, errors, and
complex control flow (like loops and conditions). It helps make
asynchronous code more readable and easier to manage.

The generator functions work similarly to `async/await` but with more
explicit control over the execution of effects. You can `yield*` values
from effects and return the final result at the end.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const addServiceCharge = (amount: number) =&gt; amount + 1
const applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
const fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
const fetchDiscountRate = Effect.promise(() =&gt; Promise.resolve(5))
export const program = Effect.gen(function* () {  const transactionAmount = yield* fetchTransactionAmount  const discountRate = yield* fetchDiscountRate  const discountedAmount = yield* applyDiscount(    transactionAmount,    discountRate  )  const finalAmount = addServiceCharge(discountedAmount)  return `Final amount to charge: ${finalAmount}`})</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[gen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[function\*]{style="--0:#BF3441;--1:#F97583"}[
() {]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[ ]{.indent}[// Logs with default
logger]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const log: (...message: ReadonlyArray&lt;any&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Logs one or more messages or error causes at the current log level.

**Details**

This function provides a simple way to log messages or error causes
during the execution of your effects. By default, logs are recorded at
the `INFO` level, but this can be adjusted using other logging utilities
(`Logger.withMinimumLogLevel`). Multiple items, including `Cause`
instances, can be logged in a single call. When logging `Cause`
instances, detailed error information is included in the log output.

The log output includes useful metadata like the current timestamp, log
level, and fiber ID, making it suitable for debugging and tracking
purposes. This function does not interrupt or alter the effect\'s
execution flow.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Cause, Effect } from &quot;effect&quot;
const program = Effect.log(  &quot;message1&quot;,  &quot;message2&quot;,  Cause.die(&quot;Oh no!&quot;),  Cause.die(&quot;Oh uh!&quot;))
Effect.runFork(program)// Output:// timestamp=... level=INFO fiber=#0 message=message1 message=message2 cause=&quot;Error: Oh no!// Error: Oh uh!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Application
started!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Provides a way to write effectful code using generator functions,
simplifying control flow and error handling.

**When to Use**

`Effect.gen` allows you to write code that looks and behaves like
synchronous code, but it can handle asynchronous tasks, errors, and
complex control flow (like loops and conditions). It helps make
asynchronous code more readable and easier to manage.

The generator functions work similarly to `async/await` but with more
explicit control over the execution of effects. You can `yield*` values
from effects and return the final result at the end.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const addServiceCharge = (amount: number) =&gt; amount + 1
const applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
const fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
const fetchDiscountRate = Effect.promise(() =&gt; Promise.resolve(5))
export const program = Effect.gen(function* () {  const transactionAmount = yield* fetchTransactionAmount  const discountRate = yield* fetchDiscountRate  const discountedAmount = yield* applyDiscount(    transactionAmount,    discountRate  )  const finalAmount = addServiceCharge(discountedAmount)  return `Final amount to charge: ${finalAmount}`})</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[gen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[function\*]{style="--0:#BF3441;--1:#F97583"}[
() {]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[ ]{.indent}[// This log is suppressed]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const log: (...message: ReadonlyArray&lt;any&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Logs one or more messages or error causes at the current log level.

**Details**

This function provides a simple way to log messages or error causes
during the execution of your effects. By default, logs are recorded at
the `INFO` level, but this can be adjusted using other logging utilities
(`Logger.withMinimumLogLevel`). Multiple items, including `Cause`
instances, can be logged in a single call. When logging `Cause`
instances, detailed error information is included in the log output.

The log output includes useful metadata like the current timestamp, log
level, and fiber ID, making it suitable for debugging and tracking
purposes. This function does not interrupt or alter the effect\'s
execution flow.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Cause, Effect } from &quot;effect&quot;
const program = Effect.log(  &quot;message1&quot;,  &quot;message2&quot;,  Cause.die(&quot;Oh no!&quot;),  Cause.die(&quot;Oh uh!&quot;))
Effect.runFork(program)// Output:// timestamp=... level=INFO fiber=#0 message=message1 message=message2 cause=&quot;Error: Oh no!// Error: Oh uh!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"I\'m
not going to be
logged!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[ ]{.indent}[// Custom logger applied
here]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const log: (...message: ReadonlyArray&lt;any&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Logs one or more messages or error causes at the current log level.

**Details**

This function provides a simple way to log messages or error causes
during the execution of your effects. By default, logs are recorded at
the `INFO` level, but this can be adjusted using other logging utilities
(`Logger.withMinimumLogLevel`). Multiple items, including `Cause`
instances, can be logged in a single call. When logging `Cause`
instances, detailed error information is included in the log output.

The log output includes useful metadata like the current timestamp, log
level, and fiber ID, making it suitable for debugging and tracking
purposes. This function does not interrupt or alter the effect\'s
execution flow.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Cause, Effect } from &quot;effect&quot;
const program = Effect.log(  &quot;message1&quot;,  &quot;message2&quot;,  Cause.die(&quot;Oh no!&quot;),  Cause.die(&quot;Oh uh!&quot;))
Effect.runFork(program)// Output:// timestamp=... level=INFO fiber=#0 message=message1 message=message2 cause=&quot;Error: Oh no!// Error: Oh uh!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"I
will be logged by the simple
logger.\"]{style="--0:#032F62;--1:#9ECBFF"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;void, never, never&gt;, ab: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const provide: &lt;never, never, never&gt;(layer: Layer&lt;never, never, never&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, never&gt;&gt; (+9 overloads)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Provides necessary dependencies to an effect, removing its environmental
requirements.

**Details**

This function allows you to supply the required environment for an
effect. The environment can be provided in the form of one or more
`Layer`s, a `Context`, a `Runtime`, or a `ManagedRuntime`. Once the
environment is provided, the effect can run without requiring external
dependencies.

You can compose layers to create a modular and reusable way of setting
up the environment for effects. For example, layers can be used to
configure databases, logging services, or any other required
dependencies.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Context, Effect, Layer } from &quot;effect&quot;
class Database extends Context.Tag(&quot;Database&quot;)&lt;  Database,  { readonly query: (sql: string) =&gt; Effect.Effect&lt;Array&lt;unknown&gt;&gt; }&gt;() {}
const DatabaseLive = Layer.succeed(  Database,  {    // Simulate a database query    query: (sql: string) =&gt; Effect.log(`Executing query: ${sql}`).pipe(Effect.as([]))  })
//      ┌─── Effect&lt;unknown[], never, Database&gt;//      ▼const program = Effect.gen(function*() {  const database = yield* Database  const result = yield* database.query(&quot;SELECT * FROM users&quot;)  return result})
//      ┌─── Effect&lt;unknown[], never, never&gt;//      ▼const runnable = Effect.provide(program, DatabaseLive)
Effect.runPromise(runnable).then(console.log)// Output:// timestamp=... level=INFO fiber=#0 message=&quot;Executing query: SELECT * FROM users&quot;// []</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [provideService for providing a
service to an effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[provide]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const addSimpleLogger: Layer&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[addSimpleLogger]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[ ]{.indent}[// This log is suppressed]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const log: (...message: ReadonlyArray&lt;any&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Logs one or more messages or error causes at the current log level.

**Details**

This function provides a simple way to log messages or error causes
during the execution of your effects. By default, logs are recorded at
the `INFO` level, but this can be adjusted using other logging utilities
(`Logger.withMinimumLogLevel`). Multiple items, including `Cause`
instances, can be logged in a single call. When logging `Cause`
instances, detailed error information is included in the log output.

The log output includes useful metadata like the current timestamp, log
level, and fiber ID, making it suitable for debugging and tracking
purposes. This function does not interrupt or alter the effect\'s
execution flow.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Cause, Effect } from &quot;effect&quot;
const program = Effect.log(  &quot;message1&quot;,  &quot;message2&quot;,  Cause.die(&quot;Oh no!&quot;),  Cause.die(&quot;Oh uh!&quot;))
Effect.runFork(program)// Output:// timestamp=... level=INFO fiber=#0 message=message1 message=message2 cause=&quot;Error: Oh no!// Error: Oh uh!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::: code
[ ]{.indent}[\"Reset back to the previous configuration, so I won\'t be
logged.\"]{style="--0:#032F62;--1:#9ECBFF"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;void, never, never&gt;, ab: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
[ ]{.indent}[// Remove the default logger
temporarily]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
:::
::::

::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const provide: &lt;never, never, never&gt;(layer: Layer&lt;never, never, never&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, never&gt;&gt; (+9 overloads)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Provides necessary dependencies to an effect, removing its environmental
requirements.

**Details**

This function allows you to supply the required environment for an
effect. The environment can be provided in the form of one or more
`Layer`s, a `Context`, a `Runtime`, or a `ManagedRuntime`. Once the
environment is provided, the effect can run without requiring external
dependencies.

You can compose layers to create a modular and reusable way of setting
up the environment for effects. For example, layers can be used to
configure databases, logging services, or any other required
dependencies.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Context, Effect, Layer } from &quot;effect&quot;
class Database extends Context.Tag(&quot;Database&quot;)&lt;  Database,  { readonly query: (sql: string) =&gt; Effect.Effect&lt;Array&lt;unknown&gt;&gt; }&gt;() {}
const DatabaseLive = Layer.succeed(  Database,  {    // Simulate a database query    query: (sql: string) =&gt; Effect.log(`Executing query: ${sql}`).pipe(Effect.as([]))  })
//      ┌─── Effect&lt;unknown[], never, Database&gt;//      ▼const program = Effect.gen(function*() {  const database = yield* Database  const result = yield* database.query(&quot;SELECT * FROM users&quot;)  return result})
//      ┌─── Effect&lt;unknown[], never, never&gt;//      ▼const runnable = Effect.provide(program, DatabaseLive)
Effect.runPromise(runnable).then(console.log)// Output:// timestamp=... level=INFO fiber=#0 message=&quot;Executing query: SELECT * FROM users&quot;// []</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [provideService for providing a
service to an effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[provide]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const removeDefaultLogger: Layer&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[removeDefaultLogger]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
:::
::::

::: code
[ ]{.indent}[// Logs with default logger
again]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
:::
::::

::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const log: (...message: ReadonlyArray&lt;any&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Logs one or more messages or error causes at the current log level.

**Details**

This function provides a simple way to log messages or error causes
during the execution of your effects. By default, logs are recorded at
the `INFO` level, but this can be adjusted using other logging utilities
(`Logger.withMinimumLogLevel`). Multiple items, including `Cause`
instances, can be logged in a single call. When logging `Cause`
instances, detailed error information is included in the log output.

The log output includes useful metadata like the current timestamp, log
level, and fiber ID, making it suitable for debugging and tracking
purposes. This function does not interrupt or alter the effect\'s
execution flow.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Cause, Effect } from &quot;effect&quot;
const program = Effect.log(  &quot;message1&quot;,  &quot;message2&quot;,  Cause.die(&quot;Oh no!&quot;),  Cause.die(&quot;Oh uh!&quot;))
Effect.runFork(program)// Output:// timestamp=... level=INFO fiber=#0 message=message1 message=message2 cause=&quot;Error: Oh no!// Error: Oh uh!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Application
is about to
exit!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

::: code
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
:::
::::

:::::::::::::: code
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runSync: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;) =&gt; void</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Executes an effect synchronously, running it immediately and returning
the result.

**Details**

This function evaluates the provided effect synchronously, returning its
result directly. It is ideal for effects that do not fail or include
asynchronous operations. If the effect does fail or involves async
tasks, it will throw an error. Execution stops at the point of failure
or asynchronous operation, making it unsuitable for effects that require
asynchronous handling.

**Important**: Attempting to run effects that involve asynchronous
operations or failures will result in exceptions being thrown, so use
this function with care for purely synchronous and error-free effects.

**When to Use**

Use this function when:

- You are sure that the effect will not fail or involve asynchronous
  operations.
- You need a direct, synchronous result from the effect.
- You are working within a context where asynchronous effects are not
  allowed.

Avoid using this function for effects that can fail or require
asynchronous handling. For such cases, consider using

runPromise

or

runSyncExit

.

**Example** (Synchronous Logging)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.sync(() =&gt; {  console.log(&quot;Hello, World!&quot;)  return 1})
const result = Effect.runSync(program)// Output: Hello, World!
console.log(result)// Output: 1</code></pre>
</figure>
:::

**Example** (Incorrect Usage with Failing or Async Effects)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
try {  // Attempt to run an effect that fails  Effect.runSync(Effect.fail(&quot;my error&quot;))} catch (e) {  console.error(e)}// Output:// (FiberFailure) Error: my error
try {  // Attempt to run an effect that involves async work  Effect.runSync(Effect.promise(() =&gt; Promise.resolve(1)))} catch (e) {  console.error(e)}// Output:// (FiberFailure) AsyncFiberException: Fiber #0 cannot be resolved synchronously. This is caused by using runSync on an effect that performs async work</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [runSyncExit for a version that
returns an `Exit` type instead of throwing an
error.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[runSync]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
:::
::::

::: code
[timestamp=\... level=INFO fiber=#0 message=\"Application
started!\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
41
:::
::::

::: code
[\[ \'I will be logged by the simple logger.\'
\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
:::
::::

::: code
[timestamp=\... level=INFO fiber=#0 message=\"Application is about to
exit!\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
43
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
## ManagedRuntime

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#managedruntime){.anchor-link
aria-labelledby="managedruntime"}
:::

When developing an Effect application and using
`Effect.run*`{dir="auto"} functions to execute it, the application is
automatically run using the default runtime behind the scenes. While
it's possible to adjust specific parts of the application by providing
locally scoped configuration layers using `Effect.provide`{dir="auto"},
there are scenarios where you might want to **customize the runtime
configuration for the entire application** from the top level.

In these cases, you can create a top-level runtime by converting a
configuration layer into a runtime using the
`ManagedRuntime.make`{dir="auto"} constructor.

**Example** (Creating and Using a Custom Managed Runtime)

In this example, we first create a custom configuration layer called
`appLayer`{dir="auto"}, which replaces the default logger with a simple
one that logs messages to the console. Next, we use
`ManagedRuntime.make`{dir="auto"} to turn this configuration layer into
a runtime.

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

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import ManagedRuntime</code></pre>
</figure>
:::
::::

[ManagedRuntime]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Define a configuration layer that replaces the default
logger]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

:::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const appLayer: Layer&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[appLayer]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const replace: &lt;void, void&gt;(self: Logger.Logger&lt;unknown, void&gt;, that: Logger.Logger&lt;unknown, void&gt;) =&gt; Layer&lt;never&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[replace]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

:::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const defaultLogger: Logger.Logger&lt;unknown, void&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[defaultLogger]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[ ]{.indent}[// Custom logger
implementation]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::::::::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Logger</code></pre>
</figure>
:::
::::

[Logger]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;unknown, void&gt;(log: (options: Logger.Logger&lt;in Message, out Output&gt;.Options&lt;unknown&gt;) =&gt; void) =&gt; Logger.Logger&lt;unknown, void&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a custom logger that formats log messages according to the
provided function.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Logger, LogLevel } from &quot;effect&quot;
const logger = Logger.make(({ logLevel, message }) =&gt; {  globalThis.console.log(`[${logLevel.label}] ${message}`)})
const task1 = Effect.logDebug(&quot;task1 done&quot;)const task2 = Effect.logDebug(&quot;task2 done&quot;)
const program = Effect.gen(function*() {  yield* Effect.log(&quot;start&quot;)  yield* task1  yield* task2  yield* Effect.log(&quot;done&quot;)}).pipe(  Logger.withMinimumLogLevel(LogLevel.Debug),  Effect.provide(Logger.replace(Logger.defaultLogger, logger)))
Effect.runFork(program)// [INFO] start// [DEBUG] task1 done// [DEBUG] task2 done// [INFO] done</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>message: unknown</code></pre>
</figure>
:::
::::

[message]{style="--0:#AE4B07;--1:#FFAB70"}[ })
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#6F42C1;--1:#B392F0"}

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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>message: unknown</code></pre>
</figure>
:::
::::

[message]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::::::
::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[// Create a custom runtime from the configuration
layer]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

:::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runtime: ManagedRuntime.ManagedRuntime&lt;never, never&gt;</code></pre>
</figure>
:::
::::

[runtime]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import ManagedRuntime</code></pre>
</figure>
:::
::::

[ManagedRuntime]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;never, never&gt;(layer: Layer&lt;never, never, never&gt;, memoMap?: MemoMap | undefined) =&gt; ManagedRuntime.ManagedRuntime&lt;never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Convert a Layer into an ManagedRuntime, that can be used to run
Effect\'s using your services.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Console, Effect, Layer, ManagedRuntime } from &quot;effect&quot;
class Notifications extends Effect.Tag(&quot;Notifications&quot;)&lt;  Notifications,  { readonly notify: (message: string) =&gt; Effect.Effect&lt;void&gt; }&gt;() {  static Live = Layer.succeed(this, { notify: (message) =&gt; Console.log(message) })}
async function main() {  const runtime = ManagedRuntime.make(Notifications.Live)  await runtime.runPromise(Notifications.notify(&quot;Hello, world!&quot;))  await runtime.dispose()}
main()</code></pre>
</figure>
:::
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const appLayer: Layer&lt;never, never, never&gt;</code></pre>
</figure>
:::
::::

[appLayer]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
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
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, never, never&gt;</code></pre>
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

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const log: (...message: ReadonlyArray&lt;any&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Logs one or more messages or error causes at the current log level.

**Details**

This function provides a simple way to log messages or error causes
during the execution of your effects. By default, logs are recorded at
the `INFO` level, but this can be adjusted using other logging utilities
(`Logger.withMinimumLogLevel`). Multiple items, including `Cause`
instances, can be logged in a single call. When logging `Cause`
instances, detailed error information is included in the log output.

The log output includes useful metadata like the current timestamp, log
level, and fiber ID, making it suitable for debugging and tracking
purposes. This function does not interrupt or alter the effect\'s
execution flow.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Cause, Effect } from &quot;effect&quot;
const program = Effect.log(  &quot;message1&quot;,  &quot;message2&quot;,  Cause.die(&quot;Oh no!&quot;),  Cause.die(&quot;Oh uh!&quot;))
Effect.runFork(program)// Output:// timestamp=... level=INFO fiber=#0 message=message1 message=message2 cause=&quot;Error: Oh no!// Error: Oh uh!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Application
started!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[// Execute the program using the custom
runtime]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

:::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runtime: ManagedRuntime.ManagedRuntime&lt;never, never&gt;</code></pre>
</figure>
:::
::::

[runtime]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>ManagedRuntime&lt;never, never&gt;.runSync: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;) =&gt; void</code></pre>
</figure>
:::

::: twoslash-popup-docs
Executes the effect synchronously throwing in case of errors or async
boundaries.

This method is effectful and should only be invoked at the edges of your
program.
:::
:::::

[runSync]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[// Clean up resources associated with the custom
runtime]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

:::::::::::::::: code
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
<pre data-language="ts"><code>const runFork: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;, options?: RunForkOptions) =&gt; RuntimeFiber&lt;void, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Runs an effect in the background, returning a fiber that can be observed
or interrupted.

Unless you specifically need a `Promise` or synchronous operation,
`runFork` is a good default choice.

**Details**

This function is the foundational way to execute an effect in the
background. It creates a \"fiber,\" a lightweight, cooperative thread of
execution that can be observed (to access its result), interrupted, or
joined. Fibers are useful for concurrent programming and allow effects
to run independently of the main program flow.

Once the effect is running in a fiber, you can monitor its progress,
cancel it if necessary, or retrieve its result when it completes. If the
effect fails, the fiber will propagate the failure, which you can
observe and handle.

**When to Use**

Use this function when you need to run an effect in the background,
especially if the effect is long-running or performs periodic tasks.
It\'s suitable for tasks that need to run independently but might still
need observation or management, like logging, monitoring, or scheduled
tasks.

This function is ideal if you don\'t need the result immediately or if
the effect is part of a larger concurrent workflow.

**Example** (Running an Effect in the Background)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console, Schedule, Fiber } from &quot;effect&quot;
//      ┌─── Effect&lt;number, never, never&gt;//      ▼const program = Effect.repeat(  Console.log(&quot;running...&quot;),  Schedule.spaced(&quot;200 millis&quot;))
//      ┌─── RuntimeFiber&lt;number, never&gt;//      ▼const fiber = Effect.runFork(program)
setTimeout(() =&gt; {  Effect.runFork(Fiber.interrupt(fiber))}, 500)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[runFork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runtime: ManagedRuntime.ManagedRuntime&lt;never, never&gt;</code></pre>
</figure>
:::
::::

[runtime]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>ManagedRuntime&lt;never, never&gt;.disposeEffect: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Dispose of the resources associated with the runtime.
:::
:::::

[disposeEffect]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[\[ \'Application started!\' \]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
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
### Effect.Tag {#effecttag}

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#effecttag){.anchor-link
aria-labelledby="effecttag"}
:::

When working with runtimes that you pass around,
`Effect.Tag`{dir="auto"} can help simplify the access to services. It
lets you define a new tag and embed the service shape directly into the
static properties of the tag class.

**Example** (Defining a Tag for Notifications)

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
[class]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Notifications</code></pre>
</figure>
:::
::::

[Notifications]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[extends]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const Tag: &lt;&quot;Notifications&quot;&gt;(id: &quot;Notifications&quot;) =&gt; &lt;Self, Type&gt;() =&gt; TagClass&lt;Self, &quot;Notifications&quot;, Type&gt; &amp; (Type extends Record&lt;PropertyKey, any&gt; ? Effect.Tag.Proxy&lt;Self, Type&gt; : {}) &amp; {    use: &lt;X&gt;(body: (_: Type) =&gt; X) =&gt; [X] extends [Effect.Effect&lt;infer A, infer E, infer R&gt;] ? Effect.Effect&lt;A, E, Self | R&gt; : [X] extends [PromiseLike&lt;infer A&gt;] ? Effect.Effect&lt;A, UnknownException, Self&gt; : Effect.Effect&lt;...&gt;;}</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a unique tag for a dependency, embedding the service\'s methods
as static properties.

**Details**

This function allows you to define a `Tag` for a service or dependency
in your application. The `Tag` not only acts as an identifier but also
provides direct access to the service\'s methods via static properties.
This makes it easier to access and use the service in your code without
manually managing contexts.

In the example below, the fields of the service (in this case, the
`notify` method) are turned into static properties of the Notifications
class, making it easier to access them.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
class Notifications extends Effect.Tag(&quot;Notifications&quot;)&lt;  Notifications,  { readonly notify: (message: string) =&gt; Effect.Effect&lt;void&gt; }&gt;() {}
// Create an effect that depends on the Notifications serviceconst action = Notifications.notify(&quot;Hello, world!&quot;)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[Tag]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Notifications\"]{style="--0:#032F62;--1:#9ECBFF"}[)\<]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Notifications</code></pre>
</figure>
:::
::::

[Notifications]{style="--0:#6F42C1;--1:#B392F0"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

:::::::::::::: code
[[ ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[{
]{style="--0:#24292E;--1:#E1E4E8"}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>notify: (message: string) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::
::::

[notify]{style="--0:#6F42C1;--1:#B392F0"}[:]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>message: string</code></pre>
</figure>
:::
::::

[message]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

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

[Effect]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Effect&lt;out A, out E = never, out R = never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
The `Effect` interface defines a value that describes a workflow or job,
which can succeed or fail.

**Details**

The `Effect` interface represents a computation that can model a
workflow involving various types of operations, such as synchronous,
asynchronous, concurrent, and parallel interactions. It operates within
a context of type `R`, and the result can either be a success with a
value of type `A` or a failure with an error of type `E`. The `Effect`
is designed to handle complex interactions with external resources,
offering advanced features such as fiber-based concurrency, scheduling,
interruption handling, and scalability. This makes it suitable for tasks
that require fine-grained control over concurrency and error management.

To execute an `Effect` value, you need a `Runtime`, which provides the
environment necessary to run and manage the computation.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Effect]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[void]{style="--0:#005CC5;--1:#79B8FF"}[\>
}]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[\>() {}]{style="--0:#24292E;--1:#E1E4E8"}
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

In this setup, the fields of the service (in this case, the
`notify`{dir="auto"} method) are turned into static properties of the
`Notifications`{dir="auto"} class, making it easier to access them.

This allows you to interact with the service directly:

**Example** (Using the Notifications Tag)

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
[class]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Notifications</code></pre>
</figure>
:::
::::

[Notifications]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[extends]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const Tag: &lt;&quot;Notifications&quot;&gt;(id: &quot;Notifications&quot;) =&gt; &lt;Self, Type&gt;() =&gt; TagClass&lt;Self, &quot;Notifications&quot;, Type&gt; &amp; (Type extends Record&lt;PropertyKey, any&gt; ? Effect.Tag.Proxy&lt;Self, Type&gt; : {}) &amp; {    use: &lt;X&gt;(body: (_: Type) =&gt; X) =&gt; [X] extends [Effect.Effect&lt;infer A, infer E, infer R&gt;] ? Effect.Effect&lt;A, E, Self | R&gt; : [X] extends [PromiseLike&lt;infer A&gt;] ? Effect.Effect&lt;A, UnknownException, Self&gt; : Effect.Effect&lt;...&gt;;}</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a unique tag for a dependency, embedding the service\'s methods
as static properties.

**Details**

This function allows you to define a `Tag` for a service or dependency
in your application. The `Tag` not only acts as an identifier but also
provides direct access to the service\'s methods via static properties.
This makes it easier to access and use the service in your code without
manually managing contexts.

In the example below, the fields of the service (in this case, the
`notify` method) are turned into static properties of the Notifications
class, making it easier to access them.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
class Notifications extends Effect.Tag(&quot;Notifications&quot;)&lt;  Notifications,  { readonly notify: (message: string) =&gt; Effect.Effect&lt;void&gt; }&gt;() {}
// Create an effect that depends on the Notifications serviceconst action = Notifications.notify(&quot;Hello, world!&quot;)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[Tag]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Notifications\"]{style="--0:#032F62;--1:#9ECBFF"}[)\<]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Notifications</code></pre>
</figure>
:::
::::

[Notifications]{style="--0:#6F42C1;--1:#B392F0"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

:::::::::::::: code
[[ ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[{
]{style="--0:#24292E;--1:#E1E4E8"}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>notify: (message: string) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::
::::

[notify]{style="--0:#6F42C1;--1:#B392F0"}[:]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>message: string</code></pre>
</figure>
:::
::::

[message]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

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

[Effect]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Effect&lt;out A, out E = never, out R = never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
The `Effect` interface defines a value that describes a workflow or job,
which can succeed or fail.

**Details**

The `Effect` interface represents a computation that can model a
workflow involving various types of operations, such as synchronous,
asynchronous, concurrent, and parallel interactions. It operates within
a context of type `R`, and the result can either be a success with a
value of type `A` or a failure with an error of type `E`. The `Effect`
is designed to handle complex interactions with external resources,
offering advanced features such as fiber-based concurrency, scheduling,
interruption handling, and scalability. This makes it suitable for tasks
that require fine-grained control over concurrency and error management.

To execute an `Effect` value, you need a `Runtime`, which provides the
environment necessary to run and manage the computation.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Effect]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[void]{style="--0:#005CC5;--1:#79B8FF"}[\>
}]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[\>() {}]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[// Create an effect that depends on the Notifications
service]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[//]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[// ┌─── Effect\<void, never,
Notifications\>]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[// ▼]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const action: Effect.Effect&lt;void, never, Notifications&gt;</code></pre>
</figure>
:::
::::

[action]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Notifications</code></pre>
</figure>
:::
::::

[Notifications]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>notify: (message: string) =&gt; Effect.Effect&lt;void, never, Notifications&gt;</code></pre>
</figure>
:::
::::

[notify]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Hello,
world!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

In this example, the `action`{dir="auto"} effect depends on the
`Notifications`{dir="auto"} service. This approach allows you to
reference services without manually passing them around. Later, you can
create a `Layer`{dir="auto"} that provides the
`Notifications`{dir="auto"} service and build a
`ManagedRuntime`{dir="auto"} with that layer to ensure the service is
available where needed.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Integrations

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#integrations){.anchor-link
aria-labelledby="integrations"}
:::

The `ManagedRuntime`{dir="auto"} simplifies the integration of services
and layers with other frameworks or tools, particularly in environments
where Effect is not the primary framework and access to the main entry
point is restricted.

For example, in environments like React or other frameworks where you
have limited control over the main application entry point,
`ManagedRuntime`{dir="auto"} helps manage the lifecycle of services.

Here's how to manage a service's lifecycle within an external framework:

**Example** (Using `ManagedRuntime`{dir="auto"} in an External
Framework)

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

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import ManagedRuntime</code></pre>
</figure>
:::
::::

[ManagedRuntime]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Layer</code></pre>
</figure>
:::
::::

[Layer]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Console</code></pre>
</figure>
:::
::::

[Console]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Define the Notifications service using
Effect.Tag]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::::::::::: code
[class]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Notifications</code></pre>
</figure>
:::
::::

[Notifications]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[extends]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const Tag: &lt;&quot;Notifications&quot;&gt;(id: &quot;Notifications&quot;) =&gt; &lt;Self, Type&gt;() =&gt; TagClass&lt;Self, &quot;Notifications&quot;, Type&gt; &amp; (Type extends Record&lt;PropertyKey, any&gt; ? Effect.Tag.Proxy&lt;Self, Type&gt; : {}) &amp; {    use: &lt;X&gt;(body: (_: Type) =&gt; X) =&gt; [X] extends [Effect.Effect&lt;infer A, infer E, infer R&gt;] ? Effect.Effect&lt;A, E, Self | R&gt; : [X] extends [PromiseLike&lt;infer A&gt;] ? Effect.Effect&lt;A, UnknownException, Self&gt; : Effect.Effect&lt;...&gt;;}</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a unique tag for a dependency, embedding the service\'s methods
as static properties.

**Details**

This function allows you to define a `Tag` for a service or dependency
in your application. The `Tag` not only acts as an identifier but also
provides direct access to the service\'s methods via static properties.
This makes it easier to access and use the service in your code without
manually managing contexts.

In the example below, the fields of the service (in this case, the
`notify` method) are turned into static properties of the Notifications
class, making it easier to access them.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
class Notifications extends Effect.Tag(&quot;Notifications&quot;)&lt;  Notifications,  { readonly notify: (message: string) =&gt; Effect.Effect&lt;void&gt; }&gt;() {}
// Create an effect that depends on the Notifications serviceconst action = Notifications.notify(&quot;Hello, world!&quot;)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[Tag]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Notifications\"]{style="--0:#032F62;--1:#9ECBFF"}[)\<]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Notifications</code></pre>
</figure>
:::
::::

[Notifications]{style="--0:#6F42C1;--1:#B392F0"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

:::::::::::::: code
[[ ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[{
]{style="--0:#24292E;--1:#E1E4E8"}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>notify: (message: string) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::
::::

[notify]{style="--0:#6F42C1;--1:#B392F0"}[:]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>message: string</code></pre>
</figure>
:::
::::

[message]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

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

[Effect]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Effect&lt;out A, out E = never, out R = never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
The `Effect` interface defines a value that describes a workflow or job,
which can succeed or fail.

**Details**

The `Effect` interface represents a computation that can model a
workflow involving various types of operations, such as synchronous,
asynchronous, concurrent, and parallel interactions. It operates within
a context of type `R`, and the result can either be a success with a
value of type `A` or a failure with an error of type `E`. The `Effect`
is designed to handle complex interactions with external resources,
offering advanced features such as fiber-based concurrency, scheduling,
interruption handling, and scalability. This makes it suitable for tasks
that require fine-grained control over concurrency and error management.

To execute an `Effect` value, you need a `Runtime`, which provides the
environment necessary to run and manage the computation.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Effect]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[void]{style="--0:#005CC5;--1:#79B8FF"}[\>
}]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[\>() {]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[ ]{.indent}[// Provide a live implementation of the Notifications
service]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::::::: code
[ ]{.indent}[static]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Notifications.Live: Layer.Layer&lt;Notifications, never, never&gt;</code></pre>
</figure>
:::
::::

[Live]{style="--0:#AE4B07;--1:#FFAB70"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Layer</code></pre>
</figure>
:::
::::

[Layer]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const succeed: &lt;Notifications, {    readonly notify: (message: string) =&gt; Effect.Effect&lt;void&gt;;}&gt;(tag: Tag&lt;Notifications, {    readonly notify: (message: string) =&gt; Effect.Effect&lt;void&gt;;}&gt;, resource: {    readonly notify: (message: string) =&gt; Effect.Effect&lt;void&gt;;}) =&gt; Layer.Layer&lt;Notifications, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Constructs a layer from the specified value.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[succeed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[this]{style="--0:#005CC5;--1:#79B8FF"}[,
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

:::::::::::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>notify: (message: string) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::
::::

[notify]{style="--0:#6F42C1;--1:#B392F0"}[:
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>message: string</code></pre>
</figure>
:::
::::

[message]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Console</code></pre>
</figure>
:::
::::

[Console]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const log: (...args: ReadonlyArray&lt;any&gt;) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>message: string</code></pre>
</figure>
:::
::::

[message]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[// Example entry point for an external
framework]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::::: code
[async]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[function]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function main(): Promise&lt;void&gt;</code></pre>
</figure>
:::
::::

[main]{style="--0:#6F42C1;--1:#B392F0"}[()
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[ ]{.indent}[// Create a custom runtime using the Notifications
layer]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

:::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runtime: ManagedRuntime.ManagedRuntime&lt;Notifications, never&gt;</code></pre>
</figure>
:::
::::

[runtime]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import ManagedRuntime</code></pre>
</figure>
:::
::::

[ManagedRuntime]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;Notifications, never&gt;(layer: Layer.Layer&lt;Notifications, never, never&gt;, memoMap?: Layer.MemoMap | undefined) =&gt; ManagedRuntime.ManagedRuntime&lt;Notifications, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Convert a Layer into an ManagedRuntime, that can be used to run
Effect\'s using your services.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Console, Effect, Layer, ManagedRuntime } from &quot;effect&quot;
class Notifications extends Effect.Tag(&quot;Notifications&quot;)&lt;  Notifications,  { readonly notify: (message: string) =&gt; Effect.Effect&lt;void&gt; }&gt;() {  static Live = Layer.succeed(this, { notify: (message) =&gt; Console.log(message) })}
async function main() {  const runtime = ManagedRuntime.make(Notifications.Live)  await runtime.runPromise(Notifications.notify(&quot;Hello, world!&quot;))  await runtime.dispose()}
main()</code></pre>
</figure>
:::
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Notifications</code></pre>
</figure>
:::
::::

[Notifications]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Notifications.Live: Layer.Layer&lt;Notifications, never, never&gt;</code></pre>
</figure>
:::
::::

[Live]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[ ]{.indent}[// Run the effect]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

:::::::::::: code
[ ]{.indent}[await]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runtime: ManagedRuntime.ManagedRuntime&lt;Notifications, never&gt;</code></pre>
</figure>
:::
::::

[runtime]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>ManagedRuntime&lt;Notifications, never&gt;.runPromise: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, Notifications&gt;, options?: {    readonly signal?: AbortSignal | undefined;} | undefined) =&gt; Promise&lt;void&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Runs the `Effect`, returning a JavaScript `Promise` that will be
resolved with the value of the effect once the effect has been executed,
or will be rejected with the first error or exception throw by the
effect.

This method is effectful and should only be used at the edges of your
program.
:::
:::::

[runPromise]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Notifications</code></pre>
</figure>
:::
::::

[Notifications]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>notify: (message: string) =&gt; Effect.Effect&lt;void, never, Notifications&gt;</code></pre>
</figure>
:::
::::

[notify]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Hello,
world!\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[ ]{.indent}[// Dispose of the runtime, cleaning up
resources]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

:::::::: code
[ ]{.indent}[await]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runtime: ManagedRuntime.ManagedRuntime&lt;Notifications, never&gt;</code></pre>
</figure>
:::
::::

[runtime]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>ManagedRuntime&lt;Notifications, never&gt;.dispose: () =&gt; Promise&lt;void&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Dispose of the resources associated with the runtime.
:::
:::::

[dispose]{style="--0:#6F42C1;--1:#B392F0"}[()]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/runtime.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Configuration]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../configuration/index.html){.astro-u5aomj4k
rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[Introduction]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../scheduling/introduction/index.html){.astro-u5aomj4k
rel="next"}
:::
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
