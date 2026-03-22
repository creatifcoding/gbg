::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Tracing in Effect {#_top .astro-np5lzwrf}
:::
::::

:::::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::::: sl-markdown-content
Although logs and metrics are useful to understand the behavior of
individual services, they are not enough to provide a complete overview
of the lifetime of a request in a distributed system.

In a distributed system, a request can span multiple services and each
service can make multiple requests to other services to fulfill the
request. In such a scenario, we need to have a way to track the lifetime
of a request across multiple services to diagnose what services are the
bottlenecks and where the request is spending most of its time.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Spans

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#spans){.anchor-link
aria-labelledby="spans"}
:::

A **span** represents a single unit of work or operation within a
request. It provides a detailed view of what happened during the
execution of that specific operation.

Each span typically contains the following information:

  Span Component     Description
  ------------------ --------------------------------------------------------------------
  **Name**           Describes the specific operation being tracked.
  **Timing Data**    Timestamps indicating when the operation started and its duration.
  **Log Messages**   Structured logs capturing important events during the operation.
  **Attributes**     Metadata providing additional context about the operation.

Spans are key building blocks in tracing, helping you visualize and
understand the flow of requests through various services.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Traces

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#traces){.anchor-link
aria-labelledby="traces"}
:::

A trace records the paths taken by requests (made by an application or
end-user) as they propagate through multi-service architectures, like
microservice and serverless applications.

Without tracing, it is challenging to pinpoint the cause of performance
problems in a distributed system.

A trace is made of one or more spans. The first span represents the root
span. Each root span represents a request from start to finish. The
spans underneath the parent provide a more in-depth context of what
occurs during a request (or what steps make up a request).

Many Observability back-ends visualize traces as waterfall diagrams that
may look something like this:

![Trace Waterfall
Diagram](../../../_astro/waterfall-trace.D-kl3X6d_Z1sUUey.svg "An image displaying an application trace visualized as a waterfall diagram"){loading="lazy"
decoding="async" fetchpriority="auto" width="1180" height="751"}

Waterfall diagrams show the parent-child relationship between a root
span and its child spans. When a span encapsulates another span, this
also represents a nested relationship.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Creating Spans

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#creating-spans){.anchor-link
aria-labelledby="creating-spans"}
:::

You can add tracing to an effect by creating a span using the
`Effect.withSpan`{dir="auto"} API. This helps you track specific
operations within the effect.

**Example** (Adding a Span to an Effect)

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

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::::::
::::::::::

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
[// Define an effect that delays for 100
milliseconds]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

:::::::::::::::::::::: code
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
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const void: Effect.Effect&lt;void, never, never&gt;export void</code></pre>
</figure>
:::

::: twoslash-popup-docs
Represents an effect that does nothing and produces no value.

**When to Use**

Use this effect when you need to represent an effect that does nothing.
This is useful in scenarios where you need to satisfy an effect-based
interface or control program flow without performing any operations. For
example, it can be used in situations where you want to return an effect
from a function but do not need to compute or return any result.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[void]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

[delay]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"100
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::
:::::::::::::::::::::::::

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
[// Instrument the effect with a span for
tracing]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

:::::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const instrumented: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[instrumented]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const withSpan: (name: string, options?: SpanOptions | undefined) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, ParentSpan&gt;&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Wraps the effect with a new span for tracing.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[withSpan]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"myspan\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

Instrumenting an effect with a span does not change its type. If you
start with an `Effect<A, E, R>`{dir="auto"}, the result remains an
`Effect<A, E, R>`{dir="auto"}.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Printing Spans

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#printing-spans){.anchor-link
aria-labelledby="printing-spans"}
:::

To print spans for debugging or analysis, you'll need to install the
required tracing tools. Here's how to set them up for your project.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Installing Dependencies

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#installing-dependencies){.anchor-link
aria-labelledby="installing-dependencies"}
:::

Choose your package manager and install the necessary libraries:

::: {.tablist-wrapper .not-content .astro-5yo7dsk7}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0yNCA3LjI5NkwwIDcuMjk2TDAgMTUuMjk2TDYuODE2IDE1LjI5Nkw2LjgxNiAxNi43MDRMMTIuMDk2IDE2LjcwNEwxMi4wOTYgMTUuMzkyTDI0IDE1LjM5MkwyNCA3LjI5NlpNNi41OTIgOC43MDRMNi41OTIgMTMuOTg0TDUuMzEyIDEzLjk4NEw1LjMxMiAxMC4xMTJMNCAxMC4xMTJMNCAxMy45ODRMMS4zMTIgMTMuOTg0TDEuMzEyIDguNzA0TDYuNTkyIDguNzA0Wk0xMy4xODQgMTMuOTg0TDEzLjIxNiAxMy45ODRMMTAuNDk2IDEzLjk4NEwxMC40OTYgMTUuMzkyTDcuODA4IDE1LjM5Mkw3LjgwOCA4LjgwMEwxMy4wODggOC44MDBRMTMuMjE2IDEwLjQwMCAxMy4xODQgMTMuOTg0TDEzLjE4NCAxMy45ODRaTTIyLjU5MiA4LjcwNEwyMi41OTIgMTMuOTg0TDIxLjMxMiAxMy45ODRMMjEuMzEyIDEwLjExMkwyMCAxMC4xMTJMMjAgMTMuOTg0TDE4LjU5MiAxMy45ODRMMTguNTkyIDEwLjExMkwxNy4zMTIgMTAuMTEyTDE3LjMxMiAxMy45ODRMMTQuNTkyIDEzLjk4NEwxNC41OTIgOC43MDRMMjIuNTkyIDguNzA0Wk0xMS45MDQgMTIuNzA0TDExLjkwNCAxMC4xMTJMMTAuNTkyIDEwLjExMkwxMC41OTIgMTIuNzA0TDExLjkwNCAxMi43MDRaIiAvPjwvc3ZnPg==){.astro-5yo7dsk7
  .astro-4rgy7crp} npm](index.html#tab-panel-145){#tab-145
  .astro-5yo7dsk7 role="tab" aria-selected="true" tabindex="0"}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0wIDB2Ny41aDcuNVYwSDBabTguMjUgMHY3LjVoNy40OThWMEg4LjI1Wm04LjI1IDB2Ny41SDI0VjBoLTcuNVpNOC4yNSA4LjI1djcuNWg3LjQ5OHYtNy41SDguMjVabTguMjUgMHY3LjVIMjR2LTcuNWgtNy41Wk0wIDE2LjVWMjRoNy41di03LjVIMFptOC4yNSAwVjI0aDcuNDk4di03LjVIOC4yNVptOC4yNSAwVjI0SDI0di03LjVoLTcuNVoiIC8+PC9zdmc+){.astro-5yo7dsk7
  .astro-4rgy7crp} pnpm](index.html#tab-panel-146){#tab-146
  .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik02LjcyOSAyMS41NDVMNi43MjkgMjEuNTQ1UTYuMzkzIDIxLjM3NyA2LjIyNSAyMS4wNDFMNi4yMjUgMjEuMDQxUTYuMDk5IDIwLjkxNSA2LjA3OCAyMC45MTVRNi4wNTcgMjAuOTE1IDUuOTczIDIxLjA0MVE1Ljg4OSAyMS4xNjcgNS44MjYgMjEuNDE5UTUuNzYzIDIxLjY3MSA1LjY3OSAyMS44MzlMNS42NzkgMjEuODM5UTUuMzg1IDIyLjgwNSA0LjgzOSAyMy4xNDFRNC4yOTMgMjMuNDc3IDMuMzI3IDIzLjI2N0wzLjMyNyAyMy4yNjdRMy4wNzUgMjMuMjY3IDIuNTI5IDIzLjAxNUwyLjUyOSAyMy4wMTVRMS43MzEgMjIuNTk1IDIuMTUxIDIxLjgzOUwyLjE1MSAyMS44MzlRMi4xNTEgMjEuNzU1IDIuMjE0IDIxLjYyOVEyLjI3NyAyMS41MDMgMi4yNzcgMjEuNDE5TDIuMjc3IDIxLjQxOVExLjU2MyAyMS40MTkgMS4zNTMgMjAuNzg5TDEuMzUzIDIwLjc4OVEwLjg0OSAxOS40NDUgMS4wMTcgMTguNDE2UTEuMTg1IDE3LjM4NyAyLjE1MSAxNi40MjFMMi4xNTEgMTYuNDIxTDIuMjM1IDE2LjI1M1EyLjQwMyAxNS45NTkgMi40MDMgMTUuNzkxTDIuNDAzIDE1Ljc5MVEyLjQwMyAxNC4zNjMgMi42OTcgMTMuMzEzTDIuNjk3IDEzLjMxM1EzLjAzMyAxMi4wNTMgMy44MzEgMTEuMDQ1TDMuODMxIDExLjA0NVE0LjUwMyAxMC4xNjMgNS40MjcgOS42MTdMNS40MjcgOS42MTdRNS41OTUgOS41MzMgNS42MTYgOS40MDdRNS42MzcgOS4yODEgNS41NTMgOS4wNzFMNS41NTMgOS4wNzFRNC44MzkgOC4xODkgNC42MjkgNi45NzFMNC42MjkgNi45NzFRNC41NDUgNi42MzUgNC42NzEgNi4yMTVMNC42NzEgNi4yMTVRNC43NTUgNS45MjEgNS4wMDcgNS40MTdMNS4wMDcgNS40MTdMNS4xNzUgNS4wMzlRNS40MjcgNC43NDUgNS41NTMgNC43NDVMNS41NTMgNC43NDVRNS45MzEgNC42NjEgNi41NjEgNC4xOTlMNi41NjEgNC4xOTlMNi44NTUgMy45ODlROC4xNTcgMi42NDUgMTAuMTMxIDIuNjQ1TDEwLjEzMSAyLjY0NVExMC4zNDEgMi42NDUgMTAuNDQ2IDIuNTgyUTEwLjU1MSAyLjUxOSAxMC41NTEgMi4zOTNMMTAuNTUxIDIuMzkzUTEwLjcxOSAxLjU5NSAxMS4zMDcgMC44MzlMMTEuMzA3IDAuODM5TDExLjcyNyAwLjQxOVExMS45MzcgMC4yMDkgMTIuMTY4IDAuMjMwUTEyLjM5OSAwLjI1MSAxMi41MjUgMC41NDVMMTIuNTI1IDAuNTQ1UTEyLjc3NyAxLjAwNyAxMy4xNTUgMS44NDdMMTMuMTU1IDEuODQ3TDEzLjQwNyAyLjM5M1ExMy42MTcgMi43MjkgMTMuODI3IDIuNTE5TDEzLjgyNyAyLjUxOVExNC4zMzEgMi4zMDkgMTQuNDk5IDIuMjg4UTE0LjY2NyAyLjI2NyAxNC43NTEgMi4zOTNRMTQuODM1IDIuNTE5IDE1LjAwMyAzLjA2NUwxNS4wMDMgMy4wNjVRMTYuMDExIDcuMjY1IDEzLjcwMSAxMC45MTlMMTMuNzAxIDEwLjkxOVExMy42MTcgMTEuMDQ1IDEzLjQyOCAxMS4zMThRMTMuMjM5IDExLjU5MSAxMy4xNTUgMTEuNzU5UTEzLjA3MSAxMS45MjcgMTMuMDkyIDEyLjA1M1ExMy4xMTMgMTIuMTc5IDEzLjI4MSAxMi4zODlMMTMuMjgxIDEyLjM4OVExNC4xNjMgMTMuMTQ1IDE0Ljc1MSAxNC4xOTVRMTUuMzM5IDE1LjI0NSAxNS41MDcgMTYuNDIxTDE1LjUwNyAxNi40MjFRMTUuNzE3IDE3Ljg5MSAxNS41MDcgMTkuMzE5TDE1LjUwNyAxOS4zMTlRMTUuNDIzIDE5LjY5NyAxNS41MDcgMTkuNzYwUTE1LjU5MSAxOS44MjMgMTUuOTI3IDE5LjczOUwxNS45MjcgMTkuNzM5UTE3LjM5NyAxOS4yNzcgMTguNTMxIDE4LjUyMUwxOC41MzEgMTguNTIxTDE4Ljg2NyAxOC4zNTNRMTkuNjIzIDE3Ljg5MSAyMC4wNDMgMTcuNzIzTDIwLjA0MyAxNy43MjNRMjAuNjczIDE3LjQyOSAyMS4zMDMgMTcuMzQ1TDIxLjMwMyAxNy4zNDVMMjEuNjgxIDE3LjM0NVEyMi4xMDEgMTcuMjYxIDIyLjM3NCAxNy4zNjZRMjIuNjQ3IDE3LjQ3MSAyMi44MzYgMTcuNzIzUTIzLjAyNSAxNy45NzUgMjMuMDI1IDE4LjI2OUwyMy4wMjUgMTguMjY5UTIzLjAyNSAxOC44NTcgMjIuMzUzIDE5LjA2N0wyMi4zNTMgMTkuMDY3UTIwLjYzMSAxOS40MDMgMTguODA0IDIwLjcyNlExNi45NzcgMjIuMDQ5IDE0LjQ1NyAyMi43MjFMMTQuNDU3IDIyLjcyMVExNC4zNzMgMjIuNzIxIDE0LjIwNSAyMi44MDVRMTQuMDM3IDIyLjg4OSAxMy45NTMgMjMuMDE1TDEzLjk1MyAyMy4wMTVRMTMuNjU5IDIzLjIyNSAxMy4zMjMgMjMuMzA5TDEzLjMyMyAyMy4zMDlRMTMuMTEzIDIzLjM5MyAxMi42NTEgMjMuNDM1TDEyLjY1MSAyMy40MzVMMTIuMjMxIDIzLjUxOUwxMS44OTUgMjMuNTYxUTkuMzc1IDIzLjc3MSA4LjAzMSAyMy43NzFMOC4wMzEgMjMuNzcxUTcuMjc1IDIzLjc3MSA2LjcyOSAyMy42NDVMNi43MjkgMjMuNjQ1UTUuOTczIDIzLjM5MyA1LjgwNSAyMi44ODlMNS44MDUgMjIuODg5UTUuNTk1IDIyLjA5MSA2LjIyNSAyMS42NzFMNi4yMjUgMjEuNjcxUTYuMzUxIDIxLjY3MSA2LjUxOSAyMS42MDhRNi42ODcgMjEuNTQ1IDYuNzI5IDIxLjU0NVoiIC8+PC9zdmc+){.astro-5yo7dsk7
  .astro-4rgy7crp} Yarn](index.html#tab-panel-147){#tab-147
  .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0xMS45NjYgMjIuMTMyYzYuNjA5IDAgMTEuOTY2LTQuMzI2IDExLjk2Ni05LjY2MSAwLTMuMzA4LTIuMDUxLTYuMjMtNS4yMDQtNy45NjMtMS4yODMtLjcxMy0yLjI5MS0xLjM1My0zLjEzLTEuODg1QzE0LjAxOCAxLjYxOSAxMy4wNDMgMSAxMS45NjYgMWMtMS4wOTQgMC0yLjMyNy43ODMtMy45NTUgMS44MTZhNDkuNzggNDkuNzggMCAwIDEtMi44MDggMS42OTJDMi4wNTEgNi4yNDEgMCA5LjE2MyAwIDEyLjQ3MWMwIDUuMzM1IDUuMzU3IDkuNjYxIDExLjk2NiA5LjY2MVptLTEuMzk3LTE3LjgzYTUuODg1IDUuODg1IDAgMCAwIC40OTctMi40MDNjMC0uMTQ0LjIwMS0uMTg2LjIyOS0uMDI4LjY1NiAyLjc3NS0uOSA0LjE1LTIuMDUxIDQuNjEtLjEyNC4wNDgtLjE5OS0uMTItLjEwMy0uMjA4YTUuNzQ3IDUuNzQ3IDAgMCAwIDEuNDI4LTEuOTcxWm0yLjA1Mi0uMTAyYTUuNzk1IDUuNzk1IDAgMCAwLS43OC0yLjN2LS4wMTVjLS4wNjgtLjEyMy4wODYtLjI2My4xODUtLjE3MiAxLjk1NiAyLjEwNSAxLjMwMyA0LjA1NS41NTQgNS4wMzctLjA4Mi4xMDItLjIyOS0uMDAzLS4xODgtLjEyNmE1LjgzNyA1LjgzNyAwIDAgMCAuMjI5LTIuNDI0Wm0xLjc3MS0uNTU5YTUuNzA5IDUuNzA5IDAgMCAwLTEuNjA3LTEuODAxdi0uMDE0Yy0uMTEyLS4wODUtLjAyNC0uMjc0LjExMy0uMjE4IDIuNTg4IDEuMDg0IDIuNzY2IDMuMTcxIDIuNDUyIDQuMzk1YS4xMTYuMTE2IDAgMCAxLS4xMy4wOS4xMS4xMSAwIDAgMS0uMDcxLS4wNDUuMTE4LjExOCAwIDAgMS0uMDIyLS4wODMgNS44NjMgNS44NjMgMCAwIDAtLjczNS0yLjMyNFpNOS4zMiA0LjJjLS42MTYuNTQ0LTEuMjc5Ljc1OC0yLjA1OC45OTctLjExNiAwLS4xOTQtLjA3OC0uMTU1LS4xOCAxLjc0Ny0uOTA3IDIuMzY5LTEuNjQ1IDIuOTktMi43NzEgMCAwIC4xNTUtLjExNy4xODguMDg1IDAgLjMwMy0uMzQ4IDEuMzI1LS45NjUgMS44NjlabTQuOTMxIDExLjIwNWEyLjk1IDIuOTUgMCAwIDEtLjkzNSAxLjU0OSAyLjE2IDIuMTYgMCAwIDEtMS4yODIuNjE4IDIuMTY3IDIuMTY3IDAgMCAxLTEuMzIzLS42MTggMi45NSAyLjk1IDAgMCAxLS45MjMtMS41NDkuMjQzLjI0MyAwIDAgMSAuMDY0LS4xOTcuMjMuMjMgMCAwIDEgLjE5Mi0uMDY5aDMuOTU0YS4yMjcuMjI3IDAgMCAxIC4yNDQuMTZjLjAxLjAzNS4wMTQuMDcuMDA5LjEwNlptLTUuNDQzLTIuMTdhMS44NSAxLjg1IDAgMCAxLTIuMzc3LS4yNDQgMS45NjkgMS45NjkgMCAwIDEtLjIzMy0yLjQ0Yy4yMDctLjMxOC41MDItLjU2NS44NDYtLjcxMWExLjg0IDEuODQgMCAwIDEgMi4wNTMuNDJjLjI2NC4yNy40NDMuNjE2LjUxNS45OWExLjk4IDEuOTggMCAwIDEtLjEwOCAxLjExOGMtLjE0Mi4zNS0uMzg0LjY1My0uNjk2Ljg2N1ptOC40NzEuMDA1YTEuODUgMS44NSAwIDAgMS0yLjM3NC0uMjUyIDEuOTU2IDEuOTU2IDAgMCAxLS41NDYtMS4zNjJjMC0uMzgzLjExLS43NTguMzE5LTEuMDc2LjIwNy0uMzE4LjUwMi0uNTY2Ljg0Ny0uNzExYTEuODQgMS44NCAwIDAgMSAxLjA5LS4xMDhjLjM2Ni4wNzYuNzAyLjI2MS45NjUuNTMzcy40NC42MTcuNTEyLjk5M2ExLjk4IDEuOTggMCAwIDEtLjExMyAxLjExOCAxLjkyMiAxLjkyMiAwIDAgMS0uNy44NjVaIiAvPjwvc3ZnPg==){.astro-5yo7dsk7
  .astro-4rgy7crp} Bun](index.html#tab-panel-148){#tab-148
  .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
:::

:::: {#tab-panel-145 aria-labelledby="tab-145" role="tabpanel"}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code># Install the main library for integrating OpenTelemetry with Effectnpm install @effect/opentelemetry
# Install the required OpenTelemetry SDKs for tracing and metricsnpm install @opentelemetry/sdk-trace-basenpm install @opentelemetry/sdk-trace-nodenpm install @opentelemetry/sdk-trace-webnpm install @opentelemetry/sdk-metrics</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

:::: {#tab-panel-146 aria-labelledby="tab-146" role="tabpanel" hidden=""}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code># Install the main library for integrating OpenTelemetry with Effectpnpm add @effect/opentelemetry
# Install the required OpenTelemetry SDKs for tracing and metricspnpm add @opentelemetry/sdk-trace-basepnpm add @opentelemetry/sdk-trace-nodepnpm add @opentelemetry/sdk-trace-webpnpm add @opentelemetry/sdk-metrics</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

:::: {#tab-panel-147 aria-labelledby="tab-147" role="tabpanel" hidden=""}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code># Install the main library for integrating OpenTelemetry with Effectyarn add @effect/opentelemetry
# Install the required OpenTelemetry SDKs for tracing and metricsyarn add @opentelemetry/sdk-trace-baseyarn add @opentelemetry/sdk-trace-nodeyarn add @opentelemetry/sdk-trace-webyarn add @opentelemetry/sdk-metrics</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

:::: {#tab-panel-148 aria-labelledby="tab-148" role="tabpanel" hidden=""}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code># Install the main library for integrating OpenTelemetry with Effectbun add @effect/opentelemetry
# Install the required OpenTelemetry SDKs for tracing and metricsbun add @opentelemetry/sdk-trace-basebun add @opentelemetry/sdk-trace-nodebun add @opentelemetry/sdk-trace-webbun add @opentelemetry/sdk-metrics</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9InN0YXJsaWdodC1hc2lkZV9faWNvbiBhc3Ryby00cmd5N2NycCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Ym94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciIgc3R5bGU9Ii0tc2wtaWNvbi1zaXplOiAxZW07Ij48cGF0aCBkPSJNMTIgMTFhMSAxIDAgMCAwLTEgMXY0YTEgMSAwIDAgMCAyIDB2LTRhMSAxIDAgMCAwLTEtMVptLjM4LTMuOTJhMSAxIDAgMCAwLS43NiAwIDEgMSAwIDAgMC0uMzMuMjEgMS4xNSAxLjE1IDAgMCAwLS4yMS4zMyAxIDEgMCAwIDAgLjIxIDEuMDljLjA5Ny4wODguMjA5LjE2LjMzLjIxQTEgMSAwIDAgMCAxMyA4YTEuMDUgMS4wNSAwIDAgMC0uMjktLjcxIDEgMSAwIDAgMC0uMzMtLjIxWk0xMiAyYTEwIDEwIDAgMSAwIDAgMjAgMTAgMTAgMCAwIDAgMC0yMFptMCAxOGE4IDggMCAxIDEgMC0xNi4wMDFBOCA4IDAgMCAxIDEyIDIwWiIgLz48L3N2Zz4=){.starlight-aside__icon
.astro-4rgy7crp} Peer Dependency

::: starlight-aside__content
The `@opentelemetry/api`{dir="auto"} package is a peer dependency of
`@effect/opentelemetry`{dir="auto"}. If your package manager does not
automatically install peer dependencies, you must add it manually.
:::

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Printing a Span to the Console

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#printing-a-span-to-the-console){.anchor-link
aria-labelledby="printing-a-span-to-the-console"}
:::

Once the dependencies are installed, you can set up span printing using
OpenTelemetry. Here's an example showing how to print a span for an
effect.

**Example** (Setting Up and Printing a Span)

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

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

::::: code
[import]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeSdk</code></pre>
</figure>
:::
::::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/opentelemetry\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::: code
[import]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

:::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ConsoleSpanExporter</code></pre>
</figure>
:::

::: twoslash-popup-docs
This is implementation of

SpanExporter

that prints spans to the console. This class can be used for diagnostic
purposes.

NOTE: This

SpanExporter

is intended for diagnostics use only, output rendered to the console may
change at any time.
:::
:::::

[ConsoleSpanExporter]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
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
<pre data-language="ts"><code>class BatchSpanProcessor</code></pre>
</figure>
:::
::::

[BatchSpanProcessor]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[}
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@opentelemetry/sdk-trace-base\"]{style="--0:#032F62;--1:#9ECBFF"}
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
[// Define an effect that delays for 100
milliseconds]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

:::::::::::::::::::::: code
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
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const void: Effect.Effect&lt;void, never, never&gt;export void</code></pre>
</figure>
:::

::: twoslash-popup-docs
Represents an effect that does nothing and produces no value.

**When to Use**

Use this effect when you need to represent an effect that does nothing.
This is useful in scenarios where you need to satisfy an effect-based
interface or control program flow without performing any operations. For
example, it can be used in situations where you want to return an effect
from a function but do not need to compute or return any result.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[void]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

[delay]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"100
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::
:::::::::::::::::::::::::

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
[// Instrument the effect with a span for
tracing]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

:::::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const instrumented: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[instrumented]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const withSpan: (name: string, options?: SpanOptions | undefined) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, ParentSpan&gt;&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Wraps the effect with a new span for tracing.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[withSpan]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"myspan\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

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
[// Set up tracing with the OpenTelemetry
SDK]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
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
<pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
</figure>
:::
::::

[NodeSdkLive]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeSdk</code></pre>
</figure>
:::
::::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const layer: (evaluate: LazyArg&lt;NodeSdk.Configuration&gt;) =&gt; Layer&lt;Resource&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[layer]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
({]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Configuration.resource?: {    readonly serviceName: string;    readonly serviceVersion?: string;    readonly attributes?: Attributes;} | undefined</code></pre>
</figure>
:::
::::

[resource]{style="--0:#24292E;--1:#E1E4E8"}[: {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>serviceName: string</code></pre>
</figure>
:::
::::

[serviceName]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"example\"]{style="--0:#032F62;--1:#9ECBFF"}[
},]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[ ]{.indent}[// Export span data to the
console]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
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
<pre data-language="ts"><code>Configuration.spanProcessor?: SpanProcessor | readonly SpanProcessor[] | undefined</code></pre>
</figure>
:::
::::

[spanProcessor]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>new BatchSpanProcessor&lt;BufferConfig&gt;(_exporter: SpanExporter, config?: BufferConfig | undefined): BatchSpanProcessor</code></pre>
</figure>
:::
::::

[BatchSpanProcessor]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>new ConsoleSpanExporter(): ConsoleSpanExporter</code></pre>
</figure>
:::

::: twoslash-popup-docs
This is implementation of

SpanExporter

that prints spans to the console. This class can be used for diagnostic
purposes.

NOTE: This

SpanExporter

is intended for diagnostics use only, output rendered to the console may
change at any time.
:::
:::::

[ConsoleSpanExporter]{style="--0:#6F42C1;--1:#B392F0"}[())]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[}))]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
[// Run the effect, providing the tracing
layer]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

:::::::::::::::::::::::::: code
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
<pre data-language="ts"><code>const instrumented: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[instrumented]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const provide: &lt;Resource, never, never&gt;(layer: Layer&lt;Resource, never, never&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, Resource&gt;&gt; (+9 overloads)</code></pre>
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
<pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
</figure>
:::
::::

[NodeSdkLive]{style="--0:#24292E;--1:#E1E4E8"}[)))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::
:::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[Example Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[resource:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'service.name\':
\'example\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.language\':
\'nodejs\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.name\':
\'@effect/opentelemetry\',]{style="--0:#616972;--1:#99A0A6"}
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
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.version\':
\'1.28.0\']{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
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
33
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[instrumentationScope: {
name: \'example\', version: undefined, schemaUrl: undefined
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceId:
\'673c06608bd815f7a75bf897ef87e186\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[parentId:
undefined,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceState:
undefined,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[name:
\'myspan\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[id:
\'401b2846170cd17b\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[kind:
0,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
41
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[timestamp:
1733220735529855.5,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[duration:
102079.958,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
43
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
{},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
44
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[status: { code: 1
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
45
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[events:
\[\],]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
46
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[links:
\[\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
47
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
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

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Understanding the Span Output

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#understanding-the-span-output){.anchor-link
aria-labelledby="understanding-the-span-output"}
:::

The output provides detailed information about the span:

  Field                      Description
  -------------------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  `traceId`{dir="auto"}      A unique identifier for the entire trace, helping trace requests or operations as they move through an application.
  `parentId`{dir="auto"}     Identifies the parent span of the current span, marked as `undefined`{dir="auto"} in the output when there is no parent span, making it a root span.
  `name`{dir="auto"}         Describes the name of the span, indicating the operation being tracked (e.g., "myspan").
  `id`{dir="auto"}           A unique identifier for the current span, distinguishing it from other spans within a trace.
  `timestamp`{dir="auto"}    A timestamp representing when the span started, measured in microseconds since the Unix epoch.
  `duration`{dir="auto"}     Specifies the duration of the span, representing the time taken to complete the operation (e.g., `2895.769`{dir="auto"} microseconds).
  `attributes`{dir="auto"}   Spans may contain attributes, which are key-value pairs providing additional context or information about the operation. In this output, it's an empty object, indicating no specific attributes in this span.
  `status`{dir="auto"}       The status field provides information about the span's status. In this case, it has a code of 1, which typically indicates an OK status (whereas a code of 2 signifies an ERROR status)
  `events`{dir="auto"}       Spans can include events, which are records of specific moments during the span's lifecycle. In this output, it's an empty array, suggesting no specific events recorded.
  `links`{dir="auto"}        Links can be used to associate this span with other spans in different traces. In the output, it's an empty array, indicating no specific links for this span.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Span Capturing an Error

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#span-capturing-an-error){.anchor-link
aria-labelledby="span-capturing-an-error"}
:::

Here's how a span looks when the effect encounters an error:

**Example** (Span for an Effect that Fails)

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

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

::::: code
[import]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeSdk</code></pre>
</figure>
:::
::::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/opentelemetry\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::: code
[import]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

:::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ConsoleSpanExporter</code></pre>
</figure>
:::

::: twoslash-popup-docs
This is implementation of

SpanExporter

that prints spans to the console. This class can be used for diagnostic
purposes.

NOTE: This

SpanExporter

is intended for diagnostics use only, output rendered to the console may
change at any time.
:::
:::::

[ConsoleSpanExporter]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
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
<pre data-language="ts"><code>class BatchSpanProcessor</code></pre>
</figure>
:::
::::

[BatchSpanProcessor]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[}
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@opentelemetry/sdk-trace-base\"]{style="--0:#032F62;--1:#9ECBFF"}
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

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>const program: Effect.Effect&lt;never, string, never&gt;</code></pre>
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
no!\"]{style="--0:#032F62;--1:#9ECBFF"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;never, string, never&gt;, Effect.Effect&lt;never, string, never&gt;, Effect.Effect&lt;never, string, never&gt;&gt;(this: Effect.Effect&lt;never, string, never&gt;, ab: (_: Effect.Effect&lt;never, string, never&gt;) =&gt; Effect.Effect&lt;never, string, never&gt;, bc: (_: Effect.Effect&lt;never, string, never&gt;) =&gt; Effect.Effect&lt;never, string, never&gt;): Effect.Effect&lt;never, string, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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

[delay]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"100
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

:::::::::: code
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
<pre data-language="ts"><code>const withSpan: (name: string, options?: SpanOptions | undefined) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, ParentSpan&gt;&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Wraps the effect with a new span for tracing.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[withSpan]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"myspan\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
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

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
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
<pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
</figure>
:::
::::

[NodeSdkLive]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeSdk</code></pre>
</figure>
:::
::::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const layer: (evaluate: LazyArg&lt;NodeSdk.Configuration&gt;) =&gt; Layer&lt;Resource&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[layer]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
({]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Configuration.resource?: {    readonly serviceName: string;    readonly serviceVersion?: string;    readonly attributes?: Attributes;} | undefined</code></pre>
</figure>
:::
::::

[resource]{style="--0:#24292E;--1:#E1E4E8"}[: {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>serviceName: string</code></pre>
</figure>
:::
::::

[serviceName]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"example\"]{style="--0:#032F62;--1:#9ECBFF"}[
},]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
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
<pre data-language="ts"><code>Configuration.spanProcessor?: SpanProcessor | readonly SpanProcessor[] | undefined</code></pre>
</figure>
:::
::::

[spanProcessor]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>new BatchSpanProcessor&lt;BufferConfig&gt;(_exporter: SpanExporter, config?: BufferConfig | undefined): BatchSpanProcessor</code></pre>
</figure>
:::
::::

[BatchSpanProcessor]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>new ConsoleSpanExporter(): ConsoleSpanExporter</code></pre>
</figure>
:::

::: twoslash-popup-docs
This is implementation of

SpanExporter

that prints spans to the console. This class can be used for diagnostic
purposes.

NOTE: This

SpanExporter

is intended for diagnostics use only, output rendered to the console may
change at any time.
:::
:::::

[ConsoleSpanExporter]{style="--0:#6F42C1;--1:#B392F0"}[())]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[}))]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
:::
::::::

:::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::::::::::::::::::::::::::::: code
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

[program]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const provide: &lt;Resource, never, never&gt;(layer: Layer&lt;Resource, never, never&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, Resource&gt;&gt; (+9 overloads)</code></pre>
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
<pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
</figure>
:::
::::

[NodeSdkLive]{style="--0:#24292E;--1:#E1E4E8"}[))).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

[then]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::::::::::
::::::::::::::::::::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
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

[log]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

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
[Example Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[resource:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
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
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'service.name\':
\'example\',]{style="--0:#616972;--1:#99A0A6"}
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
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.language\':
\'nodejs\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.name\':
\'@effect/opentelemetry\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.version\':
\'1.28.0\']{style="--0:#616972;--1:#99A0A6"}
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
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[instrumentationScope: {
name: \'example\', version: undefined, schemaUrl: undefined
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceId:
\'eee9619866179f209b7aae277283e71f\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[parentId:
undefined,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceState:
undefined,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[name:
\'myspan\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[id:
\'3a5725c91884c9e1\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[kind:
0,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[timestamp:
1733220830575626,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[duration:
106578.042,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
41
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'code.stacktrace\':
\'at \<anonymous\>
(/Users/giuliocanti/Documents/GitHub/website/content/dev/index.ts:10:10)\']{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
43
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
44
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[status: {
]{style="--0:#616972;--1:#99A0A6"}[[code:
2]{style="--0:#494f56;--1:#b4b9be"}]{.mark}[, message: \'Oh no!\'
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
45
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[events:
\[]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
46
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
47
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[name:
\'exception\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
48
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
49
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'exception.type\':
\'Error\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
50
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'exception.message\':
\'Oh no!\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
51
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'exception.stacktrace\':
\'Error: Oh no!\']{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
52
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
53
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[time: \[ 1733220830,
682204083 \],]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
54
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[droppedAttributesCount:
0]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
55
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
56
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\],]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
57
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[links:
\[\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
58
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
59
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
60
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
61
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
62
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[cause: { \_id:
\'Cause\', \_tag: \'Fail\', failure: \'Oh no!\'
}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
63
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
64
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

In this example, the span's status code is `2`{dir="auto"}, indicating
an error. The message in the status provides more details about the
failure.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Adding Annotations

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#adding-annotations){.anchor-link
aria-labelledby="adding-annotations"}
:::

You can provide extra information to a span by utilizing the
`Effect.annotateCurrentSpan`{dir="auto"} function. This function allows
you to attach key-value pairs, offering more context about the execution
of the span.

**Example** (Annotating a Span)

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

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

::::: code
[import]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeSdk</code></pre>
</figure>
:::
::::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/opentelemetry\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::: code
[import]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

:::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ConsoleSpanExporter</code></pre>
</figure>
:::

::: twoslash-popup-docs
This is implementation of

SpanExporter

that prints spans to the console. This class can be used for diagnostic
purposes.

NOTE: This

SpanExporter

is intended for diagnostics use only, output rendered to the console may
change at any time.
:::
:::::

[ConsoleSpanExporter]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
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
<pre data-language="ts"><code>class BatchSpanProcessor</code></pre>
</figure>
:::
::::

[BatchSpanProcessor]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[}
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@opentelemetry/sdk-trace-base\"]{style="--0:#032F62;--1:#9ECBFF"}
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const void: Effect.Effect&lt;void, never, never&gt;export void</code></pre>
</figure>
:::

::: twoslash-popup-docs
Represents an effect that does nothing and produces no value.

**When to Use**

Use this effect when you need to represent an effect that does nothing.
This is useful in scenarios where you need to satisfy an effect-based
interface or control program flow without performing any operations. For
example, it can be used in situations where you want to return an effect
from a function but do not need to compute or return any result.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[void]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;void, never, never&gt;, ab: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;, bc: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;, cd: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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

[delay]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"100
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[ ]{.indent}[// Annotate the span with a key-value
pair]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

:::::::::::::::::: code
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
<pre data-language="ts"><code>const tap: &lt;void, Effect.Effect&lt;void, never, never&gt;&gt;(f: (a: void) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;void, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt; (+7 overloads)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Runs a side effect with the result of an effect without changing the
original value.

**Details**

This function works similarly to `flatMap`, but it ignores the result of
the function passed to it. The value from the previous effect remains
available for the next part of the chain. Note that if the side effect
fails, the entire chain will fail too.

**When to Use**

Use this function when you want to perform a side effect, like logging
or tracking, without modifying the main value. This is useful when you
need to observe or record an action but want the original value to be
passed to the next step.

**Example** (Logging a step in a pipeline)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Console, Effect, pipe } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
const finalAmount = pipe(  fetchTransactionAmount,  // Log the fetched transaction amount  Effect.tap((amount) =&gt; Console.log(`Apply a discount to: ${amount}`)),  // `amount` is still available!  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(finalAmount).then(console.log)// Output:// Apply a discount to: 100// 95</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [flatMap for a version that
allows you to change the value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[tap]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
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
<pre data-language="ts"><code>const annotateCurrentSpan: (key: string, value: unknown) =&gt; Effect.Effect&lt;void&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Adds annotations to the currently active span for traceability.

**Details**

This function adds key-value annotations to the currently active span in
the effect\'s trace. These annotations help provide more context about
the operation being executed at a specific point in time. Unlike

annotateSpans

, which applies to all spans in an effect, this function focuses solely
on the active span.

You can either pass a single key-value pair or a record of key-value
pairs to annotate the span. These annotations are useful for adding
metadata to operations, especially in systems with detailed
observability requirements.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[annotateCurrentSpan]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"key\"]{style="--0:#032F62;--1:#9ECBFF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[\"value\"]{style="--0:#032F62;--1:#9ECBFF"}[)),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[ ]{.indent}[// Wrap the effect in a span named
\'myspan\']{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

:::::::::: code
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
<pre data-language="ts"><code>const withSpan: (name: string, options?: SpanOptions | undefined) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, ParentSpan&gt;&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Wraps the effect with a new span for tracing.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[withSpan]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"myspan\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[// Set up tracing with the OpenTelemetry
SDK]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
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
<pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
</figure>
:::
::::

[NodeSdkLive]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeSdk</code></pre>
</figure>
:::
::::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const layer: (evaluate: LazyArg&lt;NodeSdk.Configuration&gt;) =&gt; Layer&lt;Resource&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[layer]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
({]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Configuration.resource?: {    readonly serviceName: string;    readonly serviceVersion?: string;    readonly attributes?: Attributes;} | undefined</code></pre>
</figure>
:::
::::

[resource]{style="--0:#24292E;--1:#E1E4E8"}[: {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>serviceName: string</code></pre>
</figure>
:::
::::

[serviceName]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"example\"]{style="--0:#032F62;--1:#9ECBFF"}[
},]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
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
<pre data-language="ts"><code>Configuration.spanProcessor?: SpanProcessor | readonly SpanProcessor[] | undefined</code></pre>
</figure>
:::
::::

[spanProcessor]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>new BatchSpanProcessor&lt;BufferConfig&gt;(_exporter: SpanExporter, config?: BufferConfig | undefined): BatchSpanProcessor</code></pre>
</figure>
:::
::::

[BatchSpanProcessor]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>new ConsoleSpanExporter(): ConsoleSpanExporter</code></pre>
</figure>
:::

::: twoslash-popup-docs
This is implementation of

SpanExporter

that prints spans to the console. This class can be used for diagnostic
purposes.

NOTE: This

SpanExporter

is intended for diagnostics use only, output rendered to the console may
change at any time.
:::
:::::

[ConsoleSpanExporter]{style="--0:#6F42C1;--1:#B392F0"}[())]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[}))]{style="--0:#24292E;--1:#E1E4E8"}
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
[// Run the effect, providing the tracing
layer]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

:::::::::::::::::::::::::: code
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
<pre data-language="ts"><code>const provide: &lt;Resource, never, never&gt;(layer: Layer&lt;Resource, never, never&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, Resource&gt;&gt; (+9 overloads)</code></pre>
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
<pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
</figure>
:::
::::

[NodeSdkLive]{style="--0:#24292E;--1:#E1E4E8"}[)))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::
:::::::::::::::::::::::::::::

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
[Example Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[resource:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'service.name\':
\'example\',]{style="--0:#616972;--1:#99A0A6"}
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
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.language\':
\'nodejs\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.name\':
\'@effect/opentelemetry\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.version\':
\'1.28.0\']{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
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
34
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[instrumentationScope: {
name: \'example\', version: undefined, schemaUrl: undefined
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceId:
\'c8120e01c0f1ea83ccc1d388e5cdebd3\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[parentId:
undefined,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceState:
undefined,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[name:
\'myspan\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[id:
\'81c430ba4979f1db\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
41
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[kind:
0,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[timestamp:
1733220874356084,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
43
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[duration:
102821.417,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
44
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[[attributes: { key:
\'value\'
}]{style="--0:#494f56;--1:#b4b9be"}]{.mark}[,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
45
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[status: { code: 1
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
46
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[events:
\[\],]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
47
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[links:
\[\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
48
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
49
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
## Logs as events

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#logs-as-events){.anchor-link
aria-labelledby="logs-as-events"}
:::

In the context of tracing, logs are converted into "Span Events." These
events offer structured insights into your application's activities and
provide a timeline of when specific operations occurred.

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

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

::::: code
[import]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeSdk</code></pre>
</figure>
:::
::::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/opentelemetry\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::: code
[import]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

:::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ConsoleSpanExporter</code></pre>
</figure>
:::

::: twoslash-popup-docs
This is implementation of

SpanExporter

that prints spans to the console. This class can be used for diagnostic
purposes.

NOTE: This

SpanExporter

is intended for diagnostics use only, output rendered to the console may
change at any time.
:::
:::::

[ConsoleSpanExporter]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
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
<pre data-language="ts"><code>class BatchSpanProcessor</code></pre>
</figure>
:::
::::

[BatchSpanProcessor]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[}
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@opentelemetry/sdk-trace-base\"]{style="--0:#032F62;--1:#9ECBFF"}
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
[// Define a program that logs a message and delays for 100
milliseconds]{style="--0:#616972;--1:#99A0A6"}
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Hello\"]{style="--0:#032F62;--1:#9ECBFF"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;void, never, never&gt;, ab: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;, bc: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

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

[delay]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"100
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

:::::::::: code
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
<pre data-language="ts"><code>const withSpan: (name: string, options?: SpanOptions | undefined) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, ParentSpan&gt;&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Wraps the effect with a new span for tracing.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[withSpan]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"myspan\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
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
[// Set up tracing with the OpenTelemetry
SDK]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
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
<pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
</figure>
:::
::::

[NodeSdkLive]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeSdk</code></pre>
</figure>
:::
::::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const layer: (evaluate: LazyArg&lt;NodeSdk.Configuration&gt;) =&gt; Layer&lt;Resource&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[layer]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
({]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Configuration.resource?: {    readonly serviceName: string;    readonly serviceVersion?: string;    readonly attributes?: Attributes;} | undefined</code></pre>
</figure>
:::
::::

[resource]{style="--0:#24292E;--1:#E1E4E8"}[: {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>serviceName: string</code></pre>
</figure>
:::
::::

[serviceName]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"example\"]{style="--0:#032F62;--1:#9ECBFF"}[
},]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
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
<pre data-language="ts"><code>Configuration.spanProcessor?: SpanProcessor | readonly SpanProcessor[] | undefined</code></pre>
</figure>
:::
::::

[spanProcessor]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>new BatchSpanProcessor&lt;BufferConfig&gt;(_exporter: SpanExporter, config?: BufferConfig | undefined): BatchSpanProcessor</code></pre>
</figure>
:::
::::

[BatchSpanProcessor]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>new ConsoleSpanExporter(): ConsoleSpanExporter</code></pre>
</figure>
:::

::: twoslash-popup-docs
This is implementation of

SpanExporter

that prints spans to the console. This class can be used for diagnostic
purposes.

NOTE: This

SpanExporter

is intended for diagnostics use only, output rendered to the console may
change at any time.
:::
:::::

[ConsoleSpanExporter]{style="--0:#6F42C1;--1:#B392F0"}[())]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[}))]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[// Run the effect, providing the tracing
layer]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

:::::::::::::::::::::::::: code
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
<pre data-language="ts"><code>const provide: &lt;Resource, never, never&gt;(layer: Layer&lt;Resource, never, never&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, Resource&gt;&gt; (+9 overloads)</code></pre>
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
<pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
</figure>
:::
::::

[NodeSdkLive]{style="--0:#24292E;--1:#E1E4E8"}[)))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::
:::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
[Example Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[resource:
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
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'service.name\':
\'example\',]{style="--0:#616972;--1:#99A0A6"}
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
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.language\':
\'nodejs\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.name\':
\'@effect/opentelemetry\',]{style="--0:#616972;--1:#99A0A6"}
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
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.version\':
\'1.28.0\']{style="--0:#616972;--1:#99A0A6"}
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
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[instrumentationScope: {
name: \'example\', version: undefined, schemaUrl: undefined
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceId:
\'b0f4f012b5b13c0a040f7002a1d7b020\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[parentId:
undefined,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceState:
undefined,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[name:
\'myspan\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[id:
\'b9ba8472002715a8\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[kind:
0,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[timestamp:
1733220905504162.2,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
41
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[duration:
103790,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
{},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
43
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[status: { code: 1
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
44
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[events:
\[]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
45
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
46
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[name:
\'Hello\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: {.ec-line .highlight .mark}
:::: gutter
::: {.ln aria-hidden="true"}
47
:::
::::

::: code
[[ ]{.indent}attributes: { \'effect.fiberId\': \'#0\',
\'effect.logLevel\': \'INFO\' }, // Log
attributes]{style="--0:#494f56;--1:#b4b9be"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
48
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[time: \[ 1733220905,
607761042 \], // Event timestamp]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
49
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[droppedAttributesCount:
0]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
50
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
51
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\],]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
52
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[links:
\[\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
53
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
54
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

Each span can include events, which capture specific moments during the
execution of a span. In this example, a log message
`"Hello"`{dir="auto"} is recorded as an event within the span. Key
details of the event include:

  Field                                  Description
  -------------------------------------- ---------------------------------------------------------------------------------------------------------------
  `name`{dir="auto"}                     The name of the event, which corresponds to the logged message (e.g., `'Hello'`{dir="auto"}).
  `attributes`{dir="auto"}               Key-value pairs that provide additional context about the event, such as `fiberId`{dir="auto"} and log level.
  `time`{dir="auto"}                     The timestamp of when the event occurred, shown in a high-precision format.
  `droppedAttributesCount`{dir="auto"}   Indicates how many attributes were discarded, if any. In this case, no attributes were dropped.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Nesting Spans

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#nesting-spans){.anchor-link
aria-labelledby="nesting-spans"}
:::

Spans can be nested to represent a hierarchy of operations. This allows
you to track how different parts of your application relate to one
another during execution. The following example demonstrates how to
create and manage nested spans.

**Example** (Nesting Spans in a Trace)

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

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

::::: code
[import]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeSdk</code></pre>
</figure>
:::
::::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/opentelemetry\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::: code
[import]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

:::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ConsoleSpanExporter</code></pre>
</figure>
:::

::: twoslash-popup-docs
This is implementation of

SpanExporter

that prints spans to the console. This class can be used for diagnostic
purposes.

NOTE: This

SpanExporter

is intended for diagnostics use only, output rendered to the console may
change at any time.
:::
:::::

[ConsoleSpanExporter]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
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
<pre data-language="ts"><code>class BatchSpanProcessor</code></pre>
</figure>
:::
::::

[BatchSpanProcessor]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[}
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@opentelemetry/sdk-trace-base\"]{style="--0:#032F62;--1:#9ECBFF"}
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>const child: Effect.Effect&lt;void, never, never&gt;</code></pre>
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
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const void: Effect.Effect&lt;void, never, never&gt;export void</code></pre>
</figure>
:::

::: twoslash-popup-docs
Represents an effect that does nothing and produces no value.

**When to Use**

Use this effect when you need to represent an effect that does nothing.
This is useful in scenarios where you need to satisfy an effect-based
interface or control program flow without performing any operations. For
example, it can be used in situations where you want to return an effect
from a function but do not need to compute or return any result.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[void]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;void, never, never&gt;, ab: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;, bc: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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

[delay]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"100
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

:::::::::: code
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
<pre data-language="ts"><code>const withSpan: (name: string, options?: SpanOptions | undefined) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, ParentSpan&gt;&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Wraps the effect with a new span for tracing.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[withSpan]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"child\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
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

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"20
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const child: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[child]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
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

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"10
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

:::::::::::: code
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

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const withSpan: (name: string, options?: SpanOptions | undefined) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, ParentSpan&gt;&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Wraps the effect with a new span for tracing.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[withSpan]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"parent\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

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
[// Set up tracing with the OpenTelemetry
SDK]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
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
<pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
</figure>
:::
::::

[NodeSdkLive]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeSdk</code></pre>
</figure>
:::
::::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const layer: (evaluate: LazyArg&lt;NodeSdk.Configuration&gt;) =&gt; Layer&lt;Resource&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[layer]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
({]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Configuration.resource?: {    readonly serviceName: string;    readonly serviceVersion?: string;    readonly attributes?: Attributes;} | undefined</code></pre>
</figure>
:::
::::

[resource]{style="--0:#24292E;--1:#E1E4E8"}[: {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>serviceName: string</code></pre>
</figure>
:::
::::

[serviceName]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"example\"]{style="--0:#032F62;--1:#9ECBFF"}[
},]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
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
<pre data-language="ts"><code>Configuration.spanProcessor?: SpanProcessor | readonly SpanProcessor[] | undefined</code></pre>
</figure>
:::
::::

[spanProcessor]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>new BatchSpanProcessor&lt;BufferConfig&gt;(_exporter: SpanExporter, config?: BufferConfig | undefined): BatchSpanProcessor</code></pre>
</figure>
:::
::::

[BatchSpanProcessor]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>new ConsoleSpanExporter(): ConsoleSpanExporter</code></pre>
</figure>
:::

::: twoslash-popup-docs
This is implementation of

SpanExporter

that prints spans to the console. This class can be used for diagnostic
purposes.

NOTE: This

SpanExporter

is intended for diagnostics use only, output rendered to the console may
change at any time.
:::
:::::

[ConsoleSpanExporter]{style="--0:#6F42C1;--1:#B392F0"}[())]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
[}))]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
[// Run the effect, providing the tracing
layer]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

:::::::::::::::::::::::::: code
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
<pre data-language="ts"><code>const parent: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[parent]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const provide: &lt;Resource, never, never&gt;(layer: Layer&lt;Resource, never, never&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, Resource&gt;&gt; (+9 overloads)</code></pre>
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
<pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
</figure>
:::
::::

[NodeSdkLive]{style="--0:#24292E;--1:#E1E4E8"}[)))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::
:::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

::: code
[Example Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[resource:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'service.name\':
\'example\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.language\':
\'nodejs\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.name\':
\'@effect/opentelemetry\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.version\':
\'1.28.0\']{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
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
37
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[instrumentationScope: {
name: \'example\', version: undefined, schemaUrl: undefined
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceId:
\'a9cd69ad70698a0c7b7b774597c77d39\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[parentId:
\']{style="--0:#616972;--1:#99A0A6"}[[a09e5c3fdfdbbc1d]{style="--0:#494f56;--1:#b4b9be"}]{.mark}[\',
// This indicates the span is a child of
\'parent\']{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
41
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceState:
undefined,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[name:
\'child\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
43
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[id:
\'210d2f9b648389a4\', // Unique ID for the child
span]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
44
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[kind:
0,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
45
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[timestamp:
1733220970590126.2,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
46
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[duration:
101579.875,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
47
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
{},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
48
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[status: { code: 1
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
49
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[events:
\[\],]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
50
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[links:
\[\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
51
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
52
:::
::::

::: code
[{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
53
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[resource:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
54
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
{]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
55
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'service.name\':
\'example\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
56
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.language\':
\'nodejs\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
57
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.name\':
\'@effect/opentelemetry\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
58
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[\'telemetry.sdk.version\':
\'1.28.0\']{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
59
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
60
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
61
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[instrumentationScope: {
name: \'example\', version: undefined, schemaUrl: undefined
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
62
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceId:
\'a9cd69ad70698a0c7b7b774597c77d39\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
63
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[parentId: undefined, //
Indicates this is the root span]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
64
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[traceState:
undefined,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
65
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[name:
\'parent\',]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
66
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[id:
\']{style="--0:#616972;--1:#99A0A6"}[[a09e5c3fdfdbbc1d]{style="--0:#494f56;--1:#b4b9be"}]{.mark}[\',
// Unique ID for the parent span]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
67
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[kind:
0,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
68
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[timestamp:
1733220970569015.2,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
69
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[duration:
132612.208,]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
70
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[attributes:
{},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
71
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[status: { code: 1
},]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
72
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[events:
\[\],]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
73
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[links:
\[\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
74
:::
::::

::: code
[}]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
75
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

The parent-child relationship is evident in the span output, where the
`parentId`{dir="auto"} of the `child`{dir="auto"} span matches the
`id`{dir="auto"} of the `parent`{dir="auto"} span. This structure helps
track how operations are related within a single trace.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Tutorial: Visualizing Traces

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#tutorial-visualizing-traces){.anchor-link
aria-labelledby="tutorial-visualizing-traces"}
:::

In this tutorial, we will guide you through visualizing traces generated
by a sample Effect application. The sample application has also been
configured to export traces and/or metrics via HTTP using [OTLP
format](https://github.com/open-telemetry/opentelemetry-proto/blob/main/docs/specification.md).

To visualize the traces being exported by our application, we will use a
Docker image that contains a preconfigured OpenTelemetry backend based
on the [OpenTelemetry
Collector](https://opentelemetry.io/docs/collector),
[Prometheus](https://github.com/prometheus/prometheus),
[Loki](https://github.com/grafana/loki),
[Tempo](https://github.com/grafana/tempo), and
[Grafana](https://github.com/grafana/grafana).

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Tools Explained

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#tools-explained){.anchor-link
aria-labelledby="tools-explained"}
:::

Let's understand the tools we'll be using in simple terms:

- **Docker**: Docker allows us to run applications in containers. Think
  of a container as a lightweight and isolated environment where your
  application can run consistently, regardless of the host system. It's
  a bit like a virtual machine but more efficient.

- **Prometheus**: Prometheus is a monitoring and alerting toolkit. It
  collects metrics and data about your applications and stores them for
  further analysis. This helps in identifying performance issues and
  understanding the behavior of your applications.

- **Loki**: Loki is a log aggregation system inspired by Prometheus. It
  does not index the contents of the logs, but rather a set of labels
  for each log stream.

- **Grafana**: Grafana is a visualization and analytics platform. It
  helps in creating beautiful and interactive dashboards to visualize
  your application's data. You can use it to graphically represent
  metrics collected by Prometheus.

- **Tempo**: Tempo is a distributed tracing system that allows you to
  trace the journey of a request as it flows through your application.
  It provides insights into how requests are processed and helps in
  debugging and optimizing your applications.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Getting Docker

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#getting-docker){.anchor-link
aria-labelledby="getting-docker"}
:::

To get Docker, follow these steps:

1.  Visit the Docker website at <https://www.docker.com/>.

2.  Download Docker Desktop for your operating system (Windows or macOS)
    and install it.

3.  After installation, open Docker Desktop, and it will run in the
    background.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Simulating Traces

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#simulating-traces){.anchor-link
aria-labelledby="simulating-traces"}
:::

1.  **Start the OpenTelemetry Backend**

    Before we begin generating and exporting traces from our sample
    application, we will need to get our OpenTelemetry backend running
    in Docker.

    This can be done using the following command:

    ::: expressive-code
    <figure class="frame is-terminal not-content">
    <pre data-language="sh"><code>docker run -p 3000:3000 -p 4317:4317 -p 4318:4318 --rm -it docker.io/grafana/otel-lgtm</code></pre>
    <div class="copy">
    <div>

    </div>
    </div>
    <figcaption><span class="title"></span><span class="sr-only">Terminal
    window</span></figcaption>
    </figure>
    :::

2.  **Install Dependencies**

    We also need to install a few additional dependencies, as well as
    the latest version of `effect`{dir="auto"}:

    ::: {.tablist-wrapper .not-content .astro-5yo7dsk7}
    - [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0yNCA3LjI5NkwwIDcuMjk2TDAgMTUuMjk2TDYuODE2IDE1LjI5Nkw2LjgxNiAxNi43MDRMMTIuMDk2IDE2LjcwNEwxMi4wOTYgMTUuMzkyTDI0IDE1LjM5MkwyNCA3LjI5NlpNNi41OTIgOC43MDRMNi41OTIgMTMuOTg0TDUuMzEyIDEzLjk4NEw1LjMxMiAxMC4xMTJMNCAxMC4xMTJMNCAxMy45ODRMMS4zMTIgMTMuOTg0TDEuMzEyIDguNzA0TDYuNTkyIDguNzA0Wk0xMy4xODQgMTMuOTg0TDEzLjIxNiAxMy45ODRMMTAuNDk2IDEzLjk4NEwxMC40OTYgMTUuMzkyTDcuODA4IDE1LjM5Mkw3LjgwOCA4LjgwMEwxMy4wODggOC44MDBRMTMuMjE2IDEwLjQwMCAxMy4xODQgMTMuOTg0TDEzLjE4NCAxMy45ODRaTTIyLjU5MiA4LjcwNEwyMi41OTIgMTMuOTg0TDIxLjMxMiAxMy45ODRMMjEuMzEyIDEwLjExMkwyMCAxMC4xMTJMMjAgMTMuOTg0TDE4LjU5MiAxMy45ODRMMTguNTkyIDEwLjExMkwxNy4zMTIgMTAuMTEyTDE3LjMxMiAxMy45ODRMMTQuNTkyIDEzLjk4NEwxNC41OTIgOC43MDRMMjIuNTkyIDguNzA0Wk0xMS45MDQgMTIuNzA0TDExLjkwNCAxMC4xMTJMMTAuNTkyIDEwLjExMkwxMC41OTIgMTIuNzA0TDExLjkwNCAxMi43MDRaIiAvPjwvc3ZnPg==){.astro-5yo7dsk7
      .astro-4rgy7crp} npm](index.html#tab-panel-149){#tab-149
      .astro-5yo7dsk7 role="tab" aria-selected="true" tabindex="0"}
    - [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0wIDB2Ny41aDcuNVYwSDBabTguMjUgMHY3LjVoNy40OThWMEg4LjI1Wm04LjI1IDB2Ny41SDI0VjBoLTcuNVpNOC4yNSA4LjI1djcuNWg3LjQ5OHYtNy41SDguMjVabTguMjUgMHY3LjVIMjR2LTcuNWgtNy41Wk0wIDE2LjVWMjRoNy41di03LjVIMFptOC4yNSAwVjI0aDcuNDk4di03LjVIOC4yNVptOC4yNSAwVjI0SDI0di03LjVoLTcuNVoiIC8+PC9zdmc+){.astro-5yo7dsk7
      .astro-4rgy7crp} pnpm](index.html#tab-panel-150){#tab-150
      .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
    - [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik02LjcyOSAyMS41NDVMNi43MjkgMjEuNTQ1UTYuMzkzIDIxLjM3NyA2LjIyNSAyMS4wNDFMNi4yMjUgMjEuMDQxUTYuMDk5IDIwLjkxNSA2LjA3OCAyMC45MTVRNi4wNTcgMjAuOTE1IDUuOTczIDIxLjA0MVE1Ljg4OSAyMS4xNjcgNS44MjYgMjEuNDE5UTUuNzYzIDIxLjY3MSA1LjY3OSAyMS44MzlMNS42NzkgMjEuODM5UTUuMzg1IDIyLjgwNSA0LjgzOSAyMy4xNDFRNC4yOTMgMjMuNDc3IDMuMzI3IDIzLjI2N0wzLjMyNyAyMy4yNjdRMy4wNzUgMjMuMjY3IDIuNTI5IDIzLjAxNUwyLjUyOSAyMy4wMTVRMS43MzEgMjIuNTk1IDIuMTUxIDIxLjgzOUwyLjE1MSAyMS44MzlRMi4xNTEgMjEuNzU1IDIuMjE0IDIxLjYyOVEyLjI3NyAyMS41MDMgMi4yNzcgMjEuNDE5TDIuMjc3IDIxLjQxOVExLjU2MyAyMS40MTkgMS4zNTMgMjAuNzg5TDEuMzUzIDIwLjc4OVEwLjg0OSAxOS40NDUgMS4wMTcgMTguNDE2UTEuMTg1IDE3LjM4NyAyLjE1MSAxNi40MjFMMi4xNTEgMTYuNDIxTDIuMjM1IDE2LjI1M1EyLjQwMyAxNS45NTkgMi40MDMgMTUuNzkxTDIuNDAzIDE1Ljc5MVEyLjQwMyAxNC4zNjMgMi42OTcgMTMuMzEzTDIuNjk3IDEzLjMxM1EzLjAzMyAxMi4wNTMgMy44MzEgMTEuMDQ1TDMuODMxIDExLjA0NVE0LjUwMyAxMC4xNjMgNS40MjcgOS42MTdMNS40MjcgOS42MTdRNS41OTUgOS41MzMgNS42MTYgOS40MDdRNS42MzcgOS4yODEgNS41NTMgOS4wNzFMNS41NTMgOS4wNzFRNC44MzkgOC4xODkgNC42MjkgNi45NzFMNC42MjkgNi45NzFRNC41NDUgNi42MzUgNC42NzEgNi4yMTVMNC42NzEgNi4yMTVRNC43NTUgNS45MjEgNS4wMDcgNS40MTdMNS4wMDcgNS40MTdMNS4xNzUgNS4wMzlRNS40MjcgNC43NDUgNS41NTMgNC43NDVMNS41NTMgNC43NDVRNS45MzEgNC42NjEgNi41NjEgNC4xOTlMNi41NjEgNC4xOTlMNi44NTUgMy45ODlROC4xNTcgMi42NDUgMTAuMTMxIDIuNjQ1TDEwLjEzMSAyLjY0NVExMC4zNDEgMi42NDUgMTAuNDQ2IDIuNTgyUTEwLjU1MSAyLjUxOSAxMC41NTEgMi4zOTNMMTAuNTUxIDIuMzkzUTEwLjcxOSAxLjU5NSAxMS4zMDcgMC44MzlMMTEuMzA3IDAuODM5TDExLjcyNyAwLjQxOVExMS45MzcgMC4yMDkgMTIuMTY4IDAuMjMwUTEyLjM5OSAwLjI1MSAxMi41MjUgMC41NDVMMTIuNTI1IDAuNTQ1UTEyLjc3NyAxLjAwNyAxMy4xNTUgMS44NDdMMTMuMTU1IDEuODQ3TDEzLjQwNyAyLjM5M1ExMy42MTcgMi43MjkgMTMuODI3IDIuNTE5TDEzLjgyNyAyLjUxOVExNC4zMzEgMi4zMDkgMTQuNDk5IDIuMjg4UTE0LjY2NyAyLjI2NyAxNC43NTEgMi4zOTNRMTQuODM1IDIuNTE5IDE1LjAwMyAzLjA2NUwxNS4wMDMgMy4wNjVRMTYuMDExIDcuMjY1IDEzLjcwMSAxMC45MTlMMTMuNzAxIDEwLjkxOVExMy42MTcgMTEuMDQ1IDEzLjQyOCAxMS4zMThRMTMuMjM5IDExLjU5MSAxMy4xNTUgMTEuNzU5UTEzLjA3MSAxMS45MjcgMTMuMDkyIDEyLjA1M1ExMy4xMTMgMTIuMTc5IDEzLjI4MSAxMi4zODlMMTMuMjgxIDEyLjM4OVExNC4xNjMgMTMuMTQ1IDE0Ljc1MSAxNC4xOTVRMTUuMzM5IDE1LjI0NSAxNS41MDcgMTYuNDIxTDE1LjUwNyAxNi40MjFRMTUuNzE3IDE3Ljg5MSAxNS41MDcgMTkuMzE5TDE1LjUwNyAxOS4zMTlRMTUuNDIzIDE5LjY5NyAxNS41MDcgMTkuNzYwUTE1LjU5MSAxOS44MjMgMTUuOTI3IDE5LjczOUwxNS45MjcgMTkuNzM5UTE3LjM5NyAxOS4yNzcgMTguNTMxIDE4LjUyMUwxOC41MzEgMTguNTIxTDE4Ljg2NyAxOC4zNTNRMTkuNjIzIDE3Ljg5MSAyMC4wNDMgMTcuNzIzTDIwLjA0MyAxNy43MjNRMjAuNjczIDE3LjQyOSAyMS4zMDMgMTcuMzQ1TDIxLjMwMyAxNy4zNDVMMjEuNjgxIDE3LjM0NVEyMi4xMDEgMTcuMjYxIDIyLjM3NCAxNy4zNjZRMjIuNjQ3IDE3LjQ3MSAyMi44MzYgMTcuNzIzUTIzLjAyNSAxNy45NzUgMjMuMDI1IDE4LjI2OUwyMy4wMjUgMTguMjY5UTIzLjAyNSAxOC44NTcgMjIuMzUzIDE5LjA2N0wyMi4zNTMgMTkuMDY3UTIwLjYzMSAxOS40MDMgMTguODA0IDIwLjcyNlExNi45NzcgMjIuMDQ5IDE0LjQ1NyAyMi43MjFMMTQuNDU3IDIyLjcyMVExNC4zNzMgMjIuNzIxIDE0LjIwNSAyMi44MDVRMTQuMDM3IDIyLjg4OSAxMy45NTMgMjMuMDE1TDEzLjk1MyAyMy4wMTVRMTMuNjU5IDIzLjIyNSAxMy4zMjMgMjMuMzA5TDEzLjMyMyAyMy4zMDlRMTMuMTEzIDIzLjM5MyAxMi42NTEgMjMuNDM1TDEyLjY1MSAyMy40MzVMMTIuMjMxIDIzLjUxOUwxMS44OTUgMjMuNTYxUTkuMzc1IDIzLjc3MSA4LjAzMSAyMy43NzFMOC4wMzEgMjMuNzcxUTcuMjc1IDIzLjc3MSA2LjcyOSAyMy42NDVMNi43MjkgMjMuNjQ1UTUuOTczIDIzLjM5MyA1LjgwNSAyMi44ODlMNS44MDUgMjIuODg5UTUuNTk1IDIyLjA5MSA2LjIyNSAyMS42NzFMNi4yMjUgMjEuNjcxUTYuMzUxIDIxLjY3MSA2LjUxOSAyMS42MDhRNi42ODcgMjEuNTQ1IDYuNzI5IDIxLjU0NVoiIC8+PC9zdmc+){.astro-5yo7dsk7
      .astro-4rgy7crp} Yarn](index.html#tab-panel-151){#tab-151
      .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
    - [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0xMS45NjYgMjIuMTMyYzYuNjA5IDAgMTEuOTY2LTQuMzI2IDExLjk2Ni05LjY2MSAwLTMuMzA4LTIuMDUxLTYuMjMtNS4yMDQtNy45NjMtMS4yODMtLjcxMy0yLjI5MS0xLjM1My0zLjEzLTEuODg1QzE0LjAxOCAxLjYxOSAxMy4wNDMgMSAxMS45NjYgMWMtMS4wOTQgMC0yLjMyNy43ODMtMy45NTUgMS44MTZhNDkuNzggNDkuNzggMCAwIDEtMi44MDggMS42OTJDMi4wNTEgNi4yNDEgMCA5LjE2MyAwIDEyLjQ3MWMwIDUuMzM1IDUuMzU3IDkuNjYxIDExLjk2NiA5LjY2MVptLTEuMzk3LTE3LjgzYTUuODg1IDUuODg1IDAgMCAwIC40OTctMi40MDNjMC0uMTQ0LjIwMS0uMTg2LjIyOS0uMDI4LjY1NiAyLjc3NS0uOSA0LjE1LTIuMDUxIDQuNjEtLjEyNC4wNDgtLjE5OS0uMTItLjEwMy0uMjA4YTUuNzQ3IDUuNzQ3IDAgMCAwIDEuNDI4LTEuOTcxWm0yLjA1Mi0uMTAyYTUuNzk1IDUuNzk1IDAgMCAwLS43OC0yLjN2LS4wMTVjLS4wNjgtLjEyMy4wODYtLjI2My4xODUtLjE3MiAxLjk1NiAyLjEwNSAxLjMwMyA0LjA1NS41NTQgNS4wMzctLjA4Mi4xMDItLjIyOS0uMDAzLS4xODgtLjEyNmE1LjgzNyA1LjgzNyAwIDAgMCAuMjI5LTIuNDI0Wm0xLjc3MS0uNTU5YTUuNzA5IDUuNzA5IDAgMCAwLTEuNjA3LTEuODAxdi0uMDE0Yy0uMTEyLS4wODUtLjAyNC0uMjc0LjExMy0uMjE4IDIuNTg4IDEuMDg0IDIuNzY2IDMuMTcxIDIuNDUyIDQuMzk1YS4xMTYuMTE2IDAgMCAxLS4xMy4wOS4xMS4xMSAwIDAgMS0uMDcxLS4wNDUuMTE4LjExOCAwIDAgMS0uMDIyLS4wODMgNS44NjMgNS44NjMgMCAwIDAtLjczNS0yLjMyNFpNOS4zMiA0LjJjLS42MTYuNTQ0LTEuMjc5Ljc1OC0yLjA1OC45OTctLjExNiAwLS4xOTQtLjA3OC0uMTU1LS4xOCAxLjc0Ny0uOTA3IDIuMzY5LTEuNjQ1IDIuOTktMi43NzEgMCAwIC4xNTUtLjExNy4xODguMDg1IDAgLjMwMy0uMzQ4IDEuMzI1LS45NjUgMS44NjlabTQuOTMxIDExLjIwNWEyLjk1IDIuOTUgMCAwIDEtLjkzNSAxLjU0OSAyLjE2IDIuMTYgMCAwIDEtMS4yODIuNjE4IDIuMTY3IDIuMTY3IDAgMCAxLTEuMzIzLS42MTggMi45NSAyLjk1IDAgMCAxLS45MjMtMS41NDkuMjQzLjI0MyAwIDAgMSAuMDY0LS4xOTcuMjMuMjMgMCAwIDEgLjE5Mi0uMDY5aDMuOTU0YS4yMjcuMjI3IDAgMCAxIC4yNDQuMTZjLjAxLjAzNS4wMTQuMDcuMDA5LjEwNlptLTUuNDQzLTIuMTdhMS44NSAxLjg1IDAgMCAxLTIuMzc3LS4yNDQgMS45NjkgMS45NjkgMCAwIDEtLjIzMy0yLjQ0Yy4yMDctLjMxOC41MDItLjU2NS44NDYtLjcxMWExLjg0IDEuODQgMCAwIDEgMi4wNTMuNDJjLjI2NC4yNy40NDMuNjE2LjUxNS45OWExLjk4IDEuOTggMCAwIDEtLjEwOCAxLjExOGMtLjE0Mi4zNS0uMzg0LjY1My0uNjk2Ljg2N1ptOC40NzEuMDA1YTEuODUgMS44NSAwIDAgMS0yLjM3NC0uMjUyIDEuOTU2IDEuOTU2IDAgMCAxLS41NDYtMS4zNjJjMC0uMzgzLjExLS43NTguMzE5LTEuMDc2LjIwNy0uMzE4LjUwMi0uNTY2Ljg0Ny0uNzExYTEuODQgMS44NCAwIDAgMSAxLjA5LS4xMDhjLjM2Ni4wNzYuNzAyLjI2MS45NjUuNTMzcy40NC42MTcuNTEyLjk5M2ExLjk4IDEuOTggMCAwIDEtLjExMyAxLjExOCAxLjkyMiAxLjkyMiAwIDAgMS0uNy44NjVaIiAvPjwvc3ZnPg==){.astro-5yo7dsk7
      .astro-4rgy7crp} Bun](index.html#tab-panel-152){#tab-152
      .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
    :::

    :::: {#tab-panel-149 aria-labelledby="tab-149" role="tabpanel"}
    ::: expressive-code
    <figure class="frame is-terminal not-content">
    <pre data-language="sh"><code># If not already installednpm install effect# Required to integrate Effect with OpenTelemetrynpm install @effect/opentelemetry# Required to export traces over HTTP in OTLP formatnpm install @opentelemetry/exporter-trace-otlp-http# Required by all applicationsnpm install @opentelemetry/sdk-trace-base# For NodeJS applicationsnpm install @opentelemetry/sdk-trace-node# For browser applicationsnpm install @opentelemetry/sdk-trace-web# If you also need to export metricsnpm install @opentelemetry/sdk-metrics</code></pre>
    <div class="copy">
    <div>

    </div>
    </div>
    <figcaption><span class="title"></span><span class="sr-only">Terminal
    window</span></figcaption>
    </figure>
    :::
    ::::

    :::: {#tab-panel-150 aria-labelledby="tab-150" role="tabpanel" hidden=""}
    ::: expressive-code
    <figure class="frame is-terminal not-content">
    <pre data-language="sh"><code># If not already installedpnpm add effect# Required to integrate Effect with OpenTelemetrypnpm add @effect/opentelemetry# Required to export traces over HTTP in OTLP formatpnpm add @opentelemetry/exporter-trace-otlp-http# Required by all applicationspnpm add @opentelemetry/sdk-trace-base# For NodeJS applicationspnpm add @opentelemetry/sdk-trace-node# For browser applicationspnpm add @opentelemetry/sdk-trace-web# If you also need to export metricspnpm add @opentelemetry/sdk-metrics</code></pre>
    <div class="copy">
    <div>

    </div>
    </div>
    <figcaption><span class="title"></span><span class="sr-only">Terminal
    window</span></figcaption>
    </figure>
    :::
    ::::

    :::: {#tab-panel-151 aria-labelledby="tab-151" role="tabpanel" hidden=""}
    ::: expressive-code
    <figure class="frame is-terminal not-content">
    <pre data-language="sh"><code># If not already installedyarn add effect# Required to integrate Effect with OpenTelemetryyarn add @effect/opentelemetry# Required to export traces over HTTP in OTLP formatyarn add @opentelemetry/exporter-trace-otlp-http# Required by all applicationsyarn add @opentelemetry/sdk-trace-base# For NodeJS applicationsyarn add @opentelemetry/sdk-trace-node# For browser applicationsyarn add @opentelemetry/sdk-trace-web# If you also need to export metricsyarn add @opentelemetry/sdk-metrics</code></pre>
    <div class="copy">
    <div>

    </div>
    </div>
    <figcaption><span class="title"></span><span class="sr-only">Terminal
    window</span></figcaption>
    </figure>
    :::
    ::::

    :::: {#tab-panel-152 aria-labelledby="tab-152" role="tabpanel" hidden=""}
    ::: expressive-code
    <figure class="frame is-terminal not-content">
    <pre data-language="sh"><code># If not already installedbun add effect# Required to integrate Effect with OpenTelemetrybun add @effect/opentelemetry# Required to export traces over HTTP in OTLP formatbun add @opentelemetry/exporter-trace-otlp-http# Required by all applicationsbun add @opentelemetry/sdk-trace-base# For NodeJS applicationsbun add @opentelemetry/sdk-trace-node# For browser applicationsbun add @opentelemetry/sdk-trace-web# If you also need to export metricsbun add @opentelemetry/sdk-metrics</code></pre>
    <div class="copy">
    <div>

    </div>
    </div>
    <figcaption><span class="title"></span><span class="sr-only">Terminal
    window</span></figcaption>
    </figure>
    :::
    ::::

3.  **Simulate Traces**

    Now, let's simulate traces using a sample Node.js application.

    The following code simulates a set of tasks and generates traces for
    each task. It also sets up a `Layer`{dir="auto"} which will export
    traces from our application to our OpenTelemetry backend over HTTP
    in OTLP format.

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

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    2
    :::
    ::::

    ::::: code
    [import]{style="--0:#BF3441;--1:#F97583"}[ {
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>import NodeSdk</code></pre>
    </figure>
    :::
    ::::

    [NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[ }
    ]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/opentelemetry\"]{style="--0:#032F62;--1:#9ECBFF"}
    :::::
    ::::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    3
    :::
    ::::

    ::::: code
    [import]{style="--0:#BF3441;--1:#F97583"}[ {
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>class BatchSpanProcessor</code></pre>
    </figure>
    :::
    ::::

    [BatchSpanProcessor]{style="--0:#24292E;--1:#E1E4E8"}[ }
    ]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[\"@opentelemetry/sdk-trace-base\"]{style="--0:#032F62;--1:#9ECBFF"}
    :::::
    ::::::::

    ::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    4
    :::
    ::::

    :::::: code
    [import]{style="--0:#BF3441;--1:#F97583"}[ {
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    ::::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>class OTLPTraceExporter</code></pre>
    </figure>
    :::

    ::: twoslash-popup-docs
    Collector Trace Exporter for Node
    :::
    :::::

    [OTLPTraceExporter]{style="--0:#24292E;--1:#E1E4E8"}[ }
    ]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[\"@opentelemetry/exporter-trace-otlp-http\"]{style="--0:#032F62;--1:#9ECBFF"}
    ::::::
    :::::::::

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
    [// Function to simulate a task with possible
    subtasks]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    7
    :::
    ::::

    ::::: code
    [const]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
    (]{style="--0:#24292E;--1:#E1E4E8"}
    :::::
    ::::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    8
    :::
    ::::

    ::::: code
    [ ]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#AE4B07;--1:#FFAB70"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>name: string</code></pre>
    </figure>
    :::
    ::::

    [name]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
    :::::
    ::::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    9
    :::
    ::::

    ::::: code
    [ ]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#AE4B07;--1:#FFAB70"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>delay: number</code></pre>
    </figure>
    :::
    ::::

    [delay]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
    :::::
    ::::::::

    ::::::::::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    10
    :::
    ::::

    :::::::::::::: code
    [ ]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#AE4B07;--1:#FFAB70"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>children: readonly Effect.Effect&lt;void, never, never&gt;[]</code></pre>
    </figure>
    :::
    ::::

    [children]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>interface ReadonlyArray&lt;T&gt;</code></pre>
    </figure>
    :::
    ::::

    [ReadonlyArray]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
    The `Effect` interface defines a value that describes a workflow or
    job, which can succeed or fail.

    **Details**

    The `Effect` interface represents a computation that can model a
    workflow involving various types of operations, such as synchronous,
    asynchronous, concurrent, and parallel interactions. It operates
    within a context of type `R`, and the result can either be a success
    with a value of type `A` or a failure with an error of type `E`. The
    `Effect` is designed to handle complex interactions with external
    resources, offering advanced features such as fiber-based
    concurrency, scheduling, interruption handling, and scalability.
    This makes it suitable for tasks that require fine-grained control
    over concurrency and error management.

    To execute an `Effect` value, you need a `Runtime`, which provides
    the environment necessary to run and manage the computation.
    :::

    ::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
    [\@since]{.twoslash-popup-docs-tag-name} ―
    [2.0.0]{.twoslash-popup-docs-tag-value}

    [\@since]{.twoslash-popup-docs-tag-name} ―
    [2.0.0]{.twoslash-popup-docs-tag-value}
    :::
    ::::::

    [Effect]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[void]{style="--0:#005CC5;--1:#79B8FF"}[\>\>
    ]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
    \[\]]{style="--0:#24292E;--1:#E1E4E8"}
    ::::::::::::::
    :::::::::::::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    11
    :::
    ::::

    ::: code
    [)
    ]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
    :::
    ::::::

    :::::::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    12
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

    The generator functions work similarly to `async/await` but with
    more explicit control over the execution of effects. You can
    `yield*` values from effects and return the final result at the end.

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
    13
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
    during the execution of your effects. By default, logs are recorded
    at the `INFO` level, but this can be adjusted using other logging
    utilities (`Logger.withMinimumLogLevel`). Multiple items, including
    `Cause` instances, can be logged in a single call. When logging
    `Cause` instances, detailed error information is included in the log
    output.

    The log output includes useful metadata like the current timestamp,
    log level, and fiber ID, making it suitable for debugging and
    tracking purposes. This function does not interrupt or alter the
    effect\'s execution flow.

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

    [log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>name: string</code></pre>
    </figure>
    :::
    ::::

    [name]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
    :::::::::::::
    ::::::::::::::::

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
    <pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
    </figure>
    :::

    :::: twoslash-popup-docs
    Suspends the execution of an effect for a specified `Duration`.

    **Details**

    This function pauses the execution of an effect for a given
    duration. It is asynchronous, meaning that it does not block the
    fiber executing the effect. Instead, the fiber is suspended during
    the delay period and can resume once the specified time has passed.

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

    [sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>delay: number</code></pre>
    </figure>
    :::
    ::::

    [delay]{style="--0:#24292E;--1:#E1E4E8"}[}
    millis\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
    :::::::::::::
    ::::::::::::::::

    :::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    15
    :::
    ::::

    ::::::: code
    [ ]{.indent}[for]{style="--0:#BF3441;--1:#F97583"}[
    (]{style="--0:#24292E;--1:#E1E4E8"}[const]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#005CC5;--1:#79B8FF"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const child: Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [child]{style="--0:#005CC5;--1:#79B8FF"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[of]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>children: readonly Effect.Effect&lt;void, never, never&gt;[]</code></pre>
    </figure>
    :::
    ::::

    [children]{style="--0:#24292E;--1:#E1E4E8"}[)
    {]{style="--0:#24292E;--1:#E1E4E8"}
    :::::::
    ::::::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    16
    :::
    ::::

    ::::: code
    [ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const child: Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [child]{style="--0:#24292E;--1:#E1E4E8"}
    :::::
    ::::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    17
    :::
    ::::

    ::: code
    [[
    ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}]{style="--0:#24292E;--1:#E1E4E8"}
    :::
    ::::::

    :::::::::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    18
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
    <pre data-language="ts"><code>const sleep: (duration: DurationInput) =&gt; Effect.Effect&lt;void&gt;</code></pre>
    </figure>
    :::

    :::: twoslash-popup-docs
    Suspends the execution of an effect for a specified `Duration`.

    **Details**

    This function pauses the execution of an effect for a given
    duration. It is asynchronous, meaning that it does not block the
    fiber executing the effect. Instead, the fiber is suspended during
    the delay period and can resume once the specified time has passed.

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

    [sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>delay: number</code></pre>
    </figure>
    :::
    ::::

    [delay]{style="--0:#24292E;--1:#E1E4E8"}[}
    millis\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
    :::::::::::::
    ::::::::::::::::

    ::::::::::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    19
    :::
    ::::

    :::::::::::::: code
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

    :::::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const withSpan: (name: string, options?: SpanOptions | undefined) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, ParentSpan&gt;&gt; (+1 overload)</code></pre>
    </figure>
    :::

    ::: twoslash-popup-docs
    Wraps the effect with a new span for tracing.
    :::

    ::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
    [\@since]{.twoslash-popup-docs-tag-name} ―
    [2.0.0]{.twoslash-popup-docs-tag-value}
    :::
    ::::::

    [withSpan]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>name: string</code></pre>
    </figure>
    :::
    ::::

    [name]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
    ::::::::::::::
    :::::::::::::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    20
    :::
    ::::

    ::: code
    :::
    ::::::

    :::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    21
    :::
    ::::

    ::::::: code
    [const]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#005CC5;--1:#79B8FF"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const poll: Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [poll]{style="--0:#005CC5;--1:#79B8FF"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"/poll\"]{style="--0:#032F62;--1:#9ECBFF"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
    :::::::
    ::::::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    22
    :::
    ::::

    ::: code
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    23
    :::
    ::::

    ::: code
    [// Create a program with tasks and
    subtasks]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    24
    :::
    ::::

    ::::::: code
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
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"client\"]{style="--0:#032F62;--1:#9ECBFF"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[,
    \[]{style="--0:#24292E;--1:#E1E4E8"}
    :::::::
    ::::::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    25
    :::
    ::::

    ::::: code
    [ ]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"/api\"]{style="--0:#032F62;--1:#9ECBFF"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[3]{style="--0:#005CC5;--1:#79B8FF"}[,
    \[]{style="--0:#24292E;--1:#E1E4E8"}
    :::::
    ::::::::

    :::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    26
    :::
    ::::

    ::::::: code
    [ ]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"/authN\"]{style="--0:#032F62;--1:#9ECBFF"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[4]{style="--0:#005CC5;--1:#79B8FF"}[,
    \[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"/authZ\"]{style="--0:#032F62;--1:#9ECBFF"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[5]{style="--0:#005CC5;--1:#79B8FF"}[)\]),]{style="--0:#24292E;--1:#E1E4E8"}
    :::::::
    ::::::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    27
    :::
    ::::

    ::::: code
    [ ]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"/payment
    Gateway\"]{style="--0:#032F62;--1:#9ECBFF"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[6]{style="--0:#005CC5;--1:#79B8FF"}[,
    \[]{style="--0:#24292E;--1:#E1E4E8"}
    :::::
    ::::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    28
    :::
    ::::

    ::::: code
    [ ]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"DB\"]{style="--0:#032F62;--1:#9ECBFF"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[7]{style="--0:#005CC5;--1:#79B8FF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
    :::::
    ::::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    29
    :::
    ::::

    ::::: code
    [ ]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Ext.
    Merchant\"]{style="--0:#032F62;--1:#9ECBFF"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[8]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
    :::::
    ::::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    30
    :::
    ::::

    ::: code
    [[
    ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[\]),]{style="--0:#24292E;--1:#E1E4E8"}
    :::
    ::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    31
    :::
    ::::

    ::::: code
    [ ]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"/dispatch\"]{style="--0:#032F62;--1:#9ECBFF"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[9]{style="--0:#005CC5;--1:#79B8FF"}[,
    \[]{style="--0:#24292E;--1:#E1E4E8"}
    :::::
    ::::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    32
    :::
    ::::

    ::::: code
    [ ]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"/dispatch/search\"]{style="--0:#032F62;--1:#9ECBFF"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[10]{style="--0:#005CC5;--1:#79B8FF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
    :::::
    ::::::::

    ::::::::::::::::::::::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    33
    :::
    ::::

    :::::::::::::::::::::::::: code
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

    :::::::::::::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const all: &lt;readonly [Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;], {    concurrency: &quot;inherit&quot;;}&gt;(arg: readonly [Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;], options?: {    concurrency: &quot;inherit&quot;;} | undefined) =&gt; Effect.Effect&lt;[void, void, void], never, never&gt;</code></pre>
    </figure>
    :::

    ::::::::::: twoslash-popup-docs
    Combines multiple effects into one, returning results based on the
    input structure.

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

    the effects are executed sequentially, and the result is a new
    effect containing the results as a tuple. The results in the tuple
    match the order of the effects passed to `Effect.all`.

    **Concurrency**

    You can control the execution order (e.g., sequential vs.
    concurrent) using the `concurrency` option.

    **Short-Circuiting Behavior**

    This function stops execution on the first error it encounters, this
    is called \"short-circuiting\". If any effect in the collection
    fails, the remaining effects will not run, and the error will be
    propagated. To change this behavior, you can use the `mode` option,
    which allows all effects to run and collect results as `Either` or
    `Option`.

    **The `mode` option**

    The `{ mode: "either" }` option changes the behavior of `Effect.all`
    to ensure all effects run, even if some fail. Instead of stopping on
    the first failure, this mode collects both successes and failures,
    returning an array of `Either` instances where each result is either
    a `Right` (success) or a `Left` (failure).

    Similarly, the `{ mode: "validate" }` option uses `Option` to
    indicate success or failure. Each effect returns `None` for success
    and `Some` with the error for failure.

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
    <pre data-language="ts"><code>const poll: Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [poll]{style="--0:#24292E;--1:#E1E4E8"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const poll: Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [poll]{style="--0:#24292E;--1:#E1E4E8"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const poll: Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [poll]{style="--0:#24292E;--1:#E1E4E8"}[\], {
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>concurrency: &quot;inherit&quot;</code></pre>
    </figure>
    :::
    ::::

    [concurrency]{style="--0:#24292E;--1:#E1E4E8"}[:
    ]{style="--0:#24292E;--1:#E1E4E8"}[\"inherit\"]{style="--0:#032F62;--1:#9ECBFF"}[
    }),]{style="--0:#24292E;--1:#E1E4E8"}
    ::::::::::::::::::::::::::
    :::::::::::::::::::::::::::::

    :::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    34
    :::
    ::::

    ::::: code
    [ ]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const task: (name: string, delay: number, children?: ReadonlyArray&lt;Effect.Effect&lt;void&gt;&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"/pollDriver/{id}\"]{style="--0:#032F62;--1:#9ECBFF"}[,
    ]{style="--0:#24292E;--1:#E1E4E8"}[11]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
    :::::
    ::::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    35
    :::
    ::::

    ::: code
    [[
    ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[\])]{style="--0:#24292E;--1:#E1E4E8"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    36
    :::
    ::::

    ::: code
    [[
    ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[\])]{style="--0:#24292E;--1:#E1E4E8"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    37
    :::
    ::::

    ::: code
    [\])]{style="--0:#24292E;--1:#E1E4E8"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    38
    :::
    ::::

    ::: code
    :::
    ::::::

    ::::::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    39
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
    <pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [NodeSdkLive]{style="--0:#005CC5;--1:#79B8FF"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>import NodeSdk</code></pre>
    </figure>
    :::
    ::::

    [NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    ::::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>const layer: (evaluate: LazyArg&lt;NodeSdk.Configuration&gt;) =&gt; Layer&lt;Resource&gt; (+1 overload)</code></pre>
    </figure>
    :::

    ::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
    [\@since]{.twoslash-popup-docs-tag-name} ―
    [1.0.0]{.twoslash-popup-docs-tag-value}
    :::
    :::::

    [layer]{style="--0:#6F42C1;--1:#B392F0"}[(()
    ]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
    ({]{style="--0:#24292E;--1:#E1E4E8"}
    ::::::::::
    :::::::::::::

    :::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    40
    :::
    ::::

    ::::::: code
    [[
    ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>Configuration.resource?: {    readonly serviceName: string;    readonly serviceVersion?: string;    readonly attributes?: Attributes;} | undefined</code></pre>
    </figure>
    :::
    ::::

    [resource]{style="--0:#24292E;--1:#E1E4E8"}[: {
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#24292E;--1:#E1E4E8"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>serviceName: string</code></pre>
    </figure>
    :::
    ::::

    [serviceName]{style="--0:#24292E;--1:#E1E4E8"}[:
    ]{style="--0:#24292E;--1:#E1E4E8"}[\"example\"]{style="--0:#032F62;--1:#9ECBFF"}[
    },]{style="--0:#24292E;--1:#E1E4E8"}
    :::::::
    ::::::::::

    ::::::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    41
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
    <pre data-language="ts"><code>Configuration.spanProcessor?: SpanProcessor | readonly SpanProcessor[] | undefined</code></pre>
    </figure>
    :::
    ::::

    [spanProcessor]{style="--0:#24292E;--1:#E1E4E8"}[:
    ]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    :::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>new BatchSpanProcessor&lt;BufferConfig&gt;(_exporter: SpanExporter, config?: BufferConfig | undefined): BatchSpanProcessor</code></pre>
    </figure>
    :::
    ::::

    [BatchSpanProcessor]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
    ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
    style="--0:#6F42C1;--1:#B392F0"}

    ::::: {.twoslash-popup-container .not-content}
    []{.twoslash-popup-code-type}

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>new OTLPTraceExporter(config?: OTLPExporterNodeConfigBase): OTLPTraceExporter</code></pre>
    </figure>
    :::

    ::: twoslash-popup-docs
    Collector Trace Exporter for Node
    :::
    :::::

    [OTLPTraceExporter]{style="--0:#6F42C1;--1:#B392F0"}[())]{style="--0:#24292E;--1:#E1E4E8"}
    ::::::::::
    :::::::::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    42
    :::
    ::::

    ::: code
    [}))]{style="--0:#24292E;--1:#E1E4E8"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    43
    :::
    ::::

    ::: code
    :::
    ::::::

    ::::::::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    44
    :::
    ::::

    :::::::::::: code
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

    This function runs an effect and converts its result into a
    `Promise`. If the effect succeeds, the `Promise` will resolve with
    the successful result. If the effect fails, the `Promise` will
    reject with an error, which includes the failure details of the
    effect.

    The optional `options` parameter allows you to pass an `AbortSignal`
    for cancellation, enabling more fine-grained control over
    asynchronous tasks.

    **When to Use**

    Use this function when you need to execute an effect and work with
    its result in a promise-based system, such as when integrating with
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
    [\@see]{.twoslash-popup-docs-tag-name} ― [runPromiseExit for a
    version that returns an `Exit` type instead of
    rejecting.]{.twoslash-popup-docs-tag-value}

    [\@since]{.twoslash-popup-docs-tag-name} ―
    [2.0.0]{.twoslash-popup-docs-tag-value}
    :::
    ::::::::

    [runPromise]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
    ::::::::::::
    :::::::::::::::

    :::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    45
    :::
    ::::

    ::::::: code
    [[
    ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
    <pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;void, never, never&gt;, ab: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;, bc: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
    </figure>
    :::
    ::::

    [pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
    :::::::
    ::::::::::

    :::::::::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    46
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
    <pre data-language="ts"><code>const provide: &lt;Resource, never, never&gt;(layer: Layer&lt;Resource, never, never&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, Resource&gt;&gt; (+9 overloads)</code></pre>
    </figure>
    :::

    :::: twoslash-popup-docs
    Provides necessary dependencies to an effect, removing its
    environmental requirements.

    **Details**

    This function allows you to supply the required environment for an
    effect. The environment can be provided in the form of one or more
    `Layer`s, a `Context`, a `Runtime`, or a `ManagedRuntime`. Once the
    environment is provided, the effect can run without requiring
    external dependencies.

    You can compose layers to create a modular and reusable way of
    setting up the environment for effects. For example, layers can be
    used to configure databases, logging services, or any other required
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
    [\@see]{.twoslash-popup-docs-tag-name} ― [provideService for
    providing a service to an effect.]{.twoslash-popup-docs-tag-value}

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
    <pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
    </figure>
    :::
    ::::

    [NodeSdkLive]{style="--0:#24292E;--1:#E1E4E8"}[),]{style="--0:#24292E;--1:#E1E4E8"}
    :::::::::::::
    ::::::::::::::::

    ::::::::::::::::::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    47
    :::
    ::::

    :::::::::::::::::: code
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
    <pre data-language="ts"><code>const catchAllCause: &lt;never, void, never, never&gt;(f: (cause: Cause&lt;never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;A, R&gt;(self: Effect.Effect&lt;A, never, R&gt;) =&gt; Effect.Effect&lt;void | A, never, R&gt; (+1 overload)</code></pre>
    </figure>
    :::

    :::: twoslash-popup-docs
    Handles both recoverable and unrecoverable errors by providing a
    recovery effect.

    **When to Use**

    The `catchAllCause` function allows you to handle all errors,
    including unrecoverable defects, by providing a recovery effect. The
    recovery logic is based on the `Cause` of the error, which provides
    detailed information about the failure.

    **When to Recover from Defects**

    Defects are unexpected errors that typically shouldn\'t be recovered
    from, as they often indicate serious issues. However, in some cases,
    such as dynamically loaded plugins, controlled recovery might be
    needed.

    **Example** (Recovering from All Errors)

    ::: expressive-code
    <figure class="frame">
    <pre data-language="ts"><code>import { Cause, Effect } from &quot;effect&quot;
    // Define an effect that may fail with a recoverable or unrecoverable errorconst program = Effect.fail(&quot;Something went wrong!&quot;)
    // Recover from all errors by examining the causeconst recovered = program.pipe(  Effect.catchAllCause((cause) =&gt;    Cause.isFailure(cause)      ? Effect.succeed(&quot;Recovered from a regular error&quot;)      : Effect.succeed(&quot;Recovered from a defect&quot;)  ))
    Effect.runPromise(recovered).then(console.log)// Output: &quot;Recovered from a regular error&quot;</code></pre>
    </figure>
    :::
    ::::

    ::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
    [\@since]{.twoslash-popup-docs-tag-name} ―
    [2.0.0]{.twoslash-popup-docs-tag-value}
    :::
    :::::::

    [catchAllCause]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
    <pre data-language="ts"><code>const logError: (...message: ReadonlyArray&lt;any&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
    </figure>
    :::

    ::: twoslash-popup-docs
    Logs messages at the ERROR log level.

    **Details**

    This function logs messages at the ERROR level, suitable for
    reporting application errors or failures. These logs are typically
    used for unexpected issues that need immediate attention.
    :::

    ::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
    [\@since]{.twoslash-popup-docs-tag-name} ―
    [2.0.0]{.twoslash-popup-docs-tag-value}
    :::
    ::::::

    [logError]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
    ::::::::::::::::::
    :::::::::::::::::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    48
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
    49
    :::
    ::::

    ::: code
    [)]{style="--0:#24292E;--1:#E1E4E8"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    50
    :::
    ::::

    ::: code
    [/\*]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    51
    :::
    ::::

    ::: code
    [Output:]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    52
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#0
    message=client]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    53
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#0
    message=/api]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    54
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#0
    message=/authN]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    55
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#0
    message=/authZ]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    56
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#0 message=\"/payment
    Gateway\"]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    57
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#0
    message=DB]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    58
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#0 message=\"Ext.
    Merchant\"]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    59
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#0
    message=/dispatch]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    60
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#0
    message=/dispatch/search]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    61
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#3
    message=/poll]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    62
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#4
    message=/poll]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    63
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#5
    message=/poll]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    64
    :::
    ::::

    ::: code
    [timestamp=\... level=INFO fiber=#0
    message=/pollDriver/{id}]{style="--0:#616972;--1:#99A0A6"}
    :::
    ::::::

    :::::: ec-line
    :::: gutter
    ::: {.ln aria-hidden="true"}
    65
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

4.  **Visualize Traces**

    Open your web browser and go to
    `http://localhost:3000/explore`{dir="auto"}. You should see the
    Grafana Tempo TraceQL interface.

    ![Tempo TraceQL
    Interface](../../../_astro/tempo-traceql-interface.BRMJhgb0_24j37H.webp "The Grafana Tempo TraceQL interface without a TraceQL query specified"){loading="lazy"
    decoding="async" fetchpriority="auto" width="3456" height="1164"}

    To get a list of all available traces, we can select the
    `"Search"`{dir="auto"} query type to get a list of all available
    traces.

    ![Tempo Search
    Selector](../../../_astro/tempo-trace-list.BEjjBGal_Z2tWI6Q.webp "The Grafana Tempo TraceQL interface with the Search selector outlined by a red box"){loading="lazy"
    decoding="async" fetchpriority="auto" width="3434" height="1380"}

    Clicking the generated Trace ID will allow us to inspect the details
    of the trace.

    ![Traces in Grafana
    Tempo](../../../_astro/trace.gOBu_0ga_2iuUjI.webp "The details of an Effect application trace visualized as a waterfall diagram in Grafana Tempo"){loading="lazy"
    decoding="async" fetchpriority="auto" width="3054" height="1242"}

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Integrations

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#integrations){.anchor-link
aria-labelledby="integrations"}
:::

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Sentry

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#sentry){.anchor-link
aria-labelledby="sentry"}
:::

To send span data directly to Sentry for analysis, replace the default
span processor with Sentry's implementation. This allows you to use
Sentry as a backend for tracing and debugging.

**Example** (Configuring Sentry for Tracing)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import NodeSdk</code></pre>
</figure>
:::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/opentelemetry\"]{style="--0:#032F62;--1:#9ECBFF"}

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

:::::: code
[import]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class SentrySpanProcessor</code></pre>
</figure>
:::

::: twoslash-popup-docs
Converts OpenTelemetry Spans to Sentry Spans and sends them to Sentry
via the Sentry SDK.
:::
:::::

[SentrySpanProcessor]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@sentry/opentelemetry\"]{style="--0:#032F62;--1:#9ECBFF"}
::::::
:::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::: code
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
<pre data-language="ts"><code>const NodeSdkLive: Layer&lt;Resource, never, never&gt;</code></pre>
</figure>
:::
::::

[NodeSdkLive]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeSdk</code></pre>
</figure>
:::
::::

[NodeSdk]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const layer: (evaluate: LazyArg&lt;NodeSdk.Configuration&gt;) =&gt; Layer&lt;Resource&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[layer]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
({]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Configuration.resource?: {    readonly serviceName: string;    readonly serviceVersion?: string;    readonly attributes?: Attributes;} | undefined</code></pre>
</figure>
:::
::::

[resource]{style="--0:#24292E;--1:#E1E4E8"}[: {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>serviceName: string</code></pre>
</figure>
:::
::::

[serviceName]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"example\"]{style="--0:#032F62;--1:#9ECBFF"}[
},]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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
<pre data-language="ts"><code>Configuration.spanProcessor?: SpanProcessor | readonly SpanProcessor[] | undefined</code></pre>
</figure>
:::
::::

[spanProcessor]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>new SentrySpanProcessor(options?: {    timeout?: number;}): SentrySpanProcessor</code></pre>
</figure>
:::

::: twoslash-popup-docs
Converts OpenTelemetry Spans to Sentry Spans and sends them to Sentry
via the Sentry SDK.
:::
:::::

[SentrySpanProcessor]{style="--0:#6F42C1;--1:#B392F0"}[()]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[}))]{style="--0:#24292E;--1:#E1E4E8"}
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
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/observability/tracing.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Metrics]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../metrics/index.html){.astro-u5aomj4k rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[Supervisor]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../supervisor/index.html){.astro-u5aomj4k
rel="next"}
:::
:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
