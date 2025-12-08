:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Fibers {#_top .astro-np5lzwrf}
:::
::::

:::::::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::::::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::::::: sl-markdown-content
Effect is a highly concurrent framework powered by fibers. Fibers are
lightweight virtual threads with resource-safe cancellation
capabilities, enabling many features in Effect.

In this section, you will learn the basics of fibers and get familiar
with some of the powerful low-level operators that utilize fibers.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## What Are Virtual Threads?

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#what-are-virtual-threads){.anchor-link
aria-labelledby="what-are-virtual-threads"}
:::

JavaScript is inherently single-threaded, meaning it executes code in a
single sequence of instructions. However, modern JavaScript environments
use an event loop to manage asynchronous operations, creating the
illusion of multitasking. In this context, virtual threads, or fibers,
are logical threads simulated by the Effect runtime. They allow
concurrent execution without relying on true multi-threading, which is
not natively supported in JavaScript.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## How Fibers work

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#how-fibers-work){.anchor-link
aria-labelledby="how-fibers-work"}
:::

All effects in Effect are executed by fibers. If you didn't create the
fiber yourself, it was created by an operation you're using (if it's
concurrent) or by the Effect runtime system.

A fiber is created any time an effect is run. When running effects
concurrently, a fiber is created for each concurrent effect.

Even if you write "single-threaded" code with no concurrent operations,
there will always be at least one fiber: the "main" fiber that executes
your effect.

Effect fibers have a well-defined lifecycle based on the effect they are
executing.

Every fiber exits with either a failure or success, depending on whether
the effect it is executing fails or succeeds.

Effect fibers have unique identities, local state, and a status (such as
done, running, or suspended).

To summarize:

- An `Effect`{dir="auto"} is a higher-level concept that describes an
  effectful computation. It is lazy and immutable, meaning it represents
  a computation that may produce a value or fail but does not
  immediately execute.
- A fiber, on the other hand, represents the running execution of an
  `Effect`{dir="auto"}. It can be interrupted or awaited to retrieve its
  result. Think of it as a way to control and interact with the ongoing
  computation.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## The Fiber Data Type

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#the-fiber-data-type){.anchor-link
aria-labelledby="the-fiber-data-type"}
:::

The `Fiber`{dir="auto"} data type in Effect represents a "handle" on the
execution of an effect.

Here is the general form of a `Fiber`{dir="auto"}:

::: expressive-code
<figure class="frame not-content">
<pre data-language="text"><code>        ┌─── Represents the success type        │        ┌─── Represents the error type        │        │        ▼        ▼Fiber&lt;Success, Error&gt;</code></pre>
<div class="copy">
<div>

</div>
</div>
</figure>
:::

This type indicates that a fiber:

- Succeeds and returns a value of type `Success`{dir="auto"}
- Fails with an error of type `Error`{dir="auto"}

Fibers do not have an `Requirements`{dir="auto"} type parameter because
they only execute effects that have already had their requirements
provided to them.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Forking Effects

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#forking-effects){.anchor-link
aria-labelledby="forking-effects"}
:::

You can create a new fiber by **forking** an effect. This starts the
effect in a new fiber, and you receive a reference to that fiber.

**Example** (Forking a Fiber)

In this example, the Fibonacci calculation is forked into its own fiber,
allowing it to run independently of the main fiber. The reference to the
`fib10Fiber`{dir="auto"} can be used later to join or interrupt the
fiber.

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
::::::::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

:::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
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

[Effect]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[\>
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
::::::::::::::
:::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\<]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}
:::::
::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::::::::: code
[ ]{.indent}[?]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const succeed: &lt;number&gt;(value: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that always succeeds with a given value.

**When to Use**

Use this function when you need an effect that completes successfully
with a specific value without any errors or external dependencies.

**Example** (Creating a Successful Effect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
// Creating an effect that represents a successful scenario////      ┌─── Effect&lt;number, never, never&gt;//      ▼const success = Effect.succeed(42)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [fail to create an effect that
represents a failure.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[succeed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::::::::::::::::::::::::::: code
[ ]{.indent}[:]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const zipWith: &lt;number, never, never, number, never, never, number&gt;(self: Effect.Effect&lt;number, never, never&gt;, that: Effect.Effect&lt;number, never, never&gt;, f: (a: number, b: number) =&gt; number, options?: {    readonly concurrent?: boolean | undefined;    readonly batching?: boolean | &quot;inherit&quot; | undefined;    readonly concurrentFinalizers?: boolean | undefined;}) =&gt; Effect.Effect&lt;number, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Combines two effects sequentially and applies a function to their
results to produce a single value.

**Details**

This function runs two effects in sequence (or concurrently, if the
`{ concurrent: true }` option is provided) and combines their results
using a provided function. Unlike

zip

, which returns a tuple of the results, this function processes the
results with a custom function to produce a single output.

**Example** (Combining Effects with a Custom Function)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const task1 = Effect.succeed(1).pipe(  Effect.delay(&quot;200 millis&quot;),  Effect.tap(Effect.log(&quot;task1 done&quot;)))const task2 = Effect.succeed(&quot;hello&quot;).pipe(  Effect.delay(&quot;100 millis&quot;),  Effect.tap(Effect.log(&quot;task2 done&quot;)))
const task3 = Effect.zipWith(  task1,  task2,  // Combines results into a single value  (number, string) =&gt; number + string.length)
Effect.runPromise(task3).then(console.log)// Output:// timestamp=... level=INFO fiber=#3 message=&quot;task1 done&quot;// timestamp=... level=INFO fiber=#2 message=&quot;task2 done&quot;// 6</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[zipWith]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[-]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[),
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[-]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[),
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>a: number</code></pre>
</figure>
:::
::::

[a]{style="--0:#AE4B07;--1:#FFAB70"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>b: number</code></pre>
</figure>
:::
::::

[b]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>a: number</code></pre>
</figure>
:::
::::

[a]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[+]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>b: number</code></pre>
</figure>
:::
::::

[b]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::::::::
::::::::::::::::::::::::::::::

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
[// ┌─── Effect\<RuntimeFiber\<number, never\>, never,
never\>]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[// ▼]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
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
<pre data-language="ts"><code>const fib10Fiber: Effect.Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;</code></pre>
</figure>
:::
::::

[fib10Fiber]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const fork: &lt;number, never, never&gt;(self: Effect.Effect&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[10]{style="--0:#005CC5;--1:#79B8FF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Joining Fibers

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#joining-fibers){.anchor-link
aria-labelledby="joining-fibers"}
:::

One common operation with fibers is **joining** them. By using the
`Fiber.join`{dir="auto"} function, you can wait for a fiber to complete
and retrieve its result. The joined fiber will either succeed or fail,
and the `Effect`{dir="auto"} returned by `join`{dir="auto"} reflects the
outcome of the fiber.

**Example** (Joining a Fiber)

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
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

:::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
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

[Effect]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[\>
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
::::::::::::::
:::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\<]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}
:::::
::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::::::::: code
[ ]{.indent}[?]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const succeed: &lt;number&gt;(value: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that always succeeds with a given value.

**When to Use**

Use this function when you need an effect that completes successfully
with a specific value without any errors or external dependencies.

**Example** (Creating a Successful Effect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
// Creating an effect that represents a successful scenario////      ┌─── Effect&lt;number, never, never&gt;//      ▼const success = Effect.succeed(42)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [fail to create an effect that
represents a failure.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[succeed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::::::::::::::::::::::::::: code
[ ]{.indent}[:]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const zipWith: &lt;number, never, never, number, never, never, number&gt;(self: Effect.Effect&lt;number, never, never&gt;, that: Effect.Effect&lt;number, never, never&gt;, f: (a: number, b: number) =&gt; number, options?: {    readonly concurrent?: boolean | undefined;    readonly batching?: boolean | &quot;inherit&quot; | undefined;    readonly concurrentFinalizers?: boolean | undefined;}) =&gt; Effect.Effect&lt;number, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Combines two effects sequentially and applies a function to their
results to produce a single value.

**Details**

This function runs two effects in sequence (or concurrently, if the
`{ concurrent: true }` option is provided) and combines their results
using a provided function. Unlike

zip

, which returns a tuple of the results, this function processes the
results with a custom function to produce a single output.

**Example** (Combining Effects with a Custom Function)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const task1 = Effect.succeed(1).pipe(  Effect.delay(&quot;200 millis&quot;),  Effect.tap(Effect.log(&quot;task1 done&quot;)))const task2 = Effect.succeed(&quot;hello&quot;).pipe(  Effect.delay(&quot;100 millis&quot;),  Effect.tap(Effect.log(&quot;task2 done&quot;)))
const task3 = Effect.zipWith(  task1,  task2,  // Combines results into a single value  (number, string) =&gt; number + string.length)
Effect.runPromise(task3).then(console.log)// Output:// timestamp=... level=INFO fiber=#3 message=&quot;task1 done&quot;// timestamp=... level=INFO fiber=#2 message=&quot;task2 done&quot;// 6</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[zipWith]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[-]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[),
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[-]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[),
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>a: number</code></pre>
</figure>
:::
::::

[a]{style="--0:#AE4B07;--1:#FFAB70"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>b: number</code></pre>
</figure>
:::
::::

[b]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>a: number</code></pre>
</figure>
:::
::::

[a]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[+]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>b: number</code></pre>
</figure>
:::
::::

[b]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::::::::
::::::::::::::::::::::::::::::

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
[// ┌─── Effect\<RuntimeFiber\<number, never\>, never,
never\>]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[// ▼]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
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
<pre data-language="ts"><code>const fib10Fiber: Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;</code></pre>
</figure>
:::
::::

[fib10Fiber]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const fork: &lt;number, never, never&gt;(self: Effect.Effect&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[10]{style="--0:#005CC5;--1:#79B8FF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;number, never, never&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;number, never, never&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt; (+1 overload)</code></pre>
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
13
:::
::::

::: code
[ ]{.indent}[// Retrieve the fiber]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib10Fiber: Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;</code></pre>
</figure>
:::
::::

[fib10Fiber]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[ ]{.indent}[// Join the fiber and get the
result]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const join: &lt;number, never&gt;(self: Fiber.Fiber&lt;number, never&gt;) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Joins the fiber, which suspends the joining fiber until the result of
the fiber has been determined. Attempting to join a fiber that has erred
will result in a catchable error. Joining an interrupted fiber will
result in an \"inner interruption\" of this fiber, unlike interruption
triggered by another fiber, \"inner interruption\" can be caught and
recovered.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[join]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

:::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
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
<pre data-language="ts"><code>const runFork: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;, options?: RunForkOptions) =&gt; Fiber.RuntimeFiber&lt;void, never&gt;</code></pre>
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

[program]{style="--0:#24292E;--1:#E1E4E8"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[// Output:
55]{style="--0:#616972;--1:#99A0A6"}
:::::::::::::
::::::::::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Awaiting Fibers

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#awaiting-fibers){.anchor-link
aria-labelledby="awaiting-fibers"}
:::

The `Fiber.await`{dir="auto"} function is a helpful tool when working
with fibers. It allows you to wait for a fiber to complete and retrieve
detailed information about how it finished. The result is encapsulated
in an [Exit](../../data-types/exit/index.html) value, which gives you
insight into whether the fiber succeeded, failed, or was interrupted.

**Example** (Awaiting Fiber Completion)

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
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

:::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
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

[Effect]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[\>
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
::::::::::::::
:::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\<]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}
:::::
::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::::::::: code
[ ]{.indent}[?]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const succeed: &lt;number&gt;(value: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that always succeeds with a given value.

**When to Use**

Use this function when you need an effect that completes successfully
with a specific value without any errors or external dependencies.

**Example** (Creating a Successful Effect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
// Creating an effect that represents a successful scenario////      ┌─── Effect&lt;number, never, never&gt;//      ▼const success = Effect.succeed(42)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [fail to create an effect that
represents a failure.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[succeed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::::::::::::::::::::::::::: code
[ ]{.indent}[:]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const zipWith: &lt;number, never, never, number, never, never, number&gt;(self: Effect.Effect&lt;number, never, never&gt;, that: Effect.Effect&lt;number, never, never&gt;, f: (a: number, b: number) =&gt; number, options?: {    readonly concurrent?: boolean | undefined;    readonly batching?: boolean | &quot;inherit&quot; | undefined;    readonly concurrentFinalizers?: boolean | undefined;}) =&gt; Effect.Effect&lt;number, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Combines two effects sequentially and applies a function to their
results to produce a single value.

**Details**

This function runs two effects in sequence (or concurrently, if the
`{ concurrent: true }` option is provided) and combines their results
using a provided function. Unlike

zip

, which returns a tuple of the results, this function processes the
results with a custom function to produce a single output.

**Example** (Combining Effects with a Custom Function)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const task1 = Effect.succeed(1).pipe(  Effect.delay(&quot;200 millis&quot;),  Effect.tap(Effect.log(&quot;task1 done&quot;)))const task2 = Effect.succeed(&quot;hello&quot;).pipe(  Effect.delay(&quot;100 millis&quot;),  Effect.tap(Effect.log(&quot;task2 done&quot;)))
const task3 = Effect.zipWith(  task1,  task2,  // Combines results into a single value  (number, string) =&gt; number + string.length)
Effect.runPromise(task3).then(console.log)// Output:// timestamp=... level=INFO fiber=#3 message=&quot;task1 done&quot;// timestamp=... level=INFO fiber=#2 message=&quot;task2 done&quot;// 6</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[zipWith]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[-]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[),
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[-]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[),
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>a: number</code></pre>
</figure>
:::
::::

[a]{style="--0:#AE4B07;--1:#FFAB70"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>b: number</code></pre>
</figure>
:::
::::

[b]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>a: number</code></pre>
</figure>
:::
::::

[a]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[+]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>b: number</code></pre>
</figure>
:::
::::

[b]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::::::::
::::::::::::::::::::::::::::::

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
[// ┌─── Effect\<RuntimeFiber\<number, never\>, never,
never\>]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[// ▼]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
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
<pre data-language="ts"><code>const fib10Fiber: Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;</code></pre>
</figure>
:::
::::

[fib10Fiber]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const fork: &lt;number, never, never&gt;(self: Effect.Effect&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib: (n: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::
::::

[fib]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[10]{style="--0:#005CC5;--1:#79B8FF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;Exit&lt;number, never&gt;, never, never&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;Exit&lt;number, never&gt;, never, never&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt; (+1 overload)</code></pre>
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
13
:::
::::

::: code
[ ]{.indent}[// Retrieve the fiber]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fib10Fiber: Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;</code></pre>
</figure>
:::
::::

[fib10Fiber]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[ ]{.indent}[// Await its completion and get the Exit
result]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const exit: Exit&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[exit]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>await&lt;number, never&gt;(self: Fiber.Fiber&lt;number, never&gt;): Effect.Effect&lt;Exit&lt;number, never&gt;, never, never&gt;export await</code></pre>
</figure>
:::

::: twoslash-popup-docs
Awaits the fiber, which suspends the awaiting fiber until the result of
the fiber has been determined.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[await]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

:::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const exit: Exit&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[exit]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
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
<pre data-language="ts"><code>const runFork: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;, options?: RunForkOptions) =&gt; Fiber.RuntimeFiber&lt;void, never&gt;</code></pre>
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
21
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
[{ \_id: \'Exit\', \_tag: \'Success\', value: 55
}]{style="--0:#616972;--1:#99A0A6"}
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

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Interruption Model

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#interruption-model){.anchor-link
aria-labelledby="interruption-model"}
:::

While developing concurrent applications, there are several cases that
we need to interrupt the execution of other fibers, for example:

1.  A parent fiber might start some child fibers to perform a task, and
    later the parent might decide that, it doesn't need the result of
    some or all of the child fibers.

2.  Two or more fibers start race with each other. The fiber whose
    result is computed first wins, and all other fibers are no longer
    needed, and should be interrupted.

3.  In interactive applications, a user may want to stop some already
    running tasks, such as clicking on the "stop" button to prevent
    downloading more files.

4.  Computations that run longer than expected should be aborted by
    using timeout operations.

5.  When we have an application that perform compute-intensive tasks
    based on the user inputs, if the user changes the input we should
    cancel the current task and perform another one.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Polling vs. Asynchronous Interruption {#polling-vs-asynchronous-interruption}

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#polling-vs-asynchronous-interruption){.anchor-link
aria-labelledby="polling-vs-asynchronous-interruption"}
:::

When it comes to interrupting fibers, a naive approach is to allow one
fiber to forcefully terminate another fiber. However, this approach is
not ideal because it can leave shared state in an inconsistent and
unreliable state if the target fiber is in the middle of modifying that
state. Therefore, it does not guarantee internal consistency of the
shared mutable state.

Instead, there are two popular and valid solutions to tackle this
problem:

1.  **Semi-asynchronous Interruption (Polling for Interruption)**:
    Imperative languages often employ polling as a semi-asynchronous
    signaling mechanism, such as Java. In this model, a fiber sends an
    interruption request to another fiber. The target fiber continuously
    polls the interrupt status and checks whether it has received any
    interruption requests from other fibers. If an interruption request
    is detected, the target fiber terminates itself as soon as possible.

    With this solution, the fiber itself handles critical sections. So,
    if a fiber is in the middle of a critical section and receives an
    interruption request, it ignores the interruption and defers its
    handling until after the critical section.

    However, one drawback of this approach is that if the programmer
    forgets to poll regularly, the target fiber can become unresponsive,
    leading to deadlocks. Additionally, polling a global flag is not
    aligned with the functional paradigm followed by Effect.

2.  **Asynchronous Interruption**: In asynchronous interruption, a fiber
    is allowed to terminate another fiber. The target fiber is not
    responsible for polling the interrupt status. Instead, during
    critical sections, the target fiber disables the interruptibility of
    those regions. This is a purely functional solution that doesn't
    require polling a global state. Effect adopts this solution for its
    interruption model, which is a fully asynchronous signaling
    mechanism.

    This mechanism overcomes the drawback of forgetting to poll
    regularly. It is also fully compatible with the functional paradigm
    because in a purely functional computation, we can abort the
    computation at any point, except during critical sections where
    interruption is disabled.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Interrupting Fibers

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#interrupting-fibers){.anchor-link
aria-labelledby="interrupting-fibers"}
:::

Fibers can be interrupted if their result is no longer needed. This
action immediately stops the fiber and safely runs all finalizers to
release any resources.

Like `Fiber.await`{dir="auto"}, the `Fiber.interrupt`{dir="auto"}
function returns an [Exit](../../data-types/exit/index.html) value that
provides detailed information about how the fiber ended.

**Example** (Interrupting a Fiber)

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
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
4
:::
::::

::: code
[ ]{.indent}[// Fork a fiber that runs indefinitely, printing
\"Hi!\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;never, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const fork: &lt;never, never, never&gt;(self: Effect.Effect&lt;never, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;never, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

:::::::::::::::::::::::::::: code
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

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const forever: &lt;void, never, never&gt;(self: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;never, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Repeats an effect indefinitely until an error occurs.

**Details**

This function executes an effect repeatedly in an infinite loop. Each
iteration is executed sequentially, and the loop continues until the
first error occurs. If the effect succeeds, it starts over from the
beginning. If the effect fails, the error is propagated, and the loop
stops.

Be cautious when using this function, as it will run indefinitely unless
an error interrupts it. This makes it suitable for long-running
processes or continuous polling tasks, but you should ensure proper
error handling or combine it with other operators like `timeout` or
`schedule` to prevent unintentional infinite loops.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[forever]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Hi!\"]{style="--0:#032F62;--1:#9ECBFF"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const delay: (duration: DurationInput) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, R&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Delays the execution of an effect by a specified `Duration`.

\*\*Details

This function postpones the execution of the provided effect by the
specified duration. The duration can be provided in various formats
supported by the `Duration` module.

Internally, this function does not block the thread; instead, it uses an
efficient, non-blocking mechanism to introduce the delay.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Console, Effect } from &quot;effect&quot;
const task = Console.log(&quot;Task executed&quot;)
const program = Console.log(&quot;start&quot;).pipe(  Effect.andThen(    // Delays the log message by 2 seconds    task.pipe(Effect.delay(&quot;2 seconds&quot;))  ))
Effect.runFork(program)// Output:// start// Task executed</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[delay]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"10
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::::
:::::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"30
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[ ]{.indent}[// Interrupt the fiber and get an Exit value detailing how
it finished]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const exit: Exit&lt;never, never&gt;</code></pre>
</figure>
:::
::::

[exit]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const interrupt: &lt;never, never&gt;(self: Fiber.Fiber&lt;never, never&gt;) =&gt; Effect.Effect&lt;Exit&lt;never, never&gt;, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Interrupts the fiber from whichever fiber is calling this method. If the
fiber has already exited, the returned effect will resume immediately.
Otherwise, the effect will resume when the fiber exits.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[interrupt]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;never, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

:::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const exit: Exit&lt;never, never&gt;</code></pre>
</figure>
:::
::::

[exit]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

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

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
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
<pre data-language="ts"><code>const runFork: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;, options?: RunForkOptions) =&gt; Fiber.RuntimeFiber&lt;void, never&gt;</code></pre>
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
15
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[timestamp=\... level=INFO fiber=#1
message=Hi!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[timestamp=\... level=INFO fiber=#1
message=Hi!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
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
21
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
22
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
23
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
24
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_tag:
\'Interrupt\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[fiberId:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_id:
\'FiberId\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\_tag:
\'Runtime\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[id:
0,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[startTimeMillis:
\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
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
31
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
32
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
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

By default, the effect returned by `Fiber.interrupt`{dir="auto"} waits
until the fiber has fully terminated before resuming. This ensures that
no new fibers are started before the previous ones have finished, a
behavior known as "back-pressuring."

If you do not require this waiting behavior, you can fork the
interruption itself, allowing the main program to proceed without
waiting for the fiber to terminate:

**Example** (Forking an Interruption)

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
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;never, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const fork: &lt;never, never, never&gt;(self: Effect.Effect&lt;never, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;never, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

:::::::::::::::::::::::::::: code
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

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const forever: &lt;void, never, never&gt;(self: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;never, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Repeats an effect indefinitely until an error occurs.

**Details**

This function executes an effect repeatedly in an infinite loop. Each
iteration is executed sequentially, and the loop continues until the
first error occurs. If the effect succeeds, it starts over from the
beginning. If the effect fails, the error is propagated, and the loop
stops.

Be cautious when using this function, as it will run indefinitely unless
an error interrupts it. This makes it suitable for long-running
processes or continuous polling tasks, but you should ensure proper
error handling or combine it with other operators like `timeout` or
`schedule` to prevent unintentional infinite loops.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[forever]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Hi!\"]{style="--0:#032F62;--1:#9ECBFF"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const delay: (duration: DurationInput) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, R&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Delays the execution of an effect by a specified `Duration`.

\*\*Details

This function postpones the execution of the provided effect by the
specified duration. The duration can be provided in various formats
supported by the `Duration` module.

Internally, this function does not block the thread; instead, it uses an
efficient, non-blocking mechanism to introduce the delay.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Console, Effect } from &quot;effect&quot;
const task = Console.log(&quot;Task executed&quot;)
const program = Console.log(&quot;start&quot;).pipe(  Effect.andThen(    // Delays the log message by 2 seconds    task.pipe(Effect.delay(&quot;2 seconds&quot;))  ))
Effect.runFork(program)// Output:// start// Task executed</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[delay]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"10
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::::
:::::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"30
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const _: Fiber.RuntimeFiber&lt;Exit&lt;never, never&gt;, never&gt;</code></pre>
</figure>
:::
::::

[\_]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const fork: &lt;Exit&lt;never, never&gt;, never, never&gt;(self: Effect.Effect&lt;Exit&lt;never, never&gt;, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;Exit&lt;never, never&gt;, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const interrupt: &lt;never, never&gt;(self: Fiber.Fiber&lt;never, never&gt;) =&gt; Effect.Effect&lt;Exit&lt;never, never&gt;, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Interrupts the fiber from whichever fiber is calling this method. If the
fiber has already exited, the returned effect will resume immediately.
Otherwise, the effect will resume when the fiber exits.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[interrupt]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;never, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Do
something
else\...\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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
<pre data-language="ts"><code>const runFork: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;, options?: RunForkOptions) =&gt; Fiber.RuntimeFiber&lt;void, never&gt;</code></pre>
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
[timestamp=\... level=INFO fiber=#1
message=Hi!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[timestamp=\... level=INFO fiber=#1
message=Hi!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[Do something else\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
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

There is also a shorthand for background interruption called
`Fiber.interruptFork`{dir="auto"}.

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
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;never, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const fork: &lt;never, never, never&gt;(self: Effect.Effect&lt;never, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;never, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

:::::::::::::::::::::::::::: code
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

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const forever: &lt;void, never, never&gt;(self: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;never, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Repeats an effect indefinitely until an error occurs.

**Details**

This function executes an effect repeatedly in an infinite loop. Each
iteration is executed sequentially, and the loop continues until the
first error occurs. If the effect succeeds, it starts over from the
beginning. If the effect fails, the error is propagated, and the loop
stops.

Be cautious when using this function, as it will run indefinitely unless
an error interrupts it. This makes it suitable for long-running
processes or continuous polling tasks, but you should ensure proper
error handling or combine it with other operators like `timeout` or
`schedule` to prevent unintentional infinite loops.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[forever]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Hi!\"]{style="--0:#032F62;--1:#9ECBFF"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const delay: (duration: DurationInput) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, R&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Delays the execution of an effect by a specified `Duration`.

\*\*Details

This function postpones the execution of the provided effect by the
specified duration. The duration can be provided in various formats
supported by the `Duration` module.

Internally, this function does not block the thread; instead, it uses an
efficient, non-blocking mechanism to introduce the delay.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Console, Effect } from &quot;effect&quot;
const task = Console.log(&quot;Task executed&quot;)
const program = Console.log(&quot;start&quot;).pipe(  Effect.andThen(    // Delays the log message by 2 seconds    task.pipe(Effect.delay(&quot;2 seconds&quot;))  ))
Effect.runFork(program)// Output:// start// Task executed</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[delay]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"10
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::::
:::::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"30
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: {.ec-line .highlight .del}
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[ ]{.indent}[// const \_ = yield\*
Effect.fork(Fiber.interrupt(fiber))]{style="--0:#474d54;--1:#b1b6bb"}
:::
::::::

:::::::::::::::: {.ec-line .highlight .ins}
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::::::::: code
[ ]{.indent}[const]{style="--0:#8f2731;--1:#fb9fa9"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#004ba0;--1:#82bdff"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const _: void</code></pre>
</figure>
:::
::::

[\_]{style="--0:#004ba0;--1:#82bdff"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#8f2731;--1:#fb9fa9"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#8f2731;--1:#fb9fa9"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#5c37a0;--1:#c6adf4"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const interruptFork: &lt;never, never&gt;(self: Fiber.Fiber&lt;never, never&gt;) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Interrupts the fiber from whichever fiber is calling this method. The
interruption will happen in a separate daemon fiber, and the returned
effect will always resume immediately without waiting.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[interruptFork]{style="--0:#5c37a0;--1:#c6adf4"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;never, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Do
something
else\...\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

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
<pre data-language="ts"><code>const runFork: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;, options?: RunForkOptions) =&gt; Fiber.RuntimeFiber&lt;void, never&gt;</code></pre>
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
14
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[timestamp=\... level=INFO fiber=#1
message=Hi!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[timestamp=\... level=INFO fiber=#1
message=Hi!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[Do something else\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
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

![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9InN0YXJsaWdodC1hc2lkZV9faWNvbiBhc3Ryby00cmd5N2NycCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Ym94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciIgc3R5bGU9Ii0tc2wtaWNvbi1zaXplOiAxZW07Ij48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xLjQ0IDguODU1di0uMDAxbDMuNTI3LTMuNTE2Yy4zNC0uMzQ0LjgwMi0uNTQxIDEuMjg1LS41NDhoNi42NDlsLjk0Ny0uOTQ3YzMuMDctMy4wNyA2LjIwNy0zLjA3MiA3LjYyLTIuODY4YTEuODIxIDEuODIxIDAgMCAxIDEuNTU3IDEuNTU3Yy4yMDQgMS40MTMuMjAzIDQuNTUtMi44NjggNy42MmwtLjk0Ni45NDZ2Ni42NDlhMS44NDUgMS44NDUgMCAwIDEtLjU0OSAxLjI4NmwtMy41MTYgMy41MjhhMS44NDQgMS44NDQgMCAwIDEtMy4xMS0uOTQ0bC0uODU4LTQuMjc1LTQuNTItNC41Mi0yLjMxLS40NjMtMS45NjQtLjM5NEExLjg0NyAxLjg0NyAwIDAgMSAuOTggMTAuNjkzYTEuODQzIDEuODQzIDAgMCAxIC40Ni0xLjgzOFptNS4zNzkgMi4wMTctMy44NzMtLjc3Nkw2LjMyIDYuNzMzaDQuNjM4bC00LjE0IDQuMTRabTguNDAzLTUuNjU1YzIuNDU5LTIuNDYgNC44NTYtMi40NjMgNS44OS0yLjMzLjEzNCAxLjAzNS4xMyAzLjQzMi0yLjMyOSA1Ljg5MWwtNi43MSA2LjcxLTMuNTYxLTMuNTYgNi43MS02LjcxMVptLTEuMzE4IDE1LjgzNy0uNzc2LTMuODczIDQuMTQtNC4xNHY0LjYzOWwtMy4zNjQgMy4zNzRaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIC8+PHBhdGggZD0iTTkuMzE4IDE4LjM0NWEuOTcyLjk3MiAwIDAgMC0xLjg2LS41NjFjLS40ODIgMS40MzUtMS42ODcgMi4yMDQtMi45MzQgMi42MTlhOC4yMiA4LjIyIDAgMCAxLTEuMjMuMzAyYy4wNjItLjM2NS4xNTctLjc5LjMwMy0xLjIyOS40MTUtMS4yNDcgMS4xODQtMi40NTIgMi42Mi0yLjkzNWEuOTcxLjk3MSAwIDEgMC0uNjItMS44NDJjLS4xMi4wNC0uMjM2LjA4NC0uMzUuMTMtMi4wMi44MjgtMy4wMTIgMi41ODgtMy40OTMgNC4wMzNhMTAuMzgzIDEwLjM4MyAwIDAgMC0uNTEgMi44NDVsLS4wMDEuMDE2di4wNjNjMCAuNTM2LjQzNC45NzIuOTcuOTcySDIuMjRhNy4yMSA3LjIxIDAgMCAwIC44NzgtLjA2NWMuNTI3LS4wNjMgMS4yNDgtLjE5IDIuMDItLjQ0NyAxLjQ0NS0uNDggMy4yMDUtMS40NzIgNC4wMzMtMy40OTRhNS44MjggNS44MjggMCAwIDAgLjE0Ny0uNDA3WiIgLz48L3N2Zz4=){.starlight-aside__icon
.astro-4rgy7crp} Interrupting via Effect.interrupt

::: starlight-aside__content
You can also interrupt fibers using the high-level API
`Effect.interrupt`{dir="auto"}. For more details, refer to the
[Effect.interrupt
documentation](../basic-concurrency/index.html#interruptions).
:::

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Composing Fibers

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#composing-fibers){.anchor-link
aria-labelledby="composing-fibers"}
:::

The `Fiber.zip`{dir="auto"} and `Fiber.zipWith`{dir="auto"} functions
allow you to combine two fibers into one. The resulting fiber will
produce the results of both input fibers. If either fiber fails, the
combined fiber will also fail.

**Example** (Combining Fibers with `Fiber.zip`{dir="auto"})

In this example, both fibers run concurrently, and the results are
combined into a tuple.

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
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;string, never&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;[string, string], never, never&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;string, never&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;[string, string], never, never&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt; (+1 overload)</code></pre>
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
4
:::
::::

::: code
[ ]{.indent}[// Fork two fibers that each produce a
string]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber1: Fiber.RuntimeFiber&lt;string, never&gt;</code></pre>
</figure>
:::
::::

[fiber1]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const fork: &lt;string, never, never&gt;(self: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;string, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const succeed: &lt;string&gt;(value: string) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that always succeeds with a given value.

**When to Use**

Use this function when you need an effect that completes successfully
with a specific value without any errors or external dependencies.

**Example** (Creating a Successful Effect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
// Creating an effect that represents a successful scenario////      ┌─── Effect&lt;number, never, never&gt;//      ▼const success = Effect.succeed(42)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [fail to create an effect that
represents a failure.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[succeed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Hi!\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber2: Fiber.RuntimeFiber&lt;string, never&gt;</code></pre>
</figure>
:::
::::

[fiber2]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const fork: &lt;string, never, never&gt;(self: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;string, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const succeed: &lt;string&gt;(value: string) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that always succeeds with a given value.

**When to Use**

Use this function when you need an effect that completes successfully
with a specific value without any errors or external dependencies.

**Example** (Creating a Successful Effect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
// Creating an effect that represents a successful scenario////      ┌─── Effect&lt;number, never, never&gt;//      ▼const success = Effect.succeed(42)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [fail to create an effect that
represents a failure.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[succeed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Bye!\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

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
[ ]{.indent}[// Combine the two fibers using
Fiber.zip]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.Fiber&lt;[string, string], never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const zip: &lt;string, never, string, never&gt;(self: Fiber.Fiber&lt;string, never&gt;, that: Fiber.Fiber&lt;string, never&gt;) =&gt; Fiber.Fiber&lt;[string, string], never&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Zips this fiber and the specified fiber together, producing a tuple of
their output.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[zip]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber1: Fiber.RuntimeFiber&lt;string, never&gt;</code></pre>
</figure>
:::
::::

[fiber1]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber2: Fiber.RuntimeFiber&lt;string, never&gt;</code></pre>
</figure>
:::
::::

[fiber2]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[ ]{.indent}[// Join the combined fiber and get the result as a
tuple]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const tuple: [string, string]</code></pre>
</figure>
:::
::::

[tuple]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const join: &lt;[string, string], never&gt;(self: Fiber.Fiber&lt;[string, string], never&gt;) =&gt; Effect.Effect&lt;[string, string], never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Joins the fiber, which suspends the joining fiber until the result of
the fiber has been determined. Attempting to join a fiber that has erred
will result in a catchable error. Joining an interrupted fiber will
result in an \"inner interruption\" of this fiber, unlike interruption
triggered by another fiber, \"inner interruption\" can be caught and
recovered.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[join]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.Fiber&lt;[string, string], never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

:::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const tuple: [string, string]</code></pre>
</figure>
:::
::::

[tuple]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
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
<pre data-language="ts"><code>const runFork: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;, options?: RunForkOptions) =&gt; Fiber.RuntimeFiber&lt;void, never&gt;</code></pre>
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
17
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[\[ \'Hi!\', \'Bye!\' \]]{style="--0:#616972;--1:#99A0A6"}
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

Another way to compose fibers is by using `Fiber.orElse`{dir="auto"}.
This function allows you to provide an alternative fiber that will
execute if the first one fails. If the first fiber succeeds, its result
will be returned. If it fails, the second fiber will run instead, and
its result will be returned regardless of its outcome.

**Example** (Providing a Fallback Fiber with `Fiber.orElse`{dir="auto"})

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
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;never, string&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;string, never&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;string, string, never&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;never, string&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;string, never&gt;, never, never&gt;&gt; | YieldWrap&lt;...&gt;, void, never&gt;) =&gt; Effect.Effect&lt;...&gt; (+1 overload)</code></pre>
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
4
:::
::::

::: code
[ ]{.indent}[// Fork a fiber that will
fail]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber1: Fiber.RuntimeFiber&lt;never, string&gt;</code></pre>
</figure>
:::
::::

[fiber1]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const fork: &lt;never, string, never&gt;(self: Effect.Effect&lt;never, string, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;never, string&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

[fail]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Uh
oh!\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[ ]{.indent}[// Fork another fiber that will
succeed]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber2: Fiber.RuntimeFiber&lt;string, never&gt;</code></pre>
</figure>
:::
::::

[fiber2]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const fork: &lt;string, never, never&gt;(self: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;string, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const succeed: &lt;string&gt;(value: string) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that always succeeds with a given value.

**When to Use**

Use this function when you need an effect that completes successfully
with a specific value without any errors or external dependencies.

**Example** (Creating a Successful Effect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
// Creating an effect that represents a successful scenario////      ┌─── Effect&lt;number, never, never&gt;//      ▼const success = Effect.succeed(42)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [fail to create an effect that
represents a failure.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[succeed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Hurray!\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[ ]{.indent}[// If fiber1 fails, fiber2 will be used as a
fallback]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.Fiber&lt;string, string&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const orElse: &lt;never, string, string, never&gt;(self: Fiber.Fiber&lt;never, string&gt;, that: Fiber.Fiber&lt;string, never&gt;) =&gt; Fiber.Fiber&lt;string, string&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a fiber that prefers `this` fiber, but falls back to the `that`
one when `this` one fails. Interrupting the returned fiber will
interrupt both fibers, sequentially, from left to right.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[orElse]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber1: Fiber.RuntimeFiber&lt;never, string&gt;</code></pre>
</figure>
:::
::::

[fiber1]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber2: Fiber.RuntimeFiber&lt;string, never&gt;</code></pre>
</figure>
:::
::::

[fiber2]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const message: string</code></pre>
</figure>
:::
::::

[message]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const join: &lt;string, string&gt;(self: Fiber.Fiber&lt;string, string&gt;) =&gt; Effect.Effect&lt;string, string, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Joins the fiber, which suspends the joining fiber until the result of
the fiber has been determined. Attempting to join a fiber that has erred
will result in a catchable error. Joining an interrupted fiber will
result in an \"inner interruption\" of this fiber, unlike interruption
triggered by another fiber, \"inner interruption\" can be caught and
recovered.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[join]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.Fiber&lt;string, string&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

:::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const message: string</code></pre>
</figure>
:::
::::

[message]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

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

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
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
<pre data-language="ts"><code>const runFork: &lt;void, string&gt;(effect: Effect.Effect&lt;void, string, never&gt;, options?: RunForkOptions) =&gt; Fiber.RuntimeFiber&lt;void, string&gt;</code></pre>
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
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, string, never&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[Hurray!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
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
## Lifetime of Child Fibers

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#lifetime-of-child-fibers){.anchor-link
aria-labelledby="lifetime-of-child-fibers"}
:::

When we fork fibers, depending on how we fork them we can have four
different lifetime strategies for the child fibers:

1.  **Fork With Automatic Supervision**. If we use the ordinary
    `Effect.fork`{dir="auto"} operation, the child fiber will be
    automatically supervised by the parent fiber. The lifetime child
    fibers are tied to the lifetime of their parent fiber. This means
    that these fibers will be terminated either when they end naturally,
    or when their parent fiber is terminated.

2.  **Fork in Global Scope (Daemon)**. Sometimes we want to run
    long-running background fibers that aren't tied to their parent
    fiber, and also we want to fork them in a global scope. Any fiber
    that is forked in global scope will become daemon fiber. This can be
    achieved by using the `Effect.forkDaemon`{dir="auto"} operator. As
    these fibers have no parent, they are not supervised, and they will
    be terminated when they end naturally, or when our application is
    terminated.

3.  **Fork in Local Scope**. Sometimes, we want to run a background
    fiber that isn't tied to its parent fiber, but we want to live that
    fiber in the local scope. We can fork fibers in the local scope by
    using `Effect.forkScoped`{dir="auto"}. Such fibers can outlive their
    parent fiber (so they are not supervised by their parents), and they
    will be terminated when their life end or their local scope is
    closed.

4.  **Fork in Specific Scope**. This is similar to the previous
    strategy, but we can have more fine-grained control over the
    lifetime of the child fiber by forking it in a specific scope. We
    can do this by using the `Effect.forkIn`{dir="auto"} operator.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Fork with Automatic Supervision

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#fork-with-automatic-supervision){.anchor-link
aria-labelledby="fork-with-automatic-supervision"}
:::

Effect follows a **structured concurrency** model, where child fibers'
lifetimes are tied to their parent. Simply put, the lifespan of a fiber
depends on the lifespan of its parent fiber.

**Example** (Automatically Supervised Child Fiber)

In this scenario, the `parent`{dir="auto"} fiber spawns a
`child`{dir="auto"} fiber that repeatedly prints a message every second.
The `child`{dir="auto"} fiber will be terminated when the
`parent`{dir="auto"} fiber completes.

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
<pre data-language="ts"><code>import Console</code></pre>
</figure>
:::
::::

[Console]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schedule</code></pre>
</figure>
:::
::::

[Schedule]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Child fiber that logs a message repeatedly every
second]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>const child: Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[child]{style="--0:#005CC5;--1:#79B8FF"}[
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const repeat: &lt;void, never, never, number, never&gt;(self: Effect.Effect&lt;void, never, never&gt;, schedule: Schedule.Schedule&lt;number, void, never&gt;) =&gt; Effect.Effect&lt;number, never, never&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Repeats an effect based on a specified schedule or until the first
failure.

**Details**

This function executes an effect repeatedly according to the given
schedule. Each repetition occurs after the initial execution of the
effect, meaning that the schedule determines the number of additional
repetitions. For example, using `Schedule.once` will result in the
effect being executed twice (once initially and once as part of the
repetition).

If the effect succeeds, it is repeated according to the schedule. If it
fails, the repetition stops immediately, and the failure is returned.

The schedule can also specify delays between repetitions, making it
useful for tasks like retrying operations with backoff, periodic
execution, or performing a series of dependent actions.

You can combine schedules for more advanced repetition logic, such as
adding delays, limiting recursions, or dynamically adjusting based on
the outcome of each execution.

**Example** (Success Example)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Schedule, Console } from &quot;effect&quot;
const action = Console.log(&quot;success&quot;)const policy = Schedule.addDelay(Schedule.recurs(2), () =&gt; &quot;100 millis&quot;)const program = Effect.repeat(action, policy)
Effect.runPromise(program).then((n) =&gt; console.log(`repetitions: ${n}`))</code></pre>
</figure>
:::

**Example** (Failure Example)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Schedule } from &quot;effect&quot;
let count = 0
// Define an async effect that simulates an action with possible failuresconst action = Effect.async&lt;string, string&gt;((resume) =&gt; {  if (count &gt; 1) {    console.log(&quot;failure&quot;)    resume(Effect.fail(&quot;Uh oh!&quot;))  } else {    count++    console.log(&quot;success&quot;)    resume(Effect.succeed(&quot;yay!&quot;))  }})
const policy = Schedule.addDelay(Schedule.recurs(2), () =&gt; &quot;100 millis&quot;)const program = Effect.repeat(action, policy)
Effect.runPromiseExit(program).then(console.log)</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[repeat]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"child:
still
running!\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

:::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schedule</code></pre>
</figure>
:::
::::

[Schedule]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fixed: (interval: DurationInput) =&gt; Schedule.Schedule&lt;number&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a schedule that recurs at a fixed interval.

**Details**

This schedule executes at regular, evenly spaced intervals, returning
the number of times it has run so far. If the action being executed
takes longer than the interval, the next execution will happen
immediately to prevent \"pile-ups,\" ensuring that the schedule remains
consistent without overlapping executions.

::: expressive-code
<figure class="frame">
<pre data-language="text"><code>|-----interval-----|-----interval-----|-----interval-----||---------action--------||action|-----|action|-----------|</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [spaced If you need to run from
the end of the last execution.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fixed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"1
second\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
<pre data-language="ts"><code>const parent: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[parent]{style="--0:#005CC5;--1:#79B8FF"}[
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>globalThis.Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"parent:
started!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[ ]{.indent}[// Child fiber is supervised by the
parent]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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
<pre data-language="ts"><code>const fork: &lt;number, never, never&gt;(self: Effect.Effect&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const child: Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[child]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"3
seconds\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>globalThis.Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"parent:
finished!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
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
<pre data-language="ts"><code>const parent: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[parent]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[parent: started!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[parent: finished!]{style="--0:#616972;--1:#99A0A6"}
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

This behavior can be extended to any level of nested fibers, ensuring a
predictable and controlled fiber lifecycle.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Fork in Global Scope (Daemon)

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#fork-in-global-scope-daemon){.anchor-link
aria-labelledby="fork-in-global-scope-daemon"}
:::

You can create a long-running background fiber using
`Effect.forkDaemon`{dir="auto"}. This type of fiber, known as a daemon
fiber, is not tied to the lifecycle of its parent fiber. Instead, its
lifetime is linked to the global scope. A daemon fiber continues running
even if its parent fiber is terminated and will only stop when the
global scope is closed or the fiber completes naturally.

**Example** (Creating a Daemon Fiber)

This example shows how daemon fibers can continue running in the
background even after the parent fiber has finished.

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
<pre data-language="ts"><code>import Console</code></pre>
</figure>
:::
::::

[Console]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schedule</code></pre>
</figure>
:::
::::

[Schedule]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Daemon fiber that logs a message repeatedly every
second]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>const daemon: Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[daemon]{style="--0:#005CC5;--1:#79B8FF"}[
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const repeat: &lt;void, never, never, number, never&gt;(self: Effect.Effect&lt;void, never, never&gt;, schedule: Schedule.Schedule&lt;number, void, never&gt;) =&gt; Effect.Effect&lt;number, never, never&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Repeats an effect based on a specified schedule or until the first
failure.

**Details**

This function executes an effect repeatedly according to the given
schedule. Each repetition occurs after the initial execution of the
effect, meaning that the schedule determines the number of additional
repetitions. For example, using `Schedule.once` will result in the
effect being executed twice (once initially and once as part of the
repetition).

If the effect succeeds, it is repeated according to the schedule. If it
fails, the repetition stops immediately, and the failure is returned.

The schedule can also specify delays between repetitions, making it
useful for tasks like retrying operations with backoff, periodic
execution, or performing a series of dependent actions.

You can combine schedules for more advanced repetition logic, such as
adding delays, limiting recursions, or dynamically adjusting based on
the outcome of each execution.

**Example** (Success Example)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Schedule, Console } from &quot;effect&quot;
const action = Console.log(&quot;success&quot;)const policy = Schedule.addDelay(Schedule.recurs(2), () =&gt; &quot;100 millis&quot;)const program = Effect.repeat(action, policy)
Effect.runPromise(program).then((n) =&gt; console.log(`repetitions: ${n}`))</code></pre>
</figure>
:::

**Example** (Failure Example)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Schedule } from &quot;effect&quot;
let count = 0
// Define an async effect that simulates an action with possible failuresconst action = Effect.async&lt;string, string&gt;((resume) =&gt; {  if (count &gt; 1) {    console.log(&quot;failure&quot;)    resume(Effect.fail(&quot;Uh oh!&quot;))  } else {    count++    console.log(&quot;success&quot;)    resume(Effect.succeed(&quot;yay!&quot;))  }})
const policy = Schedule.addDelay(Schedule.recurs(2), () =&gt; &quot;100 millis&quot;)const program = Effect.repeat(action, policy)
Effect.runPromiseExit(program).then(console.log)</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[repeat]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"daemon:
still
running!\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

:::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schedule</code></pre>
</figure>
:::
::::

[Schedule]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fixed: (interval: DurationInput) =&gt; Schedule.Schedule&lt;number&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a schedule that recurs at a fixed interval.

**Details**

This schedule executes at regular, evenly spaced intervals, returning
the number of times it has run so far. If the action being executed
takes longer than the interval, the next execution will happen
immediately to prevent \"pile-ups,\" ensuring that the schedule remains
consistent without overlapping executions.

::: expressive-code
<figure class="frame">
<pre data-language="text"><code>|-----interval-----|-----interval-----|-----interval-----||---------action--------||action|-----|action|-----------|</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [spaced If you need to run from
the end of the last execution.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fixed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"1
second\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
<pre data-language="ts"><code>const parent: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[parent]{style="--0:#005CC5;--1:#79B8FF"}[
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>globalThis.Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"parent:
started!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[ ]{.indent}[// Daemon fiber running
independently]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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
<pre data-language="ts"><code>const forkDaemon: &lt;number, never, never&gt;(self: Effect.Effect&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a long-running background fiber that is independent of its
parent.

**Details**

This function creates a \"daemon\" fiber that runs in the background and
is not tied to the lifecycle of its parent fiber. Unlike normal fibers
that stop when the parent fiber terminates, a daemon fiber will continue
running until the global scope closes or the fiber completes naturally.
This makes it useful for tasks that need to run in the background
independently, such as periodic logging, monitoring, or background data
processing.

**Example** (Creating a Daemon Fiber)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console, Schedule } from &quot;effect&quot;
// Daemon fiber that logs a message repeatedly every secondconst daemon = Effect.repeat(  Console.log(&quot;daemon: still running!&quot;),  Schedule.fixed(&quot;1 second&quot;))
const parent = Effect.gen(function* () {  console.log(&quot;parent: started!&quot;)  // Daemon fiber running independently  yield* Effect.forkDaemon(daemon)  yield* Effect.sleep(&quot;3 seconds&quot;)  console.log(&quot;parent: finished!&quot;)})
Effect.runFork(parent)// Output:// parent: started!// daemon: still running!// daemon: still running!// daemon: still running!// parent: finished!// daemon: still running!// daemon: still running!// daemon: still running!// daemon: still running!// daemon: still running!// ...etc...</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[forkDaemon]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const daemon: Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[daemon]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"3
seconds\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>globalThis.Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"parent:
finished!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
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
<pre data-language="ts"><code>const parent: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[parent]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[parent: started!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[parent: finished!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
:::
::::

::: code
[\...etc\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
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

Even if the parent fiber is interrupted, the daemon fiber will continue
running independently.

**Example** (Interrupting the Parent Fiber)

In this example, interrupting the parent fiber doesn't affect the daemon
fiber, which continues to run in the background.

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
<pre data-language="ts"><code>import Console</code></pre>
</figure>
:::
::::

[Console]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schedule</code></pre>
</figure>
:::
::::

[Schedule]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Daemon fiber that logs a message repeatedly every
second]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>const daemon: Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[daemon]{style="--0:#005CC5;--1:#79B8FF"}[
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const repeat: &lt;void, never, never, number, never&gt;(self: Effect.Effect&lt;void, never, never&gt;, schedule: Schedule.Schedule&lt;number, void, never&gt;) =&gt; Effect.Effect&lt;number, never, never&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Repeats an effect based on a specified schedule or until the first
failure.

**Details**

This function executes an effect repeatedly according to the given
schedule. Each repetition occurs after the initial execution of the
effect, meaning that the schedule determines the number of additional
repetitions. For example, using `Schedule.once` will result in the
effect being executed twice (once initially and once as part of the
repetition).

If the effect succeeds, it is repeated according to the schedule. If it
fails, the repetition stops immediately, and the failure is returned.

The schedule can also specify delays between repetitions, making it
useful for tasks like retrying operations with backoff, periodic
execution, or performing a series of dependent actions.

You can combine schedules for more advanced repetition logic, such as
adding delays, limiting recursions, or dynamically adjusting based on
the outcome of each execution.

**Example** (Success Example)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Schedule, Console } from &quot;effect&quot;
const action = Console.log(&quot;success&quot;)const policy = Schedule.addDelay(Schedule.recurs(2), () =&gt; &quot;100 millis&quot;)const program = Effect.repeat(action, policy)
Effect.runPromise(program).then((n) =&gt; console.log(`repetitions: ${n}`))</code></pre>
</figure>
:::

**Example** (Failure Example)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Schedule } from &quot;effect&quot;
let count = 0
// Define an async effect that simulates an action with possible failuresconst action = Effect.async&lt;string, string&gt;((resume) =&gt; {  if (count &gt; 1) {    console.log(&quot;failure&quot;)    resume(Effect.fail(&quot;Uh oh!&quot;))  } else {    count++    console.log(&quot;success&quot;)    resume(Effect.succeed(&quot;yay!&quot;))  }})
const policy = Schedule.addDelay(Schedule.recurs(2), () =&gt; &quot;100 millis&quot;)const program = Effect.repeat(action, policy)
Effect.runPromiseExit(program).then(console.log)</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[repeat]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"daemon:
still
running!\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

:::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schedule</code></pre>
</figure>
:::
::::

[Schedule]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fixed: (interval: DurationInput) =&gt; Schedule.Schedule&lt;number&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a schedule that recurs at a fixed interval.

**Details**

This schedule executes at regular, evenly spaced intervals, returning
the number of times it has run so far. If the action being executed
takes longer than the interval, the next execution will happen
immediately to prevent \"pile-ups,\" ensuring that the schedule remains
consistent without overlapping executions.

::: expressive-code
<figure class="frame">
<pre data-language="text"><code>|-----interval-----|-----interval-----|-----interval-----||---------action--------||action|-----|action|-----------|</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [spaced If you need to run from
the end of the last execution.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fixed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"1
second\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
<pre data-language="ts"><code>const parent: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[parent]{style="--0:#005CC5;--1:#79B8FF"}[
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>globalThis.Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"parent:
started!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[ ]{.indent}[// Daemon fiber running
independently]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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
<pre data-language="ts"><code>const forkDaemon: &lt;number, never, never&gt;(self: Effect.Effect&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a long-running background fiber that is independent of its
parent.

**Details**

This function creates a \"daemon\" fiber that runs in the background and
is not tied to the lifecycle of its parent fiber. Unlike normal fibers
that stop when the parent fiber terminates, a daemon fiber will continue
running until the global scope closes or the fiber completes naturally.
This makes it useful for tasks that need to run in the background
independently, such as periodic logging, monitoring, or background data
processing.

**Example** (Creating a Daemon Fiber)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console, Schedule } from &quot;effect&quot;
// Daemon fiber that logs a message repeatedly every secondconst daemon = Effect.repeat(  Console.log(&quot;daemon: still running!&quot;),  Schedule.fixed(&quot;1 second&quot;))
const parent = Effect.gen(function* () {  console.log(&quot;parent: started!&quot;)  // Daemon fiber running independently  yield* Effect.forkDaemon(daemon)  yield* Effect.sleep(&quot;3 seconds&quot;)  console.log(&quot;parent: finished!&quot;)})
Effect.runFork(parent)// Output:// parent: started!// daemon: still running!// daemon: still running!// daemon: still running!// parent: finished!// daemon: still running!// daemon: still running!// daemon: still running!// daemon: still running!// daemon: still running!// ...etc...</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[forkDaemon]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const daemon: Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[daemon]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"3
seconds\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>globalThis.Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"parent:
finished!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

:::::::::::::::::: code
[}).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const onInterrupt: &lt;void, never&gt;(cleanup: (interruptors: HashSet&lt;FiberId&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, R&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Registers a cleanup effect to run when an effect is interrupted.

**Details**

This function allows you to specify an effect to run when the fiber is
interrupted. This effect will be executed when the fiber is interrupted,
allowing you to perform cleanup or other actions.

**Example** (Running a Cleanup Action on Interruption)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Console, Effect } from &quot;effect&quot;
// This handler is executed when the fiber is interruptedconst handler = Effect.onInterrupt((_fibers) =&gt; Console.log(&quot;Cleanup completed&quot;))
const success = Console.log(&quot;Task completed&quot;).pipe(Effect.as(&quot;some result&quot;), handler)
Effect.runFork(success)// Output:// Task completed
const failure = Console.log(&quot;Task failed&quot;).pipe(Effect.andThen(Effect.fail(&quot;some error&quot;)), handler)
Effect.runFork(failure)// Output:// Task failed
const interruption = Console.log(&quot;Task interrupted&quot;).pipe(Effect.andThen(Effect.interrupt), handler)
Effect.runFork(interruption)// Output:// Task interrupted// Cleanup completed</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[onInterrupt]{style="--0:#6F42C1;--1:#B392F0"}[(()
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"parent:
interrupted!\"]{style="--0:#032F62;--1:#9ECBFF"}[)))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[// Program that interrupts the parent fiber after 2
seconds]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
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

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;void, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const fork: &lt;void, never, never&gt;(self: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;void, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const parent: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[parent]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
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
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"2
seconds\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const interrupt: &lt;void, never&gt;(self: Fiber.Fiber&lt;void, never&gt;) =&gt; Effect.Effect&lt;Exit&lt;void, never&gt;, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Interrupts the fiber from whichever fiber is calling this method. If the
fiber has already exited, the returned effect will resume immediately.
Otherwise, the effect will resume when the fiber exits.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[interrupt]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber: Fiber.RuntimeFiber&lt;void, never&gt;</code></pre>
</figure>
:::
::::

[fiber]{style="--0:#24292E;--1:#E1E4E8"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[// Interrupt the parent
fiber]{style="--0:#616972;--1:#99A0A6"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
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
<pre data-language="ts"><code>const runFork: &lt;void, never&gt;(effect: Effect.Effect&lt;void, never, never&gt;, options?: RunForkOptions) =&gt; Fiber.RuntimeFiber&lt;void, never&gt;</code></pre>
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
25
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
[parent: started!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
:::
::::

::: code
[parent: interrupted!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
[daemon: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

::: code
[\...etc\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
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
### Fork in Local Scope

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#fork-in-local-scope){.anchor-link
aria-labelledby="fork-in-local-scope"}
:::

Sometimes we want to create a fiber that is tied to a local
[scope](../../resource-management/scope/index.html), meaning its
lifetime is not dependent on its parent fiber but is bound to the local
scope in which it was forked. This can be done using the
`Effect.forkScoped`{dir="auto"} operator.

Fibers created with `Effect.forkScoped`{dir="auto"} can outlive their
parent fibers and will only be terminated when the local scope itself is
closed.

**Example** (Forking a Fiber in a Local Scope)

In this example, the `child`{dir="auto"} fiber continues to run beyond
the lifetime of the `parent`{dir="auto"} fiber. The `child`{dir="auto"}
fiber is tied to the local scope and will be terminated only when the
scope ends.

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
<pre data-language="ts"><code>import Console</code></pre>
</figure>
:::
::::

[Console]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schedule</code></pre>
</figure>
:::
::::

[Schedule]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Child fiber that logs a message repeatedly every
second]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>const child: Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[child]{style="--0:#005CC5;--1:#79B8FF"}[
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const repeat: &lt;void, never, never, number, never&gt;(self: Effect.Effect&lt;void, never, never&gt;, schedule: Schedule.Schedule&lt;number, void, never&gt;) =&gt; Effect.Effect&lt;number, never, never&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Repeats an effect based on a specified schedule or until the first
failure.

**Details**

This function executes an effect repeatedly according to the given
schedule. Each repetition occurs after the initial execution of the
effect, meaning that the schedule determines the number of additional
repetitions. For example, using `Schedule.once` will result in the
effect being executed twice (once initially and once as part of the
repetition).

If the effect succeeds, it is repeated according to the schedule. If it
fails, the repetition stops immediately, and the failure is returned.

The schedule can also specify delays between repetitions, making it
useful for tasks like retrying operations with backoff, periodic
execution, or performing a series of dependent actions.

You can combine schedules for more advanced repetition logic, such as
adding delays, limiting recursions, or dynamically adjusting based on
the outcome of each execution.

**Example** (Success Example)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Schedule, Console } from &quot;effect&quot;
const action = Console.log(&quot;success&quot;)const policy = Schedule.addDelay(Schedule.recurs(2), () =&gt; &quot;100 millis&quot;)const program = Effect.repeat(action, policy)
Effect.runPromise(program).then((n) =&gt; console.log(`repetitions: ${n}`))</code></pre>
</figure>
:::

**Example** (Failure Example)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Schedule } from &quot;effect&quot;
let count = 0
// Define an async effect that simulates an action with possible failuresconst action = Effect.async&lt;string, string&gt;((resume) =&gt; {  if (count &gt; 1) {    console.log(&quot;failure&quot;)    resume(Effect.fail(&quot;Uh oh!&quot;))  } else {    count++    console.log(&quot;success&quot;)    resume(Effect.succeed(&quot;yay!&quot;))  }})
const policy = Schedule.addDelay(Schedule.recurs(2), () =&gt; &quot;100 millis&quot;)const program = Effect.repeat(action, policy)
Effect.runPromiseExit(program).then(console.log)</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[repeat]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"child:
still
running!\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

:::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schedule</code></pre>
</figure>
:::
::::

[Schedule]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fixed: (interval: DurationInput) =&gt; Schedule.Schedule&lt;number&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a schedule that recurs at a fixed interval.

**Details**

This schedule executes at regular, evenly spaced intervals, returning
the number of times it has run so far. If the action being executed
takes longer than the interval, the next execution will happen
immediately to prevent \"pile-ups,\" ensuring that the schedule remains
consistent without overlapping executions.

::: expressive-code
<figure class="frame">
<pre data-language="text"><code>|-----interval-----|-----interval-----|-----interval-----||---------action--------||action|-----|action|-----------|</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [spaced If you need to run from
the end of the last execution.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fixed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"1
second\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[// ┌─── Effect\<void, never, Scope\>]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[// ▼]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const parent: Effect.Effect&lt;void, never, Scope&gt;</code></pre>
</figure>
:::
::::

[parent]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;RuntimeFiber&lt;number, never&gt;, never, Scope&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;RuntimeFiber&lt;number, never&gt;, never, Scope&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, Scope&gt; (+1 overload)</code></pre>
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>globalThis.Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"parent:
started!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[ ]{.indent}[// Child fiber attached to local
scope]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
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
<pre data-language="ts"><code>const forkScoped: &lt;number, never, never&gt;(self: Effect.Effect&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;RuntimeFiber&lt;number, never&gt;, never, Scope&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Forks a fiber in a local scope, ensuring it outlives its parent.

**Details**

This function is used to create fibers that are tied to a local scope,
meaning they are not dependent on their parent fiber\'s lifecycle.
Instead, they will continue running until the scope they were created in
is closed. This is particularly useful when you need a fiber to run
independently of the parent fiber, but still want it to be terminated
when the scope ends.

Fibers created with this function are isolated from the parent fiber's
termination, so they can run for a longer period. This behavior is
different from fibers created with

fork

, which are terminated when the parent fiber terminates. With
`forkScoped`, the child fiber will keep running until the local scope
ends, regardless of the state of the parent fiber.

**Example** (Forking a Fiber in a Local Scope)

In this example, the child fiber continues to run beyond the lifetime of
the parent fiber. The child fiber is tied to the local scope and will be
terminated only when the scope ends.

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console, Schedule } from &quot;effect&quot;
// Child fiber that logs a message repeatedly every secondconst child = Effect.repeat(  Console.log(&quot;child: still running!&quot;),  Schedule.fixed(&quot;1 second&quot;))
//      ┌─── Effect&lt;void, never, Scope&gt;//      ▼const parent = Effect.gen(function* () {  console.log(&quot;parent: started!&quot;)  // Child fiber attached to local scope  yield* Effect.forkScoped(child)  yield* Effect.sleep(&quot;3 seconds&quot;)  console.log(&quot;parent: finished!&quot;)})
// Program runs within a local scopeconst program = Effect.scoped(  Effect.gen(function* () {    console.log(&quot;Local scope started!&quot;)    yield* Effect.fork(parent)    // Scope lasts for 5 seconds    yield* Effect.sleep(&quot;5 seconds&quot;)    console.log(&quot;Leaving the local scope!&quot;)  }))
Effect.runFork(program)// Output:// Local scope started!// parent: started!// child: still running!// child: still running!// child: still running!// parent: finished!// child: still running!// child: still running!// Leaving the local scope!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[forkScoped]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const child: Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[child]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"3
seconds\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>globalThis.Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"parent:
finished!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

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
[// Program runs within a local scope]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

:::::::::::: code
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

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const scoped: &lt;void, never, Scope&gt;(effect: Effect.Effect&lt;void, never, Scope&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Scopes all resources used in an effect to the lifetime of the effect.

**Details**

This function ensures that all resources used within an effect are tied
to its lifetime. Finalizers for these resources are executed
automatically when the effect completes, whether through success,
failure, or interruption. This guarantees proper resource cleanup
without requiring explicit management.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[scoped]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::::::::::: code
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;RuntimeFiber&lt;void, never&gt;, never, Scope&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;RuntimeFiber&lt;void, never&gt;, never, Scope&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, Scope&gt; (+1 overload)</code></pre>
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>globalThis.Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Local
scope
started!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
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
<pre data-language="ts"><code>const fork: &lt;void, never, Scope&gt;(self: Effect.Effect&lt;void, never, Scope&gt;) =&gt; Effect.Effect&lt;RuntimeFiber&lt;void, never&gt;, never, Scope&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const parent: Effect.Effect&lt;void, never, Scope&gt;</code></pre>
</figure>
:::
::::

[parent]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[ ]{.indent}[// Scope lasts for 5
seconds]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"5
seconds\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>globalThis.Console.log(message?: any, ...optionalParams: any[]): void</code></pre>
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Leaving
the local
scope!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
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
28
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
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
31
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
:::
::::

::: code
[Local scope started!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
:::
::::

::: code
[parent: started!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[parent: finished!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
41
:::
::::

::: code
[Leaving the local scope!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
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
### Fork in Specific Scope

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#fork-in-specific-scope){.anchor-link
aria-labelledby="fork-in-specific-scope"}
:::

There are some cases where we need more fine-grained control, so we want
to fork a fiber in a specific scope. We can use the
`Effect.forkIn`{dir="auto"} operator which takes the target scope as an
argument.

**Example** (Forking a Fiber in a Specific Scope)

In this example, the `child`{dir="auto"} fiber is forked into the
`outerScope`{dir="auto"}, allowing it to outlive the inner scope but
still be terminated when the `outerScope`{dir="auto"} is closed.

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Console</code></pre>
</figure>
:::

[Console]{style="--0:#24292E;--1:#E1E4E8"}[,
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

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schedule</code></pre>
</figure>
:::
::::

[Schedule]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Child fiber that logs a message repeatedly every
second]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>const child: Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[child]{style="--0:#005CC5;--1:#79B8FF"}[
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const repeat: &lt;void, never, never, number, never&gt;(self: Effect.Effect&lt;void, never, never&gt;, schedule: Schedule.Schedule&lt;number, void, never&gt;) =&gt; Effect.Effect&lt;number, never, never&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Repeats an effect based on a specified schedule or until the first
failure.

**Details**

This function executes an effect repeatedly according to the given
schedule. Each repetition occurs after the initial execution of the
effect, meaning that the schedule determines the number of additional
repetitions. For example, using `Schedule.once` will result in the
effect being executed twice (once initially and once as part of the
repetition).

If the effect succeeds, it is repeated according to the schedule. If it
fails, the repetition stops immediately, and the failure is returned.

The schedule can also specify delays between repetitions, making it
useful for tasks like retrying operations with backoff, periodic
execution, or performing a series of dependent actions.

You can combine schedules for more advanced repetition logic, such as
adding delays, limiting recursions, or dynamically adjusting based on
the outcome of each execution.

**Example** (Success Example)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Schedule, Console } from &quot;effect&quot;
const action = Console.log(&quot;success&quot;)const policy = Schedule.addDelay(Schedule.recurs(2), () =&gt; &quot;100 millis&quot;)const program = Effect.repeat(action, policy)
Effect.runPromise(program).then((n) =&gt; console.log(`repetitions: ${n}`))</code></pre>
</figure>
:::

**Example** (Failure Example)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Schedule } from &quot;effect&quot;
let count = 0
// Define an async effect that simulates an action with possible failuresconst action = Effect.async&lt;string, string&gt;((resume) =&gt; {  if (count &gt; 1) {    console.log(&quot;failure&quot;)    resume(Effect.fail(&quot;Uh oh!&quot;))  } else {    count++    console.log(&quot;success&quot;)    resume(Effect.succeed(&quot;yay!&quot;))  }})
const policy = Schedule.addDelay(Schedule.recurs(2), () =&gt; &quot;100 millis&quot;)const program = Effect.repeat(action, policy)
Effect.runPromiseExit(program).then(console.log)</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[repeat]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"child:
still
running!\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

:::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schedule</code></pre>
</figure>
:::
::::

[Schedule]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fixed: (interval: DurationInput) =&gt; Schedule.Schedule&lt;number&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a schedule that recurs at a fixed interval.

**Details**

This schedule executes at regular, evenly spaced intervals, returning
the number of times it has run so far. If the action being executed
takes longer than the interval, the next execution will happen
immediately to prevent \"pile-ups,\" ensuring that the schedule remains
consistent without overlapping executions.

::: expressive-code
<figure class="frame">
<pre data-language="text"><code>|-----interval-----|-----interval-----|-----interval-----||---------action--------||action|-----|action|-----------|</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [spaced If you need to run from
the end of the last execution.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fixed]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"1
second\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

:::::::::::: code
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

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const scoped: &lt;void, never, Scope&gt;(effect: Effect.Effect&lt;void, never, Scope&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Scopes all resources used in an effect to the lifetime of the effect.

**Details**

This function ensures that all resources used within an effect are tied
to its lifetime. Finalizers for these resources are executed
automatically when the effect completes, whether through success,
failure, or interruption. This guarantees proper resource cleanup
without requiring explicit management.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[scoped]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::::::: code
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;void, never, Scope&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;void, never, Scope&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, Scope&gt; (+1 overload)</code></pre>
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

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
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

::::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const addFinalizer: &lt;void, never&gt;(finalizer: (exit: Exit&lt;unknown, unknown&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, Scope&gt;</code></pre>
</figure>
:::

:::::: twoslash-popup-docs
Ensures a finalizer is added to the scope of the calling effect,
guaranteeing it runs when the scope is closed.

**Details**

This function adds a finalizer that will execute whenever the scope of
the effect is closed, regardless of whether the effect succeeds, fails,
or is interrupted. The finalizer receives the `Exit` value of the
effect\'s scope, allowing it to react differently depending on how the
effect concludes.

Finalizers are a reliable way to manage resource cleanup, ensuring that
resources such as file handles, network connections, or database
transactions are properly closed even in the event of an unexpected
interruption or error.

Finalizers operate in conjunction with Effect\'s scoped resources. If an
effect with a finalizer is wrapped in a scope, the finalizer will
execute automatically when the scope ends.

**Example** (Adding a Finalizer on Success)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
//      ┌─── Effect&lt;string, never, Scope&gt;//      ▼const program = Effect.gen(function* () {  yield* Effect.addFinalizer((exit) =&gt;    Console.log(`Finalizer executed. Exit status: ${exit._tag}`)  )  return &quot;some result&quot;})
// Wrapping the effect in a scope////      ┌─── Effect&lt;string, never, never&gt;//      ▼const runnable = Effect.scoped(program)
Effect.runPromiseExit(runnable).then(console.log)// Output:// Finalizer executed. Exit status: Success// { _id: &#39;Exit&#39;, _tag: &#39;Success&#39;, value: &#39;some result&#39; }</code></pre>
</figure>
:::

**Example** (Adding a Finalizer on Failure)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
//      ┌─── Effect&lt;never, string, Scope&gt;//      ▼const program = Effect.gen(function* () {  yield* Effect.addFinalizer((exit) =&gt;    Console.log(`Finalizer executed. Exit status: ${exit._tag}`)  )  return yield* Effect.fail(&quot;Uh oh!&quot;)})
// Wrapping the effect in a scope////      ┌─── Effect&lt;never, string, never&gt;//      ▼const runnable = Effect.scoped(program)
Effect.runPromiseExit(runnable).then(console.log)// Output:// Finalizer executed. Exit status: Failure// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Failure&#39;,//   cause: { _id: &#39;Cause&#39;, _tag: &#39;Fail&#39;, failure: &#39;Uh oh!&#39; }// }</code></pre>
</figure>
:::

**Example** (Adding a Finalizer on Interruption)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
//      ┌─── Effect&lt;never, never, Scope&gt;//      ▼const program = Effect.gen(function* () {  yield* Effect.addFinalizer((exit) =&gt;    Console.log(`Finalizer executed. Exit status: ${exit._tag}`)  )  return yield* Effect.interrupt})
// Wrapping the effect in a scope////      ┌─── Effect&lt;never, never, never&gt;//      ▼const runnable = Effect.scoped(program)
Effect.runPromiseExit(runnable).then(console.log)// Output:// Finalizer executed. Exit status: Failure// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Failure&#39;,//   cause: {//     _id: &#39;Cause&#39;,//     _tag: &#39;Interrupt&#39;,//     fiberId: {//       _id: &#39;FiberId&#39;,//       _tag: &#39;Runtime&#39;,//       id: 0,//       startTimeMillis: ...//     }//   }// }</code></pre>
</figure>
:::
::::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [onExit for attaching a
finalizer directly to an effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::::

[addFinalizer]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
:::::::::::::
::::::::::::::::

::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"The
outer scope is about to be
closed!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
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
[ ]{.indent}[// Capture the outer
scope]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

:::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const outerScope: Scope</code></pre>
</figure>
:::
::::

[outerScope]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const scope: Effect.Effect&lt;Scope, never, Scope&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Provides access to the current scope in a scoped workflow.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[scope]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

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
[ ]{.indent}[// Create an inner scope]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

:::::::::: code
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

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const scoped: &lt;void, never, Scope&gt;(effect: Effect.Effect&lt;void, never, Scope&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Scopes all resources used in an effect to the lifetime of the effect.

**Details**

This function ensures that all resources used within an effect are tied
to its lifetime. Finalizers for these resources are executed
automatically when the effect completes, whether through success,
failure, or interruption. This guarantees proper resource cleanup
without requiring explicit management.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[scoped]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::::::::::: code
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;void, never, Scope&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;void, never, Scope&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, Scope&gt; (+1 overload)</code></pre>
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

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
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

::::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const addFinalizer: &lt;void, never&gt;(finalizer: (exit: Exit&lt;unknown, unknown&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, Scope&gt;</code></pre>
</figure>
:::

:::::: twoslash-popup-docs
Ensures a finalizer is added to the scope of the calling effect,
guaranteeing it runs when the scope is closed.

**Details**

This function adds a finalizer that will execute whenever the scope of
the effect is closed, regardless of whether the effect succeeds, fails,
or is interrupted. The finalizer receives the `Exit` value of the
effect\'s scope, allowing it to react differently depending on how the
effect concludes.

Finalizers are a reliable way to manage resource cleanup, ensuring that
resources such as file handles, network connections, or database
transactions are properly closed even in the event of an unexpected
interruption or error.

Finalizers operate in conjunction with Effect\'s scoped resources. If an
effect with a finalizer is wrapped in a scope, the finalizer will
execute automatically when the scope ends.

**Example** (Adding a Finalizer on Success)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
//      ┌─── Effect&lt;string, never, Scope&gt;//      ▼const program = Effect.gen(function* () {  yield* Effect.addFinalizer((exit) =&gt;    Console.log(`Finalizer executed. Exit status: ${exit._tag}`)  )  return &quot;some result&quot;})
// Wrapping the effect in a scope////      ┌─── Effect&lt;string, never, never&gt;//      ▼const runnable = Effect.scoped(program)
Effect.runPromiseExit(runnable).then(console.log)// Output:// Finalizer executed. Exit status: Success// { _id: &#39;Exit&#39;, _tag: &#39;Success&#39;, value: &#39;some result&#39; }</code></pre>
</figure>
:::

**Example** (Adding a Finalizer on Failure)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
//      ┌─── Effect&lt;never, string, Scope&gt;//      ▼const program = Effect.gen(function* () {  yield* Effect.addFinalizer((exit) =&gt;    Console.log(`Finalizer executed. Exit status: ${exit._tag}`)  )  return yield* Effect.fail(&quot;Uh oh!&quot;)})
// Wrapping the effect in a scope////      ┌─── Effect&lt;never, string, never&gt;//      ▼const runnable = Effect.scoped(program)
Effect.runPromiseExit(runnable).then(console.log)// Output:// Finalizer executed. Exit status: Failure// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Failure&#39;,//   cause: { _id: &#39;Cause&#39;, _tag: &#39;Fail&#39;, failure: &#39;Uh oh!&#39; }// }</code></pre>
</figure>
:::

**Example** (Adding a Finalizer on Interruption)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
//      ┌─── Effect&lt;never, never, Scope&gt;//      ▼const program = Effect.gen(function* () {  yield* Effect.addFinalizer((exit) =&gt;    Console.log(`Finalizer executed. Exit status: ${exit._tag}`)  )  return yield* Effect.interrupt})
// Wrapping the effect in a scope////      ┌─── Effect&lt;never, never, never&gt;//      ▼const runnable = Effect.scoped(program)
Effect.runPromiseExit(runnable).then(console.log)// Output:// Finalizer executed. Exit status: Failure// {//   _id: &#39;Exit&#39;,//   _tag: &#39;Failure&#39;,//   cause: {//     _id: &#39;Cause&#39;,//     _tag: &#39;Interrupt&#39;,//     fiberId: {//       _id: &#39;FiberId&#39;,//       _tag: &#39;Runtime&#39;,//       id: 0,//       startTimeMillis: ...//     }//   }// }</code></pre>
</figure>
:::
::::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [onExit for attaching a
finalizer directly to an effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::::

[addFinalizer]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
:::::::::::::
::::::::::::::::

::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"The
inner scope is about to be
closed!\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
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
24
:::
::::

::: code
[ ]{.indent}[// Fork the child fiber in the outer
scope]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::::::::::::::: code
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
<pre data-language="ts"><code>const forkIn: &lt;number, never, never&gt;(self: Effect.Effect&lt;number, never, never&gt;, scope: Scope) =&gt; Effect.Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Forks an effect in a specific scope, allowing finer control over its
execution.

**Details**

There are some cases where we need more fine-grained control, so we want
to fork a fiber in a specific scope. We can use the `Effect.forkIn`
operator which takes the target scope as an argument.

The fiber will be interrupted when the scope is closed.

**Example** (Forking a Fiber in a Specific Scope)

In this example, the child fiber is forked into the outerScope, allowing
it to outlive the inner scope but still be terminated when the
outerScope is closed.

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Console, Effect, Schedule } from &quot;effect&quot;
// Child fiber that logs a message repeatedly every secondconst child = Effect.repeat(  Console.log(&quot;child: still running!&quot;),  Schedule.fixed(&quot;1 second&quot;))
const program = Effect.scoped(  Effect.gen(function* () {    yield* Effect.addFinalizer(() =&gt;      Console.log(&quot;The outer scope is about to be closed!&quot;)    )
    // Capture the outer scope    const outerScope = yield* Effect.scope
    // Create an inner scope    yield* Effect.scoped(      Effect.gen(function* () {        yield* Effect.addFinalizer(() =&gt;          Console.log(&quot;The inner scope is about to be closed!&quot;)        )        // Fork the child fiber in the outer scope        yield* Effect.forkIn(child, outerScope)        yield* Effect.sleep(&quot;3 seconds&quot;)      })    )
    yield* Effect.sleep(&quot;5 seconds&quot;)  }))
Effect.runFork(program)// Output:// child: still running!// child: still running!// child: still running!// The inner scope is about to be closed!// child: still running!// child: still running!// child: still running!// child: still running!// child: still running!// child: still running!// The outer scope is about to be closed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[forkIn]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const child: Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[child]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const outerScope: Scope</code></pre>
</figure>
:::
::::

[outerScope]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
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
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"3
seconds\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
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
28
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
29
:::
::::

::: code
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
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
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"5
seconds\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
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
32
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
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
35
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
:::
::::

::: code
[The inner scope is about to be
closed!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
41
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
43
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
44
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
45
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
46
:::
::::

::: code
[child: still running!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
47
:::
::::

::: code
[The outer scope is about to be
closed!]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
48
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
## When do Fibers run?

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#when-do-fibers-run){.anchor-link
aria-labelledby="when-do-fibers-run"}
:::

Forked fibers begin execution after the current fiber completes or
yields.

**Example** (Late Fiber Start Captures Only One Value)

In the following example, the `changes`{dir="auto"} stream only captures
a single value, `2`{dir="auto"}. This happens because the fiber created
by `Effect.fork`{dir="auto"} starts **after** the value is updated.

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
<pre data-language="ts"><code>import SubscriptionRef</code></pre>
</figure>
:::
::::

[SubscriptionRef]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Stream</code></pre>
</figure>
:::
::::

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[,
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
4
:::
::::

::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ref: SubscriptionRef.SubscriptionRef&lt;number&gt;</code></pre>
</figure>
:::
::::

[ref]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import SubscriptionRef</code></pre>
</figure>
:::
::::

[SubscriptionRef]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;number&gt;(value: number) =&gt; Effect.Effect&lt;SubscriptionRef.SubscriptionRef&lt;number&gt;, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a new `SubscriptionRef` with the specified value.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[0]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

:::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ref: SubscriptionRef.SubscriptionRef&lt;number&gt;</code></pre>
</figure>
:::
::::

[ref]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>SubscriptionRef&lt;number&gt;.changes: Stream.Stream&lt;number, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A stream containing the current value of the `Ref` as well as all
changes to that value.
:::
:::::

[changes]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Stream.Stream&lt;number, never, never&gt;, Stream.Stream&lt;number, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;RuntimeFiber&lt;void, never&gt;, never, never&gt;&gt;(this: Stream.Stream&lt;...&gt;, ab: (_: Stream.Stream&lt;number, never, never&gt;) =&gt; Stream.Stream&lt;number, never, never&gt;, bc: (_: Stream.Stream&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;, cd: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;RuntimeFiber&lt;void, never&gt;, never, never&gt;): Effect.Effect&lt;...&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[ ]{.indent}[// Log each change in
SubscriptionRef]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Stream</code></pre>
</figure>
:::
::::

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const tap: &lt;number, void, never, never&gt;(f: (a: number) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Stream.Stream&lt;number, E, R&gt;) =&gt; Stream.Stream&lt;number, E, R&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Adds an effect to consumption of every element of the stream.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Console, Effect, Stream } from &quot;effect&quot;
const stream = Stream.make(1, 2, 3).pipe(  Stream.tap((n) =&gt; Console.log(`before mapping: ${n}`)),  Stream.map((n) =&gt; n * 2),  Stream.tap((n) =&gt; Console.log(`after mapping: ${n}`)))
Effect.runPromise(Stream.runCollect(stream)).then(console.log)// before mapping: 1// after mapping: 2// before mapping: 2// after mapping: 4// before mapping: 3// after mapping: 6// { _id: &#39;Chunk&#39;, values: [ 2, 4, 6 ] }</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[tap]{style="--0:#6F42C1;--1:#B392F0"}[((]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#AE4B07;--1:#FFAB70"}[)
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`SubscriptionRef
changed to
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[)),]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::
::::::::::::::::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Stream</code></pre>
</figure>
:::
::::

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runDrain: &lt;A, E, R&gt;(self: Stream.Stream&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Runs the stream only for its effects. The emitted elements are
discarded.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[runDrain]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[ ]{.indent}[// Fork a fiber to run the
stream]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::::::: code
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
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fork: &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;RuntimeFiber&lt;A, E&gt;, never, R&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

:::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import SubscriptionRef</code></pre>
</figure>
:::
::::

[SubscriptionRef]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const set: &lt;number&gt;(self: SubscriptionRef.SubscriptionRef&lt;number&gt;, value: number) =&gt; Effect.Effect&lt;void&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[set]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ref: SubscriptionRef.SubscriptionRef&lt;number&gt;</code></pre>
</figure>
:::
::::

[ref]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

:::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import SubscriptionRef</code></pre>
</figure>
:::
::::

[SubscriptionRef]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const set: &lt;number&gt;(self: SubscriptionRef.SubscriptionRef&lt;number&gt;, value: number) =&gt; Effect.Effect&lt;void&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[set]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ref: SubscriptionRef.SubscriptionRef&lt;number&gt;</code></pre>
</figure>
:::
::::

[ref]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
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
17
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[SubscriptionRef changed to 2]{style="--0:#616972;--1:#99A0A6"}
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

If you add a short delay with `Effect.sleep()`{dir="auto"} or call
`Effect.yieldNow()`{dir="auto"}, you allow the current fiber to yield.
This gives the forked fiber enough time to start and collect all values
before they are updated.

![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9InN0YXJsaWdodC1hc2lkZV9faWNvbiBhc3Ryby00cmd5N2NycCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Ym94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciIgc3R5bGU9Ii0tc2wtaWNvbi1zaXplOiAxZW07Ij48cGF0aCBkPSJNMTIgMTZhMSAxIDAgMSAwIDAgMiAxIDEgMCAwIDAgMC0yWm0xMC42NyAxLjQ3LTguMDUtMTRhMyAzIDAgMCAwLTUuMjQgMGwtOCAxNEEzIDMgMCAwIDAgMy45NCAyMmgxNi4xMmEzIDMgMCAwIDAgMi42MS00LjUzWm0tMS43MyAyYTEgMSAwIDAgMS0uODguNTFIMy45NGExIDEgMCAwIDEtLjg4LS41MSAxIDEgMCAwIDEgMC0xbDgtMTRhMSAxIDAgMCAxIDEuNzggMGw4LjA1IDE0YTEgMSAwIDAgMSAuMDUgMS4wMnYtLjAyWk0xMiA4YTEgMSAwIDAgMC0xIDF2NGExIDEgMCAwIDAgMiAwVjlhMSAxIDAgMCAwLTEtMVoiIC8+PC9zdmc+){.starlight-aside__icon
.astro-4rgy7crp} Fiber Execution is Non-Deterministic

::: starlight-aside__content
Keep in mind that the timing of fiber execution is not deterministic,
and many factors can affect when a fiber starts. Do not rely on the idea
that a single yield always ensures your fiber begins at a particular
time.
:::

**Example** (Delay Allows Fiber to Capture All Values)

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
<pre data-language="ts"><code>import SubscriptionRef</code></pre>
</figure>
:::
::::

[SubscriptionRef]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Stream</code></pre>
</figure>
:::
::::

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[,
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
4
:::
::::

::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ref: SubscriptionRef.SubscriptionRef&lt;number&gt;</code></pre>
</figure>
:::
::::

[ref]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import SubscriptionRef</code></pre>
</figure>
:::
::::

[SubscriptionRef]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;number&gt;(value: number) =&gt; Effect.Effect&lt;SubscriptionRef.SubscriptionRef&lt;number&gt;, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a new `SubscriptionRef` with the specified value.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[0]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

:::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ref: SubscriptionRef.SubscriptionRef&lt;number&gt;</code></pre>
</figure>
:::
::::

[ref]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>SubscriptionRef&lt;number&gt;.changes: Stream.Stream&lt;number, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A stream containing the current value of the `Ref` as well as all
changes to that value.
:::
:::::

[changes]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Stream.Stream&lt;number, never, never&gt;, Stream.Stream&lt;number, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;RuntimeFiber&lt;void, never&gt;, never, never&gt;&gt;(this: Stream.Stream&lt;...&gt;, ab: (_: Stream.Stream&lt;number, never, never&gt;) =&gt; Stream.Stream&lt;number, never, never&gt;, bc: (_: Stream.Stream&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;, cd: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;RuntimeFiber&lt;void, never&gt;, never, never&gt;): Effect.Effect&lt;...&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[ ]{.indent}[// Log each change in
SubscriptionRef]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Stream</code></pre>
</figure>
:::
::::

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const tap: &lt;number, void, never, never&gt;(f: (a: number) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Stream.Stream&lt;number, E, R&gt;) =&gt; Stream.Stream&lt;number, E, R&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Adds an effect to consumption of every element of the stream.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Console, Effect, Stream } from &quot;effect&quot;
const stream = Stream.make(1, 2, 3).pipe(  Stream.tap((n) =&gt; Console.log(`before mapping: ${n}`)),  Stream.map((n) =&gt; n * 2),  Stream.tap((n) =&gt; Console.log(`after mapping: ${n}`)))
Effect.runPromise(Stream.runCollect(stream)).then(console.log)// before mapping: 1// after mapping: 2// before mapping: 2// after mapping: 4// before mapping: 3// after mapping: 6// { _id: &#39;Chunk&#39;, values: [ 2, 4, 6 ] }</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[tap]{style="--0:#6F42C1;--1:#B392F0"}[((]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#AE4B07;--1:#FFAB70"}[)
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`SubscriptionRef
changed to
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[)),]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::
::::::::::::::::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Stream</code></pre>
</figure>
:::
::::

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runDrain: &lt;A, E, R&gt;(self: Stream.Stream&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Runs the stream only for its effects. The emitted elements are
discarded.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[runDrain]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[ ]{.indent}[// Fork a fiber to run the
stream]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::::::: code
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
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fork: &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;RuntimeFiber&lt;A, E&gt;, never, R&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a new fiber to run an effect concurrently.

**Details**

This function takes an effect and forks it into a separate fiber,
allowing it to run concurrently without blocking the original effect.
The new fiber starts execution immediately after being created, and the
fiber object is returned immediately without waiting for the effect to
begin. This is useful when you want to run tasks concurrently while
continuing other tasks in the parent fiber.

The forked fiber is attached to the parent fiber\'s scope. This means
that when the parent fiber terminates, the child fiber will also be
terminated automatically. This feature, known as \"auto supervision,\"
ensures that no fibers are left running unintentionally. If you prefer
not to have this auto supervision behavior, you can use

forkDaemon

or

forkIn

.

**When to Use**

Use this function when you need to run an effect concurrently without
blocking the current execution flow. For example, you might use it to
launch background tasks or concurrent computations. However, working
with fibers can be complex, so before using this function directly, you
might want to explore higher-level functions like

raceWith

,

zip

, or others that can manage concurrency for you.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  n &lt; 2    ? Effect.succeed(n)    : Effect.zipWith(fib(n - 1), fib(n - 2), (a, b) =&gt; a + b)
//      ┌─── Effect&lt;RuntimeFiber&lt;number, never&gt;, never, never&gt;//      ▼const fib10Fiber = Effect.fork(fib(10))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [forkWithErrorHandler for a
version that allows you to handle
errors.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[fork]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
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
12
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[ ]{.indent}[// Allow the fiber a chance to
start]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: {.ec-line .highlight .ins}
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#8f2731;--1:#fb9fa9"}[
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
style="--0:#5c37a0;--1:#c6adf4"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Suspends the execution of an effect for a specified `Duration`.

**Details**

This function pauses the execution of an effect for a given duration. It
is asynchronous, meaning that it does not block the fiber executing the
effect. Instead, the fiber is suspended during the delay period and can
resume once the specified time has passed.

The duration can be specified using various formats supported by the
`Duration` module, such as a string (`"2 seconds"`) or numeric value
representing milliseconds.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const program = Effect.gen(function*() {  console.log(&quot;Starting task...&quot;)  yield* Effect.sleep(&quot;3 seconds&quot;) // Waits for 3 seconds  console.log(&quot;Task completed!&quot;)})
Effect.runFork(program)// Output:// Starting task...// Task completed!</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[sleep]{style="--0:#5c37a0;--1:#c6adf4"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"100
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

:::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import SubscriptionRef</code></pre>
</figure>
:::
::::

[SubscriptionRef]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const set: &lt;number&gt;(self: SubscriptionRef.SubscriptionRef&lt;number&gt;, value: number) =&gt; Effect.Effect&lt;void&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[set]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ref: SubscriptionRef.SubscriptionRef&lt;number&gt;</code></pre>
</figure>
:::
::::

[ref]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

:::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import SubscriptionRef</code></pre>
</figure>
:::
::::

[SubscriptionRef]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const set: &lt;number&gt;(self: SubscriptionRef.SubscriptionRef&lt;number&gt;, value: number) =&gt; Effect.Effect&lt;void&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[set]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ref: SubscriptionRef.SubscriptionRef&lt;number&gt;</code></pre>
</figure>
:::
::::

[ref]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
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
21
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
[SubscriptionRef changed to 0]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[SubscriptionRef changed to 1]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
[SubscriptionRef changed to 2]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
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
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/concurrency/fibers.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Basic Concurrency]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../basic-concurrency/index.html){.astro-u5aomj4k
rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[Deferred]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../deferred/index.html){.astro-u5aomj4k rel="next"}
:::
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
