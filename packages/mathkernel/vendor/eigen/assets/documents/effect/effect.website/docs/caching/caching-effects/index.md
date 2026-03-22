:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Caching Effects {#_top .astro-np5lzwrf}
:::
::::

:::::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::: sl-markdown-content
This section covers several functions from the library that help manage
caching and memoization in your application.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## cachedFunction

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#cachedfunction){.anchor-link
aria-labelledby="cachedfunction"}
:::

Memoizes a function with effects, caching results for the same inputs to
avoid recomputation.

**Example** (Memoizing a Random Number Generator)

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
::::::

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Random</code></pre>
</figure>
:::
::::

[Random]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;number, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;(a: number) =&gt; Effect.Effect&lt;number, never, never&gt;, never, never&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;number, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;(a: number) =&gt; Effect.Effect&lt;number, never, never&gt;, never, never&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt; (+1 overload)</code></pre>
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
4
:::
::::

::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const randomNumber: (n: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[randomNumber]{style="--0:#6F42C1;--1:#B392F0"}[
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
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Random</code></pre>
</figure>
:::
::::

[Random]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const nextIntBetween: (min: number, max: number) =&gt; Effect.Effect&lt;number&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns the next integer value in the specified range from the
pseudo-random number generator.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[nextIntBetween]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
:::::::::::::::
::::::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"non-memoized
version:\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const randomNumber: (n: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[randomNumber]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[10]{style="--0:#005CC5;--1:#79B8FF"}[))
]{style="--0:#24292E;--1:#E1E4E8"}[// Generates a new random
number]{style="--0:#616972;--1:#99A0A6"}
::::::::::::::::
:::::::::::::::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const randomNumber: (n: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[randomNumber]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[10]{style="--0:#005CC5;--1:#79B8FF"}[))
]{style="--0:#24292E;--1:#E1E4E8"}[// Generates a different
number]{style="--0:#616972;--1:#99A0A6"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
:::
::::::

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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"memoized
version:\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
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
<pre data-language="ts"><code>const memoized: (a: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[memoized]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const cachedFunction: &lt;number, number, never, never&gt;(f: (a: number) =&gt; Effect.Effect&lt;number, never, never&gt;, eq?: Equivalence&lt;number&gt; | undefined) =&gt; Effect.Effect&lt;(a: number) =&gt; Effect.Effect&lt;number, never, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Returns a memoized version of a function with effects, reusing results
for the same inputs.

**Details**

This function creates a memoized version of a given function that
performs an effect. Memoization ensures that once a result is computed
for a specific input, it is stored and reused for subsequent calls with
the same input, reducing the need to recompute the result.

The function can optionally take an `Equivalence` parameter to determine
how inputs are compared for caching purposes.

**When to Use**

Use this function when you have a function that performs an effect and
you want to avoid recomputing the result for the same input multiple
times.

It\'s ideal for functions that produce deterministic results based on
their inputs, and you want to improve performance by caching the output.

This is particularly useful in scenarios where the function involves
expensive calculations or operations that should be avoided after the
first execution with the same parameters.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Random } from &quot;effect&quot;
const program = Effect.gen(function* () {  const randomNumber = (n: number) =&gt; Random.nextIntBetween(1, n)  console.log(&quot;non-memoized version:&quot;)  console.log(yield* randomNumber(10))  console.log(yield* randomNumber(10))
  console.log(&quot;memoized version:&quot;)  const memoized = yield* Effect.cachedFunction(randomNumber)  console.log(yield* memoized(10))  console.log(yield* memoized(10))})
Effect.runFork(program)// Example Output:// non-memoized version:// 2// 8// memoized version:// 5// 5</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[cachedFunction]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const randomNumber: (n: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[randomNumber]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const memoized: (a: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[memoized]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[10]{style="--0:#005CC5;--1:#79B8FF"}[))
]{style="--0:#24292E;--1:#E1E4E8"}[// Generates and caches the
result]{style="--0:#616972;--1:#99A0A6"}
::::::::::::::::
:::::::::::::::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const memoized: (a: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[memoized]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[10]{style="--0:#005CC5;--1:#79B8FF"}[))
]{style="--0:#24292E;--1:#E1E4E8"}[// Reuses the cached
result]{style="--0:#616972;--1:#99A0A6"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
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
[Example Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[non-memoized version:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[2]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[8]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
[memoized version:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[5]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::: code
[5]{style="--0:#616972;--1:#99A0A6"}
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
## once

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#once){.anchor-link
aria-labelledby="once"}
:::

Ensures an effect is executed only once, even if invoked multiple times.

**Example** (Single Execution of an Effect)

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

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

:::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const task1: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[task1]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"task1\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
[ ]{.indent}[// Repeats task1 three
times]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>const repeatN: &lt;void, never, never&gt;(self: Effect.Effect&lt;void, never, never&gt;, n: number) =&gt; Effect.Effect&lt;void, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Repeats an effect a specified number of times or until the first
failure.

**Details**

This function executes an effect initially and then repeats it the
specified number of times, as long as it succeeds. For example, calling
`repeatN(action, 2)` will execute `action` once initially and then
repeat it two additional times if there are no failures.

If the effect fails during any repetition, the failure is returned, and
no further repetitions are attempted.

**When to Use**

This function is useful for tasks that need to be retried a fixed number
of times or for performing repeated actions without requiring a
schedule.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const action = Console.log(&quot;success&quot;)const program = Effect.repeatN(action, 2)
Effect.runPromise(program)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[repeatN]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const task1: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[task1]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
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
[ ]{.indent}[// Ensures task2 is executed only
once]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

:::::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const task2: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[task2]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const once: &lt;void, never, never&gt;(self: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;Effect.Effect&lt;void, never, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Returns an effect that executes only once, regardless of how many times
it\'s called.

**Details**

This function ensures that a specific effect is executed only a single
time, no matter how many times it is invoked. The result of the effect
will be cached, and subsequent calls to the effect will immediately
return the cached result without re-executing the original logic.

**When to Use**

Use this function when you need to perform a task only once, regardless
of how many times the effect is triggered. It\'s particularly useful
when you have initialization tasks, logging, or other one-time actions
that should not be repeated. This can help optimize performance and
avoid redundant actions.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const program = Effect.gen(function* () {  const task1 = Console.log(&quot;task1&quot;)  yield* Effect.repeatN(task1, 2)  const task2 = yield* Effect.once(Console.log(&quot;task2&quot;))  yield* Effect.repeatN(task2, 2)})
Effect.runFork(program)// Output:// task1// task1// task1// task2</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[once]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"task2\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[ ]{.indent}[// Attempts to repeat task2, but it will only execute
once]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

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
<pre data-language="ts"><code>const repeatN: &lt;void, never, never&gt;(self: Effect.Effect&lt;void, never, never&gt;, n: number) =&gt; Effect.Effect&lt;void, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Repeats an effect a specified number of times or until the first
failure.

**Details**

This function executes an effect initially and then repeats it the
specified number of times, as long as it succeeds. For example, calling
`repeatN(action, 2)` will execute `action` once initially and then
repeat it two additional times if there are no failures.

If the effect fails during any repetition, the failure is returned, and
no further repetitions are attempted.

**When to Use**

This function is useful for tasks that need to be retried a fixed number
of times or for performing repeated actions without requiring a
schedule.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
const action = Console.log(&quot;success&quot;)const program = Effect.repeatN(action, 2)
Effect.runPromise(program)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[repeatN]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const task2: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[task2]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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
[task1]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[task1]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
[task1]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
[task2]{style="--0:#616972;--1:#99A0A6"}
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

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## cached

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#cached){.anchor-link
aria-labelledby="cached"}
:::

Returns an effect that computes a result lazily and caches it.
Subsequent evaluations of this effect will return the cached result
without re-executing the logic.

**Example** (Lazy Caching of an Expensive Task)

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

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::: code
[let]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>let i: number</code></pre>
</figure>
:::
::::

[i]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}
:::::
::::::::

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
[// Simulating an expensive task with a
delay]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const expensiveTask: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[expensiveTask]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const promise: &lt;string&gt;(evaluate: (signal: AbortSignal) =&gt; PromiseLike&lt;string&gt;) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that represents an asynchronous computation
guaranteed to succeed.

**Details**

The provided function (`thunk`) returns a `Promise` that should never
reject; if it does, the error will be treated as a \"defect\".

This defect is not a standard error but indicates a flaw in the logic
that was expected to be error-free. You can think of it similar to an
unexpected crash in the program, which can be further managed or logged
using tools like

catchAllDefect

.

**Interruptions**

An optional `AbortSignal` can be provided to allow for interruption of
the wrapped `Promise` API.

**When to Use**

Use this function when you are sure the operation will not reject.

**Example** (Delayed Message)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const delay = (message: string) =&gt;  Effect.promise&lt;string&gt;(    () =&gt;      new Promise((resolve) =&gt; {        setTimeout(() =&gt; {          resolve(message)        }, 2000)      })  )
//      ┌─── Effect&lt;string, never, never&gt;//      ▼const program = delay(&quot;Async operation completed successfully!&quot;)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [tryPromise for a version that
can handle failures.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[promise]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[\>(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"expensive
task\...\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::::::::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Promise: PromiseConstructornew &lt;string&gt;(executor: (resolve: (value: string | PromiseLike&lt;string&gt;) =&gt; void, reject: (reason?: any) =&gt; void) =&gt; void) =&gt; Promise&lt;string&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a new Promise.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [executor A callback used to
initialize the promise. This callback is passed two arguments: a resolve
callback used to resolve the promise with a value or the result of
another promise, and a reject callback used to reject the promise with a
provided reason or error.]{.twoslash-popup-docs-tag-value}
:::
::::::

[Promise]{style="--0:#005CC5;--1:#79B8FF"}[((]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>resolve: (value: string | PromiseLike&lt;string&gt;) =&gt; void</code></pre>
</figure>
:::
::::

[resolve]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function setTimeout&lt;[]&gt;(callback: () =&gt; void, delay?: number): NodeJS.Timeout (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schedules execution of a one-time `callback` after `delay` milliseconds.

The `callback` will likely not be invoked in precisely `delay`
milliseconds. Node.js makes no guarantees about the exact timing of when
callbacks will fire, nor of their ordering. The callback will be called
as close as possible to the time specified.

When `delay` is larger than `2147483647` or less than `1` or `NaN`, the
`delay` will be set to `1`. Non-integer delays are truncated to an
integer.

If `callback` is not a function, a `TypeError` will be thrown.

This method has a custom variant for promises that is available using
`timersPromises.setTimeout()`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[v0.0.1]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [callback The function to
call when the timer elapses.]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [delay The number of
milliseconds to wait before calling the `callback`. **Default:**
`1`.]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [args Optional arguments to
pass when the `callback` is called.]{.twoslash-popup-docs-tag-value}

[\@returns]{.twoslash-popup-docs-tag-name} ― [for use with
`clearTimeout()`]{.twoslash-popup-docs-tag-value}
:::
::::::

[setTimeout]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>resolve: (value: string | PromiseLike&lt;string&gt;) =&gt; void</code></pre>
</figure>
:::
::::

[resolve]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`result
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>let i: number</code></pre>
</figure>
:::
::::

[i]{style="--0:#24292E;--1:#E1E4E8"}[++]{style="--0:#BF3441;--1:#F97583"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[[ ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[},
]{style="--0:#24292E;--1:#E1E4E8"}[100]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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
13
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
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
16
:::
::::

::: code
[ ]{.indent}[// Without caching, the task is executed each
time]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"\--
non-cached
version:\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const expensiveTask: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[expensiveTask]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;string, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;string, never, never&gt;, ab: (_: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const andThen: &lt;string, Effect.Effect&lt;void, never, never&gt;&gt;(f: (a: string) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;string, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains two actions, where the second action can depend on the result of
the first.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))// orconst transformedEffect = Effect.andThen(myEffect, anotherEffect)// orconst transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))</code></pre>
</figure>
:::

**When to Use**

Use `andThen` when you need to run multiple actions in sequence, with
the second action depending on the result of the first. This is useful
for combining effects or handling computations that must happen in
order.

**Details**

The second action can be:

- A constant value (similar to

as

)

- A function returning a value (similar to

map

)

- A `Promise`
- A function returning a `Promise`
- An `Effect`
- A function returning an `Effect` (similar to

flatMap

)

**Note:** `andThen` works well with both `Option` and `Either` types,
treating them as effects.

**Example** (Applying a Discount Based on Fetched Amount)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Using Effect.map and Effect.flatMapconst result1 = pipe(  fetchTransactionAmount,  Effect.map((amount) =&gt; amount * 2),  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result1).then(console.log)// Output: 190
// Using Effect.andThenconst result2 = pipe(  fetchTransactionAmount,  Effect.andThen((amount) =&gt; amount * 2),  Effect.andThen((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result2).then(console.log)// Output: 190</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[andThen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#24292E;--1:#E1E4E8"}

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

[log]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const expensiveTask: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[expensiveTask]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;string, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;string, never, never&gt;, ab: (_: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const andThen: &lt;string, Effect.Effect&lt;void, never, never&gt;&gt;(f: (a: string) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;string, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains two actions, where the second action can depend on the result of
the first.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))// orconst transformedEffect = Effect.andThen(myEffect, anotherEffect)// orconst transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))</code></pre>
</figure>
:::

**When to Use**

Use `andThen` when you need to run multiple actions in sequence, with
the second action depending on the result of the first. This is useful
for combining effects or handling computations that must happen in
order.

**Details**

The second action can be:

- A constant value (similar to

as

)

- A function returning a value (similar to

map

)

- A `Promise`
- A function returning a `Promise`
- An `Effect`
- A function returning an `Effect` (similar to

flatMap

)

**Note:** `andThen` works well with both `Option` and `Either` types,
treating them as effects.

**Example** (Applying a Discount Based on Fetched Amount)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Using Effect.map and Effect.flatMapconst result1 = pipe(  fetchTransactionAmount,  Effect.map((amount) =&gt; amount * 2),  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result1).then(console.log)// Output: 190
// Using Effect.andThenconst result2 = pipe(  fetchTransactionAmount,  Effect.andThen((amount) =&gt; amount * 2),  Effect.andThen((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result2).then(console.log)// Output: 190</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[andThen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#24292E;--1:#E1E4E8"}

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

[log]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

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
[ ]{.indent}[// With caching, the result is reused after the first
run]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"\--
cached
version:\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
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
<pre data-language="ts"><code>const cached: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[cached]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const cached: &lt;string, never, never&gt;(self: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;Effect.Effect&lt;string, never, never&gt;, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Returns an effect that lazily computes a result and caches it for
subsequent evaluations.

**Details**

This function wraps an effect and ensures that its result is computed
only once. Once the result is computed, it is cached, meaning that
subsequent evaluations of the same effect will return the cached result
without re-executing the logic.

**When to Use**

Use this function when you have an expensive or time-consuming operation
that you want to avoid repeating. The first evaluation will compute the
result, and all following evaluations will immediately return the cached
value, improving performance and reducing unnecessary work.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
let i = 1const expensiveTask = Effect.promise&lt;string&gt;(() =&gt; {  console.log(&quot;expensive task...&quot;)  return new Promise((resolve) =&gt; {    setTimeout(() =&gt; {      resolve(`result ${i++}`)    }, 100)  })})
const program = Effect.gen(function* () {  console.log(&quot;non-cached version:&quot;)  yield* expensiveTask.pipe(Effect.andThen(Console.log))  yield* expensiveTask.pipe(Effect.andThen(Console.log))  console.log(&quot;cached version:&quot;)  const cached = yield* Effect.cached(expensiveTask)  yield* cached.pipe(Effect.andThen(Console.log))  yield* cached.pipe(Effect.andThen(Console.log))})
Effect.runFork(program)// Output:// non-cached version:// expensive task...// result 1// expensive task...// result 2// cached version:// expensive task...// result 3// result 3</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [cachedWithTTL for a similar
function that includes a time-to-live duration for the cached
value.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [cachedInvalidateWithTTL for a
similar function that includes an additional effect for manually
invalidating the cached value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[cached]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const expensiveTask: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[expensiveTask]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const cached: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[cached]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;string, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;string, never, never&gt;, ab: (_: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const andThen: &lt;string, Effect.Effect&lt;void, never, never&gt;&gt;(f: (a: string) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;string, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains two actions, where the second action can depend on the result of
the first.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))// orconst transformedEffect = Effect.andThen(myEffect, anotherEffect)// orconst transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))</code></pre>
</figure>
:::

**When to Use**

Use `andThen` when you need to run multiple actions in sequence, with
the second action depending on the result of the first. This is useful
for combining effects or handling computations that must happen in
order.

**Details**

The second action can be:

- A constant value (similar to

as

)

- A function returning a value (similar to

map

)

- A `Promise`
- A function returning a `Promise`
- An `Effect`
- A function returning an `Effect` (similar to

flatMap

)

**Note:** `andThen` works well with both `Option` and `Either` types,
treating them as effects.

**Example** (Applying a Discount Based on Fetched Amount)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Using Effect.map and Effect.flatMapconst result1 = pipe(  fetchTransactionAmount,  Effect.map((amount) =&gt; amount * 2),  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result1).then(console.log)// Output: 190
// Using Effect.andThenconst result2 = pipe(  fetchTransactionAmount,  Effect.andThen((amount) =&gt; amount * 2),  Effect.andThen((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result2).then(console.log)// Output: 190</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[andThen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#24292E;--1:#E1E4E8"}

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

[log]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const cached: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[cached]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;string, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;string, never, never&gt;, ab: (_: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const andThen: &lt;string, Effect.Effect&lt;void, never, never&gt;&gt;(f: (a: string) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;string, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains two actions, where the second action can depend on the result of
the first.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))// orconst transformedEffect = Effect.andThen(myEffect, anotherEffect)// orconst transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))</code></pre>
</figure>
:::

**When to Use**

Use `andThen` when you need to run multiple actions in sequence, with
the second action depending on the result of the first. This is useful
for combining effects or handling computations that must happen in
order.

**Details**

The second action can be:

- A constant value (similar to

as

)

- A function returning a value (similar to

map

)

- A `Promise`
- A function returning a `Promise`
- An `Effect`
- A function returning an `Effect` (similar to

flatMap

)

**Note:** `andThen` works well with both `Option` and `Either` types,
treating them as effects.

**Example** (Applying a Discount Based on Fetched Amount)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Using Effect.map and Effect.flatMapconst result1 = pipe(  fetchTransactionAmount,  Effect.map((amount) =&gt; amount * 2),  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result1).then(console.log)// Output: 190
// Using Effect.andThenconst result2 = pipe(  fetchTransactionAmount,  Effect.andThen((amount) =&gt; amount * 2),  Effect.andThen((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result2).then(console.log)// Output: 190</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[andThen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#24292E;--1:#E1E4E8"}

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

[log]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
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
29
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
:::
::::

::: code
[\-- non-cached version:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
:::
::::

::: code
[expensive task\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
:::
::::

::: code
[result 1]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
:::
::::

::: code
[expensive task\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
[result 2]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

::: code
[\-- cached version:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
:::
::::

::: code
[expensive task\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[result 3]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
[result 3]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
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
## cachedWithTTL

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#cachedwithttl){.anchor-link
aria-labelledby="cachedwithttl"}
:::

Returns an effect that caches its result for a specified duration, known
as the `timeToLive`{dir="auto"}. When the cache expires after the
duration, the effect will be recomputed upon next evaluation.

**Example** (Caching with Time-to-Live)

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

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::: code
[let]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>let i: number</code></pre>
</figure>
:::
::::

[i]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}
:::::
::::::::

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
[// Simulating an expensive task with a
delay]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const expensiveTask: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[expensiveTask]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const promise: &lt;string&gt;(evaluate: (signal: AbortSignal) =&gt; PromiseLike&lt;string&gt;) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that represents an asynchronous computation
guaranteed to succeed.

**Details**

The provided function (`thunk`) returns a `Promise` that should never
reject; if it does, the error will be treated as a \"defect\".

This defect is not a standard error but indicates a flaw in the logic
that was expected to be error-free. You can think of it similar to an
unexpected crash in the program, which can be further managed or logged
using tools like

catchAllDefect

.

**Interruptions**

An optional `AbortSignal` can be provided to allow for interruption of
the wrapped `Promise` API.

**When to Use**

Use this function when you are sure the operation will not reject.

**Example** (Delayed Message)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const delay = (message: string) =&gt;  Effect.promise&lt;string&gt;(    () =&gt;      new Promise((resolve) =&gt; {        setTimeout(() =&gt; {          resolve(message)        }, 2000)      })  )
//      ┌─── Effect&lt;string, never, never&gt;//      ▼const program = delay(&quot;Async operation completed successfully!&quot;)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [tryPromise for a version that
can handle failures.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[promise]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[\>(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"expensive
task\...\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::::::::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Promise: PromiseConstructornew &lt;string&gt;(executor: (resolve: (value: string | PromiseLike&lt;string&gt;) =&gt; void, reject: (reason?: any) =&gt; void) =&gt; void) =&gt; Promise&lt;string&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a new Promise.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [executor A callback used to
initialize the promise. This callback is passed two arguments: a resolve
callback used to resolve the promise with a value or the result of
another promise, and a reject callback used to reject the promise with a
provided reason or error.]{.twoslash-popup-docs-tag-value}
:::
::::::

[Promise]{style="--0:#005CC5;--1:#79B8FF"}[((]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>resolve: (value: string | PromiseLike&lt;string&gt;) =&gt; void</code></pre>
</figure>
:::
::::

[resolve]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function setTimeout&lt;[]&gt;(callback: () =&gt; void, delay?: number): NodeJS.Timeout (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schedules execution of a one-time `callback` after `delay` milliseconds.

The `callback` will likely not be invoked in precisely `delay`
milliseconds. Node.js makes no guarantees about the exact timing of when
callbacks will fire, nor of their ordering. The callback will be called
as close as possible to the time specified.

When `delay` is larger than `2147483647` or less than `1` or `NaN`, the
`delay` will be set to `1`. Non-integer delays are truncated to an
integer.

If `callback` is not a function, a `TypeError` will be thrown.

This method has a custom variant for promises that is available using
`timersPromises.setTimeout()`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[v0.0.1]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [callback The function to
call when the timer elapses.]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [delay The number of
milliseconds to wait before calling the `callback`. **Default:**
`1`.]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [args Optional arguments to
pass when the `callback` is called.]{.twoslash-popup-docs-tag-value}

[\@returns]{.twoslash-popup-docs-tag-name} ― [for use with
`clearTimeout()`]{.twoslash-popup-docs-tag-value}
:::
::::::

[setTimeout]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>resolve: (value: string | PromiseLike&lt;string&gt;) =&gt; void</code></pre>
</figure>
:::
::::

[resolve]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`result
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>let i: number</code></pre>
</figure>
:::
::::

[i]{style="--0:#24292E;--1:#E1E4E8"}[++]{style="--0:#BF3441;--1:#F97583"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[[ ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[},
]{style="--0:#24292E;--1:#E1E4E8"}[100]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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
13
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
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
16
:::
::::

::: code
[ ]{.indent}[// Caches the result for 150
milliseconds]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
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
<pre data-language="ts"><code>const cached: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[cached]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const cachedWithTTL: &lt;string, never, never&gt;(self: Effect.Effect&lt;string, never, never&gt;, timeToLive: DurationInput) =&gt; Effect.Effect&lt;Effect.Effect&lt;string, never, never&gt;, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Returns an effect that caches its result for a specified `Duration`,
known as \"timeToLive\" (TTL).

**Details**

This function is used to cache the result of an effect for a specified
amount of time. This means that the first time the effect is evaluated,
its result is computed and stored.

If the effect is evaluated again within the specified `timeToLive`, the
cached result will be used, avoiding recomputation.

After the specified duration has passed, the cache expires, and the
effect will be recomputed upon the next evaluation.

**When to Use**

Use this function when you have an effect that involves costly
operations or computations, and you want to avoid repeating them within
a short time frame.

It\'s ideal for scenarios where the result of an effect doesn\'t change
frequently and can be reused for a specified duration.

By caching the result, you can improve efficiency and reduce unnecessary
computations, especially in performance-critical applications.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
let i = 1const expensiveTask = Effect.promise&lt;string&gt;(() =&gt; {  console.log(&quot;expensive task...&quot;)  return new Promise((resolve) =&gt; {    setTimeout(() =&gt; {      resolve(`result ${i++}`)    }, 100)  })})
const program = Effect.gen(function* () {  const cached = yield* Effect.cachedWithTTL(expensiveTask, &quot;150 millis&quot;)  yield* cached.pipe(Effect.andThen(Console.log))  yield* cached.pipe(Effect.andThen(Console.log))  yield* Effect.sleep(&quot;100 millis&quot;)  yield* cached.pipe(Effect.andThen(Console.log))})
Effect.runFork(program)// Output:// expensive task...// result 1// result 1// expensive task...// result 2</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [cached for a similar function
that caches the result indefinitely.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [cachedInvalidateWithTTL for a
similar function that includes an additional effect for manually
invalidating the cached value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[cachedWithTTL]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const expensiveTask: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[expensiveTask]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[\"150
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

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
[ ]{.indent}[// First evaluation triggers the
task]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const cached: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[cached]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;string, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;string, never, never&gt;, ab: (_: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const andThen: &lt;string, Effect.Effect&lt;void, never, never&gt;&gt;(f: (a: string) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;string, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains two actions, where the second action can depend on the result of
the first.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))// orconst transformedEffect = Effect.andThen(myEffect, anotherEffect)// orconst transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))</code></pre>
</figure>
:::

**When to Use**

Use `andThen` when you need to run multiple actions in sequence, with
the second action depending on the result of the first. This is useful
for combining effects or handling computations that must happen in
order.

**Details**

The second action can be:

- A constant value (similar to

as

)

- A function returning a value (similar to

map

)

- A `Promise`
- A function returning a `Promise`
- An `Effect`
- A function returning an `Effect` (similar to

flatMap

)

**Note:** `andThen` works well with both `Option` and `Either` types,
treating them as effects.

**Example** (Applying a Discount Based on Fetched Amount)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Using Effect.map and Effect.flatMapconst result1 = pipe(  fetchTransactionAmount,  Effect.map((amount) =&gt; amount * 2),  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result1).then(console.log)// Output: 190
// Using Effect.andThenconst result2 = pipe(  fetchTransactionAmount,  Effect.andThen((amount) =&gt; amount * 2),  Effect.andThen((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result2).then(console.log)// Output: 190</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[andThen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#24292E;--1:#E1E4E8"}

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

[log]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

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
[ ]{.indent}[// Second evaluation returns the cached
result]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const cached: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[cached]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;string, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;string, never, never&gt;, ab: (_: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const andThen: &lt;string, Effect.Effect&lt;void, never, never&gt;&gt;(f: (a: string) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;string, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains two actions, where the second action can depend on the result of
the first.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))// orconst transformedEffect = Effect.andThen(myEffect, anotherEffect)// orconst transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))</code></pre>
</figure>
:::

**When to Use**

Use `andThen` when you need to run multiple actions in sequence, with
the second action depending on the result of the first. This is useful
for combining effects or handling computations that must happen in
order.

**Details**

The second action can be:

- A constant value (similar to

as

)

- A function returning a value (similar to

map

)

- A `Promise`
- A function returning a `Promise`
- An `Effect`
- A function returning an `Effect` (similar to

flatMap

)

**Note:** `andThen` works well with both `Option` and `Either` types,
treating them as effects.

**Example** (Applying a Discount Based on Fetched Amount)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Using Effect.map and Effect.flatMapconst result1 = pipe(  fetchTransactionAmount,  Effect.map((amount) =&gt; amount * 2),  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result1).then(console.log)// Output: 190
// Using Effect.andThenconst result2 = pipe(  fetchTransactionAmount,  Effect.andThen((amount) =&gt; amount * 2),  Effect.andThen((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result2).then(console.log)// Output: 190</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[andThen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#24292E;--1:#E1E4E8"}

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

[log]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

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
[ ]{.indent}[// Wait for 100 milliseconds, ensuring the cache
expires]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

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

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"100
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

::: code
[ ]{.indent}[// Recomputes the task after cache
expiration]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const cached: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[cached]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;string, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;string, never, never&gt;, ab: (_: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const andThen: &lt;string, Effect.Effect&lt;void, never, never&gt;&gt;(f: (a: string) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;string, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains two actions, where the second action can depend on the result of
the first.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))// orconst transformedEffect = Effect.andThen(myEffect, anotherEffect)// orconst transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))</code></pre>
</figure>
:::

**When to Use**

Use `andThen` when you need to run multiple actions in sequence, with
the second action depending on the result of the first. This is useful
for combining effects or handling computations that must happen in
order.

**Details**

The second action can be:

- A constant value (similar to

as

)

- A function returning a value (similar to

map

)

- A `Promise`
- A function returning a `Promise`
- An `Effect`
- A function returning an `Effect` (similar to

flatMap

)

**Note:** `andThen` works well with both `Option` and `Either` types,
treating them as effects.

**Example** (Applying a Discount Based on Fetched Amount)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Using Effect.map and Effect.flatMapconst result1 = pipe(  fetchTransactionAmount,  Effect.map((amount) =&gt; amount * 2),  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result1).then(console.log)// Output: 190
// Using Effect.andThenconst result2 = pipe(  fetchTransactionAmount,  Effect.andThen((amount) =&gt; amount * 2),  Effect.andThen((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result2).then(console.log)// Output: 190</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[andThen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#24292E;--1:#E1E4E8"}

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

[log]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
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
33
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
[expensive task\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

::: code
[result 1]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
:::
::::

::: code
[result 1]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[expensive task\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
[result 2]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
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
## cachedInvalidateWithTTL

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#cachedinvalidatewithttl){.anchor-link
aria-labelledby="cachedinvalidatewithttl"}
:::

Similar to `Effect.cachedWithTTL`{dir="auto"}, this function caches an
effect's result for a specified duration. It also includes an additional
effect for manually invalidating the cached value before it naturally
expires.

**Example** (Invalidating Cache Manually)

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

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::: code
[let]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>let i: number</code></pre>
</figure>
:::
::::

[i]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}
:::::
::::::::

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
[// Simulating an expensive task with a
delay]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const expensiveTask: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[expensiveTask]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const promise: &lt;string&gt;(evaluate: (signal: AbortSignal) =&gt; PromiseLike&lt;string&gt;) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates an `Effect` that represents an asynchronous computation
guaranteed to succeed.

**Details**

The provided function (`thunk`) returns a `Promise` that should never
reject; if it does, the error will be treated as a \"defect\".

This defect is not a standard error but indicates a flaw in the logic
that was expected to be error-free. You can think of it similar to an
unexpected crash in the program, which can be further managed or logged
using tools like

catchAllDefect

.

**Interruptions**

An optional `AbortSignal` can be provided to allow for interruption of
the wrapped `Promise` API.

**When to Use**

Use this function when you are sure the operation will not reject.

**Example** (Delayed Message)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const delay = (message: string) =&gt;  Effect.promise&lt;string&gt;(    () =&gt;      new Promise((resolve) =&gt; {        setTimeout(() =&gt; {          resolve(message)        }, 2000)      })  )
//      ┌─── Effect&lt;string, never, never&gt;//      ▼const program = delay(&quot;Async operation completed successfully!&quot;)</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [tryPromise for a version that
can handle failures.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[promise]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[\>(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"expensive
task\...\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::::::::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Promise: PromiseConstructornew &lt;string&gt;(executor: (resolve: (value: string | PromiseLike&lt;string&gt;) =&gt; void, reject: (reason?: any) =&gt; void) =&gt; void) =&gt; Promise&lt;string&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a new Promise.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [executor A callback used to
initialize the promise. This callback is passed two arguments: a resolve
callback used to resolve the promise with a value or the result of
another promise, and a reject callback used to reject the promise with a
provided reason or error.]{.twoslash-popup-docs-tag-value}
:::
::::::

[Promise]{style="--0:#005CC5;--1:#79B8FF"}[((]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>resolve: (value: string | PromiseLike&lt;string&gt;) =&gt; void</code></pre>
</figure>
:::
::::

[resolve]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function setTimeout&lt;[]&gt;(callback: () =&gt; void, delay?: number): NodeJS.Timeout (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schedules execution of a one-time `callback` after `delay` milliseconds.

The `callback` will likely not be invoked in precisely `delay`
milliseconds. Node.js makes no guarantees about the exact timing of when
callbacks will fire, nor of their ordering. The callback will be called
as close as possible to the time specified.

When `delay` is larger than `2147483647` or less than `1` or `NaN`, the
`delay` will be set to `1`. Non-integer delays are truncated to an
integer.

If `callback` is not a function, a `TypeError` will be thrown.

This method has a custom variant for promises that is available using
`timersPromises.setTimeout()`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[v0.0.1]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [callback The function to
call when the timer elapses.]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [delay The number of
milliseconds to wait before calling the `callback`. **Default:**
`1`.]{.twoslash-popup-docs-tag-value}

[\@param]{.twoslash-popup-docs-tag-name} ― [args Optional arguments to
pass when the `callback` is called.]{.twoslash-popup-docs-tag-value}

[\@returns]{.twoslash-popup-docs-tag-name} ― [for use with
`clearTimeout()`]{.twoslash-popup-docs-tag-value}
:::
::::::

[setTimeout]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>resolve: (value: string | PromiseLike&lt;string&gt;) =&gt; void</code></pre>
</figure>
:::
::::

[resolve]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`result
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>let i: number</code></pre>
</figure>
:::
::::

[i]{style="--0:#24292E;--1:#E1E4E8"}[++]{style="--0:#BF3441;--1:#F97583"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[[ ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[},
]{style="--0:#24292E;--1:#E1E4E8"}[100]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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
13
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
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
16
:::
::::

::: code
[ ]{.indent}[// Caches the result for 150
milliseconds]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const cached: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[cached]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const invalidate: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[invalidate]{style="--0:#005CC5;--1:#79B8FF"}[\]
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
<pre data-language="ts"><code>const cachedInvalidateWithTTL: &lt;string, never, never&gt;(self: Effect.Effect&lt;string, never, never&gt;, timeToLive: DurationInput) =&gt; Effect.Effect&lt;[Effect.Effect&lt;string, never, never&gt;, Effect.Effect&lt;void, never, never&gt;], never, never&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Caches an effect\'s result for a specified duration and allows manual
invalidation before expiration.

**Details**

This function behaves similarly to

cachedWithTTL

by caching the result of an effect for a specified period of time.
However, it introduces an additional feature: it provides an effect that
allows you to manually invalidate the cached result before it naturally
expires.

This gives you more control over the cache, allowing you to refresh the
result when needed, even if the original cache has not yet expired.

Once the cache is invalidated, the next time the effect is evaluated,
the result will be recomputed, and the cache will be refreshed.

**When to Use**

Use this function when you have an effect whose result needs to be
cached for a certain period, but you also want the option to refresh the
cache manually before the expiration time.

This is useful when you need to ensure that the cached data remains
valid for a certain period but still want to invalidate it if the
underlying data changes or if you want to force a recomputation.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Console } from &quot;effect&quot;
let i = 1const expensiveTask = Effect.promise&lt;string&gt;(() =&gt; {  console.log(&quot;expensive task...&quot;)  return new Promise((resolve) =&gt; {    setTimeout(() =&gt; {      resolve(`result ${i++}`)    }, 100)  })})
const program = Effect.gen(function* () {  const [cached, invalidate] = yield* Effect.cachedInvalidateWithTTL(    expensiveTask,    &quot;1 hour&quot;  )  yield* cached.pipe(Effect.andThen(Console.log))  yield* cached.pipe(Effect.andThen(Console.log))  yield* invalidate  yield* cached.pipe(Effect.andThen(Console.log))})
Effect.runFork(program)// Output:// expensive task...// result 1// result 1// expensive task...// result 2</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [cached for a similar function
that caches the result indefinitely.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [cachedWithTTL for a similar
function that caches the result for a specified duration but does not
include an effect for manual
invalidation.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[cachedInvalidateWithTTL]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
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
<pre data-language="ts"><code>const expensiveTask: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[expensiveTask]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[ ]{.indent}[\"150 millis\"]{style="--0:#032F62;--1:#9ECBFF"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
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
[ ]{.indent}[// First evaluation triggers the
task]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const cached: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[cached]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;string, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;string, never, never&gt;, ab: (_: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const andThen: &lt;string, Effect.Effect&lt;void, never, never&gt;&gt;(f: (a: string) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;string, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains two actions, where the second action can depend on the result of
the first.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))// orconst transformedEffect = Effect.andThen(myEffect, anotherEffect)// orconst transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))</code></pre>
</figure>
:::

**When to Use**

Use `andThen` when you need to run multiple actions in sequence, with
the second action depending on the result of the first. This is useful
for combining effects or handling computations that must happen in
order.

**Details**

The second action can be:

- A constant value (similar to

as

)

- A function returning a value (similar to

map

)

- A `Promise`
- A function returning a `Promise`
- An `Effect`
- A function returning an `Effect` (similar to

flatMap

)

**Note:** `andThen` works well with both `Option` and `Either` types,
treating them as effects.

**Example** (Applying a Discount Based on Fetched Amount)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Using Effect.map and Effect.flatMapconst result1 = pipe(  fetchTransactionAmount,  Effect.map((amount) =&gt; amount * 2),  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result1).then(console.log)// Output: 190
// Using Effect.andThenconst result2 = pipe(  fetchTransactionAmount,  Effect.andThen((amount) =&gt; amount * 2),  Effect.andThen((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result2).then(console.log)// Output: 190</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[andThen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#24292E;--1:#E1E4E8"}

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

[log]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

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
[ ]{.indent}[// Second evaluation returns the cached
result]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const cached: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[cached]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;string, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;string, never, never&gt;, ab: (_: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const andThen: &lt;string, Effect.Effect&lt;void, never, never&gt;&gt;(f: (a: string) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;string, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains two actions, where the second action can depend on the result of
the first.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))// orconst transformedEffect = Effect.andThen(myEffect, anotherEffect)// orconst transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))</code></pre>
</figure>
:::

**When to Use**

Use `andThen` when you need to run multiple actions in sequence, with
the second action depending on the result of the first. This is useful
for combining effects or handling computations that must happen in
order.

**Details**

The second action can be:

- A constant value (similar to

as

)

- A function returning a value (similar to

map

)

- A `Promise`
- A function returning a `Promise`
- An `Effect`
- A function returning an `Effect` (similar to

flatMap

)

**Note:** `andThen` works well with both `Option` and `Either` types,
treating them as effects.

**Example** (Applying a Discount Based on Fetched Amount)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Using Effect.map and Effect.flatMapconst result1 = pipe(  fetchTransactionAmount,  Effect.map((amount) =&gt; amount * 2),  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result1).then(console.log)// Output: 190
// Using Effect.andThenconst result2 = pipe(  fetchTransactionAmount,  Effect.andThen((amount) =&gt; amount * 2),  Effect.andThen((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result2).then(console.log)// Output: 190</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[andThen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#24292E;--1:#E1E4E8"}

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

[log]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

::: code
[ ]{.indent}[// Invalidate the cache before it naturally
expires]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
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
<pre data-language="ts"><code>const invalidate: Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[invalidate]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
:::
::::

::: code
[ ]{.indent}[// Third evaluation triggers the task
again]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
:::
::::

::: code
[ ]{.indent}[// since the cache was
invalidated]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
:::
::::

::::::::::::::::::::: code
[ ]{.indent}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const cached: Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[cached]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;string, never, never&gt;, Effect.Effect&lt;void, never, never&gt;&gt;(this: Effect.Effect&lt;string, never, never&gt;, ab: (_: Effect.Effect&lt;string, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;): Effect.Effect&lt;void, never, never&gt; (+21 overloads)</code></pre>
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const andThen: &lt;string, Effect.Effect&lt;void, never, never&gt;&gt;(f: (a: string) =&gt; Effect.Effect&lt;void, never, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;string, E, R&gt;) =&gt; Effect.Effect&lt;void, E, R&gt; (+3 overloads)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains two actions, where the second action can depend on the result of
the first.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const transformedEffect = pipe(myEffect, Effect.andThen(anotherEffect))// orconst transformedEffect = Effect.andThen(myEffect, anotherEffect)// orconst transformedEffect = myEffect.pipe(Effect.andThen(anotherEffect))</code></pre>
</figure>
:::

**When to Use**

Use `andThen` when you need to run multiple actions in sequence, with
the second action depending on the result of the first. This is useful
for combining effects or handling computations that must happen in
order.

**Details**

The second action can be:

- A constant value (similar to

as

)

- A function returning a value (similar to

map

)

- A `Promise`
- A function returning a `Promise`
- An `Effect`
- A function returning an `Effect` (similar to

flatMap

)

**Note:** `andThen` works well with both `Option` and `Either` types,
treating them as effects.

**Example** (Applying a Discount Based on Fetched Amount)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Using Effect.map and Effect.flatMapconst result1 = pipe(  fetchTransactionAmount,  Effect.map((amount) =&gt; amount * 2),  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result1).then(console.log)// Output: 190
// Using Effect.andThenconst result2 = pipe(  fetchTransactionAmount,  Effect.andThen((amount) =&gt; amount * 2),  Effect.andThen((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(result2).then(console.log)// Output: 190</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[andThen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
style="--0:#24292E;--1:#E1E4E8"}

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

[log]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
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
37
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
[expensive task\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
:::
::::

::: code
[result 1]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
41
:::
::::

::: code
[result 1]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
:::
::::

::: code
[expensive task\...]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
43
:::
::::

::: code
[result 2]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
44
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
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/caching/caching-effects.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Batching]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../../batching/index.html){.astro-u5aomj4k
rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[Cache]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../cache/index.html){.astro-u5aomj4k rel="next"}
:::
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
