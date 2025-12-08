:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Leftovers {#_top .astro-np5lzwrf}
:::
::::

:::::::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::::::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::: sl-markdown-content
In this section, we'll look at handling elements left unconsumed by
sinks. Sinks may process only a portion of the elements from an upstream
source, leaving some elements as "leftovers." Here's how to collect or
ignore these remaining elements.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Collecting Leftovers

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#collecting-leftovers){.anchor-link
aria-labelledby="collecting-leftovers"}
:::

If a sink doesn't consume all elements from the upstream source, the
remaining elements are called leftovers. To capture these leftovers, use
`Sink.collectLeftover`{dir="auto"}, which returns a tuple containing the
result of the sink operation and any unconsumed elements.

**Example** (Collecting Leftover Elements)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Stream</code></pre>
</figure>
:::
:::::

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Sink</code></pre>
</figure>
:::
::::

[Sink]{style="--0:#24292E;--1:#E1E4E8"}[,
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

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
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
<pre data-language="ts"><code>const stream: Stream.Stream&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[stream]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
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

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;[number, number, number, number, number]&gt;(as_0: number, as_1: number, as_2: number, as_3: number, as_4: number) =&gt; Stream.Stream&lt;number, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a stream from an sequence of values.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Stream } from &quot;effect&quot;
const stream = Stream.make(1, 2, 3)
Effect.runPromise(Stream.runCollect(stream)).then(console.log)// { _id: &#39;Chunk&#39;, values: [ 1, 2, 3 ] }</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[3]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[4]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[5]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
[// Take the first 3 elements and collect any
leftovers]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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
<pre data-language="ts"><code>const sink1: Sink.Sink&lt;[Chunk&lt;number&gt;, Chunk&lt;number&gt;], number, never, never, never&gt;</code></pre>
</figure>
:::
::::

[sink1]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Sink</code></pre>
</figure>
:::
::::

[Sink]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const take: &lt;number&gt;(n: number) =&gt; Sink.Sink&lt;Chunk&lt;number&gt;, number, number, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A sink that takes the specified number of values.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[take]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}[3]{style="--0:#005CC5;--1:#79B8FF"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Sink.Sink&lt;Chunk&lt;number&gt;, number, number, never, never&gt;, Sink.Sink&lt;[Chunk&lt;number&gt;, Chunk&lt;number&gt;], number, never, never, never&gt;&gt;(this: Sink.Sink&lt;Chunk&lt;number&gt;, number, number, never, never&gt;, ab: (_: Sink.Sink&lt;Chunk&lt;number&gt;, number, number, never, never&gt;) =&gt; Sink.Sink&lt;[Chunk&lt;number&gt;, Chunk&lt;number&gt;], number, never, never, never&gt;): Sink.Sink&lt;[Chunk&lt;number&gt;, Chunk&lt;number&gt;], number, never, never, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Sink</code></pre>
</figure>
:::
::::

[Sink]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const collectLeftover: &lt;A, In, L, E, R&gt;(self: Sink.Sink&lt;A, In, L, E, R&gt;) =&gt; Sink.Sink&lt;[A, Chunk&lt;L&gt;], In, never, E, R&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Collects the leftovers from the stream when the sink succeeds and
returns them as part of the sink\'s result.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[collectLeftover]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::
::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
:::
::::::

:::::::::::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::::::::::::::::::::::::::::::::::::: code
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
<pre data-language="ts"><code>const runPromise: &lt;[Chunk&lt;number&gt;, Chunk&lt;number&gt;], never&gt;(effect: Effect.Effect&lt;[Chunk&lt;number&gt;, Chunk&lt;number&gt;], never, never&gt;, options?: {    readonly signal?: AbortSignal | undefined;} | undefined) =&gt; Promise&lt;[Chunk&lt;number&gt;, Chunk&lt;number&gt;]&gt;</code></pre>
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
<pre data-language="ts"><code>import Stream</code></pre>
</figure>
:::
::::

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const run: &lt;number, never, never, [Chunk&lt;number&gt;, Chunk&lt;number&gt;], never, never&gt;(self: Stream.Stream&lt;number, never, never&gt;, sink: Sink.Sink&lt;[Chunk&lt;number&gt;, Chunk&lt;number&gt;], number, unknown, never, never&gt;) =&gt; Effect.Effect&lt;[Chunk&lt;number&gt;, Chunk&lt;number&gt;], never, never&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Runs the sink on the stream to produce either the sink\'s result or an
error.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[run]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const stream: Stream.Stream&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[stream]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const sink1: Sink.Sink&lt;[Chunk&lt;number&gt;, Chunk&lt;number&gt;], number, never, never, never&gt;</code></pre>
</figure>
:::
::::

[sink1]{style="--0:#24292E;--1:#E1E4E8"}[)).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Promise&lt;[Chunk&lt;number&gt;, Chunk&lt;number&gt;]&gt;.then&lt;void, never&gt;(onfulfilled?: ((value: [Chunk&lt;number&gt;, Chunk&lt;number&gt;]) =&gt; void | PromiseLike&lt;void&gt;) | null | undefined, onrejected?: ((reason: any) =&gt; PromiseLike&lt;never&gt;) | null | undefined): Promise&lt;void&gt;</code></pre>
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
:::::::::::::::::::::::::::::::::::::
::::::::::::::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[\[]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[{ \_id: \'Chunk\',
values: \[ 1, 2, 3 \] },]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[{ \_id: \'Chunk\',
values: \[ 4, 5 \] }]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[\]]{style="--0:#616972;--1:#99A0A6"}
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
[// Take only the first element and collect the rest as
leftovers]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
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
<pre data-language="ts"><code>const sink2: Sink.Sink&lt;[Option&lt;number&gt;, Chunk&lt;number&gt;], number, never, never, never&gt;</code></pre>
</figure>
:::
::::

[sink2]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Sink</code></pre>
</figure>
:::
::::

[Sink]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const head: &lt;number&gt;() =&gt; Sink.Sink&lt;Option&lt;number&gt;, number, number, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a sink containing the first value.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[head]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[\>().]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Sink.Sink&lt;Option&lt;number&gt;, number, number, never, never&gt;, Sink.Sink&lt;[Option&lt;number&gt;, Chunk&lt;number&gt;], number, never, never, never&gt;&gt;(this: Sink.Sink&lt;Option&lt;number&gt;, number, number, never, never&gt;, ab: (_: Sink.Sink&lt;Option&lt;number&gt;, number, number, never, never&gt;) =&gt; Sink.Sink&lt;[Option&lt;number&gt;, Chunk&lt;number&gt;], number, never, never, never&gt;): Sink.Sink&lt;[Option&lt;number&gt;, Chunk&lt;number&gt;], number, never, never, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Sink</code></pre>
</figure>
:::
::::

[Sink]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const collectLeftover: &lt;A, In, L, E, R&gt;(self: Sink.Sink&lt;A, In, L, E, R&gt;) =&gt; Sink.Sink&lt;[A, Chunk&lt;L&gt;], In, never, E, R&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Collects the leftovers from the stream when the sink succeeds and
returns them as part of the sink\'s result.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[collectLeftover]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::
::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
:::
::::::

:::::::::::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::::::::::::::::::::::::::::::::::::: code
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
<pre data-language="ts"><code>const runPromise: &lt;[Option&lt;number&gt;, Chunk&lt;number&gt;], never&gt;(effect: Effect.Effect&lt;[Option&lt;number&gt;, Chunk&lt;number&gt;], never, never&gt;, options?: {    readonly signal?: AbortSignal | undefined;} | undefined) =&gt; Promise&lt;[Option&lt;number&gt;, Chunk&lt;number&gt;]&gt;</code></pre>
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
<pre data-language="ts"><code>import Stream</code></pre>
</figure>
:::
::::

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const run: &lt;number, never, never, [Option&lt;number&gt;, Chunk&lt;number&gt;], never, never&gt;(self: Stream.Stream&lt;number, never, never&gt;, sink: Sink.Sink&lt;[Option&lt;number&gt;, Chunk&lt;number&gt;], number, unknown, never, never&gt;) =&gt; Effect.Effect&lt;[Option&lt;number&gt;, Chunk&lt;number&gt;], never, never&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Runs the sink on the stream to produce either the sink\'s result or an
error.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[run]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const stream: Stream.Stream&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[stream]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const sink2: Sink.Sink&lt;[Option&lt;number&gt;, Chunk&lt;number&gt;], number, never, never, never&gt;</code></pre>
</figure>
:::
::::

[sink2]{style="--0:#24292E;--1:#E1E4E8"}[)).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Promise&lt;[Option&lt;number&gt;, Chunk&lt;number&gt;]&gt;.then&lt;void, never&gt;(onfulfilled?: ((value: [Option&lt;number&gt;, Chunk&lt;number&gt;]) =&gt; void | PromiseLike&lt;void&gt;) | null | undefined, onrejected?: ((reason: any) =&gt; PromiseLike&lt;never&gt;) | null | undefined): Promise&lt;void&gt;</code></pre>
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
:::::::::::::::::::::::::::::::::::::
::::::::::::::::::::::::::::::::::::::::

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
[\[]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[{ \_id: \'Option\',
\_tag: \'Some\', value: 1 },]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
[[ ]{style="--0:#616972;--1:#99A0A6"}]{.indent}[{ \_id: \'Chunk\',
values: \[ 2, 3, 4, 5 \] }]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::: code
[\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
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
## Ignoring Leftovers

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#ignoring-leftovers){.anchor-link
aria-labelledby="ignoring-leftovers"}
:::

If leftover elements are not needed, you can ignore them using
`Sink.ignoreLeftover`{dir="auto"}. This approach discards any unconsumed
elements, so the sink operation focuses only on the elements it needs.

**Example** (Ignoring Leftover Elements)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Stream</code></pre>
</figure>
:::

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Sink</code></pre>
</figure>
:::
::::

[Sink]{style="--0:#24292E;--1:#E1E4E8"}[,
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

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
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
<pre data-language="ts"><code>const stream: Stream.Stream&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[stream]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
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

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;[number, number, number, number, number]&gt;(as_0: number, as_1: number, as_2: number, as_3: number, as_4: number) =&gt; Stream.Stream&lt;number, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a stream from an sequence of values.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Stream } from &quot;effect&quot;
const stream = Stream.make(1, 2, 3)
Effect.runPromise(Stream.runCollect(stream)).then(console.log)// { _id: &#39;Chunk&#39;, values: [ 1, 2, 3 ] }</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[3]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[4]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[5]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
[// Take the first 3 elements and ignore any remaining
elements]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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
<pre data-language="ts"><code>const sink: Sink.Sink&lt;[Chunk&lt;number&gt;, Chunk&lt;never&gt;], number, never, never, never&gt;</code></pre>
</figure>
:::
::::

[sink]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Sink</code></pre>
</figure>
:::
::::

[Sink]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const take: &lt;number&gt;(n: number) =&gt; Sink.Sink&lt;Chunk&lt;number&gt;, number, number, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A sink that takes the specified number of values.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[take]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}[3]{style="--0:#005CC5;--1:#79B8FF"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Sink.Sink&lt;Chunk&lt;number&gt;, number, number, never, never&gt;, Sink.Sink&lt;Chunk&lt;number&gt;, number, never, never, never&gt;, Sink.Sink&lt;[Chunk&lt;number&gt;, Chunk&lt;never&gt;], number, never, never, never&gt;&gt;(this: Sink.Sink&lt;...&gt;, ab: (_: Sink.Sink&lt;Chunk&lt;number&gt;, number, number, never, never&gt;) =&gt; Sink.Sink&lt;Chunk&lt;number&gt;, number, never, never, never&gt;, bc: (_: Sink.Sink&lt;Chunk&lt;number&gt;, number, never, never, never&gt;) =&gt; Sink.Sink&lt;[Chunk&lt;number&gt;, Chunk&lt;never&gt;], number, never, never, never&gt;): Sink.Sink&lt;...&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>import Sink</code></pre>
</figure>
:::
::::

[Sink]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ignoreLeftover: &lt;A, In, L, E, R&gt;(self: Sink.Sink&lt;A, In, L, E, R&gt;) =&gt; Sink.Sink&lt;A, In, never, E, R&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Drains the remaining elements from the stream after the sink finishes
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[ignoreLeftover]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

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
<pre data-language="ts"><code>import Sink</code></pre>
</figure>
:::
::::

[Sink]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const collectLeftover: &lt;A, In, L, E, R&gt;(self: Sink.Sink&lt;A, In, L, E, R&gt;) =&gt; Sink.Sink&lt;[A, Chunk&lt;L&gt;], In, never, E, R&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Collects the leftovers from the stream when the sink succeeds and
returns them as part of the sink\'s result.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[collectLeftover]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::::::::::::::::::::::::::::::::::::: code
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
<pre data-language="ts"><code>const runPromise: &lt;[Chunk&lt;number&gt;, Chunk&lt;never&gt;], never&gt;(effect: Effect.Effect&lt;[Chunk&lt;number&gt;, Chunk&lt;never&gt;], never, never&gt;, options?: {    readonly signal?: AbortSignal | undefined;} | undefined) =&gt; Promise&lt;[Chunk&lt;number&gt;, Chunk&lt;never&gt;]&gt;</code></pre>
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
<pre data-language="ts"><code>import Stream</code></pre>
</figure>
:::
::::

[Stream]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const run: &lt;number, never, never, [Chunk&lt;number&gt;, Chunk&lt;never&gt;], never, never&gt;(self: Stream.Stream&lt;number, never, never&gt;, sink: Sink.Sink&lt;[Chunk&lt;number&gt;, Chunk&lt;never&gt;], number, unknown, never, never&gt;) =&gt; Effect.Effect&lt;[Chunk&lt;number&gt;, Chunk&lt;never&gt;], never, never&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Runs the sink on the stream to produce either the sink\'s result or an
error.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[run]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const stream: Stream.Stream&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[stream]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const sink: Sink.Sink&lt;[Chunk&lt;number&gt;, Chunk&lt;never&gt;], number, never, never, never&gt;</code></pre>
</figure>
:::
::::

[sink]{style="--0:#24292E;--1:#E1E4E8"}[)).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Promise&lt;[Chunk&lt;number&gt;, Chunk&lt;never&gt;]&gt;.then&lt;void, never&gt;(onfulfilled?: ((value: [Chunk&lt;number&gt;, Chunk&lt;never&gt;]) =&gt; void | PromiseLike&lt;void&gt;) | null | undefined, onrejected?: ((reason: any) =&gt; PromiseLike&lt;never&gt;) | null | undefined): Promise&lt;void&gt;</code></pre>
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
:::::::::::::::::::::::::::::::::::::
::::::::::::::::::::::::::::::::::::::::

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
[\[ { \_id: \'Chunk\', values: \[ 1, 2, 3 \] }, { \_id: \'Chunk\',
values: \[\] } \]]{style="--0:#616972;--1:#99A0A6"}
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

::: {.meta .sl-flex .astro-lfnsiwle}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXF4bnlic3ZxIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuMmVtOyI+PHBhdGggZD0iTTIyIDcuMjRhMSAxIDAgMCAwLS4yOS0uNzFsLTQuMjQtNC4yNGExIDEgMCAwIDAtMS4xLS4yMiAxIDEgMCAwIDAtLjMyLjIybC0yLjgzIDIuODNMMi4yOSAxNi4wNWExIDEgMCAwIDAtLjI5LjcxVjIxYTEgMSAwIDAgMCAxIDFoNC4yNGExIDEgMCAwIDAgLjc2LS4yOWwxMC44Ny0xMC45M0wyMS43MSA4Yy4xLS4xLjE3LS4yLjIyLS4zM2ExIDEgMCAwIDAgMC0uMjR2LS4xNGwuMDctLjA1Wk02LjgzIDIwSDR2LTIuODNsOS45My05LjkzIDIuODMgMi44M0w2LjgzIDIwWk0xOC4xNyA4LjY2bC0yLjgzLTIuODMgMS40Mi0xLjQxIDIuODIgMi44Mi0xLjQxIDEuNDJaIiAvPjwvc3ZnPg==){.astro-qxnybsvq
.astro-4rgy7crp} Edit
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/sink/leftovers.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Concurrency]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../concurrency/index.html){.astro-u5aomj4k
rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[TestClock]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../../testing/testclock/index.html){.astro-u5aomj4k
rel="next"}
:::
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
