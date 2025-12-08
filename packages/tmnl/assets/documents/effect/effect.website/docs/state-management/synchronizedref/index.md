::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# SynchronizedRef {#_top .astro-np5lzwrf}
:::
::::

:::::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::: sl-markdown-content
`SynchronizedRef<A>`{dir="auto"} serves as a mutable reference to a
value of type `A`{dir="auto"}. With it, we can store **immutable** data
and perform updates **atomically** and effectfully.

![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9InN0YXJsaWdodC1hc2lkZV9faWNvbiBhc3Ryby00cmd5N2NycCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Ym94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciIgc3R5bGU9Ii0tc2wtaWNvbi1zaXplOiAxZW07Ij48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xLjQ0IDguODU1di0uMDAxbDMuNTI3LTMuNTE2Yy4zNC0uMzQ0LjgwMi0uNTQxIDEuMjg1LS41NDhoNi42NDlsLjk0Ny0uOTQ3YzMuMDctMy4wNyA2LjIwNy0zLjA3MiA3LjYyLTIuODY4YTEuODIxIDEuODIxIDAgMCAxIDEuNTU3IDEuNTU3Yy4yMDQgMS40MTMuMjAzIDQuNTUtMi44NjggNy42MmwtLjk0Ni45NDZ2Ni42NDlhMS44NDUgMS44NDUgMCAwIDEtLjU0OSAxLjI4NmwtMy41MTYgMy41MjhhMS44NDQgMS44NDQgMCAwIDEtMy4xMS0uOTQ0bC0uODU4LTQuMjc1LTQuNTItNC41Mi0yLjMxLS40NjMtMS45NjQtLjM5NEExLjg0NyAxLjg0NyAwIDAgMSAuOTggMTAuNjkzYTEuODQzIDEuODQzIDAgMCAxIC40Ni0xLjgzOFptNS4zNzkgMi4wMTctMy44NzMtLjc3Nkw2LjMyIDYuNzMzaDQuNjM4bC00LjE0IDQuMTRabTguNDAzLTUuNjU1YzIuNDU5LTIuNDYgNC44NTYtMi40NjMgNS44OS0yLjMzLjEzNCAxLjAzNS4xMyAzLjQzMi0yLjMyOSA1Ljg5MWwtNi43MSA2LjcxLTMuNTYxLTMuNTYgNi43MS02LjcxMVptLTEuMzE4IDE1LjgzNy0uNzc2LTMuODczIDQuMTQtNC4xNHY0LjYzOWwtMy4zNjQgMy4zNzRaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIC8+PHBhdGggZD0iTTkuMzE4IDE4LjM0NWEuOTcyLjk3MiAwIDAgMC0xLjg2LS41NjFjLS40ODIgMS40MzUtMS42ODcgMi4yMDQtMi45MzQgMi42MTlhOC4yMiA4LjIyIDAgMCAxLTEuMjMuMzAyYy4wNjItLjM2NS4xNTctLjc5LjMwMy0xLjIyOS40MTUtMS4yNDcgMS4xODQtMi40NTIgMi42Mi0yLjkzNWEuOTcxLjk3MSAwIDEgMC0uNjItMS44NDJjLS4xMi4wNC0uMjM2LjA4NC0uMzUuMTMtMi4wMi44MjgtMy4wMTIgMi41ODgtMy40OTMgNC4wMzNhMTAuMzgzIDEwLjM4MyAwIDAgMC0uNTEgMi44NDVsLS4wMDEuMDE2di4wNjNjMCAuNTM2LjQzNC45NzIuOTcuOTcySDIuMjRhNy4yMSA3LjIxIDAgMCAwIC44NzgtLjA2NWMuNTI3LS4wNjMgMS4yNDgtLjE5IDIuMDItLjQ0NyAxLjQ0NS0uNDggMy4yMDUtMS40NzIgNC4wMzMtMy40OTRhNS44MjggNS44MjggMCAwIDAgLjE0Ny0uNDA3WiIgLz48L3N2Zz4=){.starlight-aside__icon
.astro-4rgy7crp} Learn Ref First

::: starlight-aside__content
Most of the operations for `SynchronizedRef`{dir="auto"} are similar to
those of `Ref`{dir="auto"}. If you're not already familiar with
`Ref`{dir="auto"}, it's recommended to read about [the Ref
concept](../ref/index.html) first.
:::

The distinctive function in `SynchronizedRef`{dir="auto"} is
`updateEffect`{dir="auto"}. This function takes an effectful operation
and executes it to modify the shared state. This is the key feature
setting `SynchronizedRef`{dir="auto"} apart from `Ref`{dir="auto"}.

In real-world applications, `SynchronizedRef`{dir="auto"} is useful when
you need to execute effects, such as querying a database, and then
update shared state based on the result. It ensures that updates happen
sequentially, preserving consistency in concurrent environments.

**Example** (Concurrent Updates with `SynchronizedRef`{dir="auto"})

In this example, we simulate fetching user ages concurrently and
updating a shared state that stores the ages:

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
<pre data-language="ts"><code>import SynchronizedRef</code></pre>
</figure>
:::
::::

[SynchronizedRef]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Simulated API to get user age]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getUserAge: (userId: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[getUserAge]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>userId: number</code></pre>
</figure>
:::
::::

[userId]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
:::::::
::::::::::

:::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::::::::::::::::::::: code
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
<pre data-language="ts"><code>userId: number</code></pre>
</figure>
:::
::::

[userId]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[10]{style="--0:#005CC5;--1:#79B8FF"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;number, never, never&gt;, Effect.Effect&lt;number, never, never&gt;&gt;(this: Effect.Effect&lt;number, never, never&gt;, ab: (_: Effect.Effect&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;number, never, never&gt;): Effect.Effect&lt;number, never, never&gt; (+21 overloads)</code></pre>
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

[delay]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[10]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[-]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>userId: number</code></pre>
</figure>
:::
::::

[userId]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::::::
::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
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
<pre data-language="ts"><code>const meanAge: Effect.Effect&lt;number[], never, never&gt;</code></pre>
</figure>
:::
::::

[meanAge]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;SynchronizedRef.SynchronizedRef&lt;number[]&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;number[], never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;[void, void, void, void], never, never&gt;&gt;, number[]&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;SynchronizedRef.SynchronizedRef&lt;number[]&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;number[], never, never&gt;&gt; | YieldWrap&lt;...&gt;, number[], never&gt;) =&gt; Effect.Effect&lt;...&gt; (+1 overload)</code></pre>
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
8
:::
::::

::: code
[ ]{.indent}[// Initialize a SynchronizedRef to hold an array of
ages]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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
<pre data-language="ts"><code>const ref: SynchronizedRef.SynchronizedRef&lt;number[]&gt;</code></pre>
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
<pre data-language="ts"><code>import SynchronizedRef</code></pre>
</figure>
:::
::::

[SynchronizedRef]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;number[]&gt;(value: number[]) =&gt; Effect.Effect&lt;SynchronizedRef.SynchronizedRef&lt;number[]&gt;, never, never&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[\[\]\>(\[\])]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
[ ]{.indent}[// Helper function to log state before each
effect]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

:::::::::::::::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const log: &lt;R, E, A&gt;(label: string, effect: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, R&gt;</code></pre>
</figure>
:::
::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) R in &lt;R, E, A&gt;(label: string, effect: Effect.Effect&lt;A, E, R&gt;): Effect.Effect&lt;A, E, R&gt;</code></pre>
</figure>
:::
::::

[R]{style="--0:#6F42C1;--1:#B392F0"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) E in &lt;R, E, A&gt;(label: string, effect: Effect.Effect&lt;A, E, R&gt;): Effect.Effect&lt;A, E, R&gt;</code></pre>
</figure>
:::
::::

[E]{style="--0:#6F42C1;--1:#B392F0"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) A in &lt;R, E, A&gt;(label: string, effect: Effect.Effect&lt;A, E, R&gt;): Effect.Effect&lt;A, E, R&gt;</code></pre>
</figure>
:::
::::

[A]{style="--0:#6F42C1;--1:#B392F0"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>label: string</code></pre>
</figure>
:::
::::

[label]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>effect: Effect.Effect&lt;A, E, R&gt;</code></pre>
</figure>
:::
::::

[effect]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
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

[Effect]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) A in &lt;R, E, A&gt;(label: string, effect: Effect.Effect&lt;A, E, R&gt;): Effect.Effect&lt;A, E, R&gt;</code></pre>
</figure>
:::
::::

[A]{style="--0:#6F42C1;--1:#B392F0"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) E in &lt;R, E, A&gt;(label: string, effect: Effect.Effect&lt;A, E, R&gt;): Effect.Effect&lt;A, E, R&gt;</code></pre>
</figure>
:::
::::

[E]{style="--0:#6F42C1;--1:#B392F0"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) R in &lt;R, E, A&gt;(label: string, effect: Effect.Effect&lt;A, E, R&gt;): Effect.Effect&lt;A, E, R&gt;</code></pre>
</figure>
:::
::::

[R]{style="--0:#6F42C1;--1:#B392F0"}[\>)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
::::::::::::::::::::::::::::
:::::::::::::::::::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;A, E, R&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, A&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;A, E, R&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, A, never&gt;) =&gt; Effect.Effect&lt;A, E, R&gt; (+1 overload)</code></pre>
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

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
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
<pre data-language="ts"><code>const value: number[]</code></pre>
</figure>
:::
::::

[value]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import SynchronizedRef</code></pre>
</figure>
:::
::::

[SynchronizedRef]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const get: &lt;number[]&gt;(self: SynchronizedRef.SynchronizedRef&lt;number[]&gt;) =&gt; Effect.Effect&lt;number[], never, never&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[get]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ref: SynchronizedRef.SynchronizedRef&lt;number[]&gt;</code></pre>
</figure>
:::
::::

[ref]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>label: string</code></pre>
</figure>
:::
::::

[label]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const value: number[]</code></pre>
</figure>
:::
::::

[value]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>effect: Effect.Effect&lt;A, E, R&gt;</code></pre>
</figure>
:::
::::

[effect]{style="--0:#24292E;--1:#E1E4E8"}
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
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[})]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const task: (id: number) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[task]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>id: number</code></pre>
</figure>
:::
::::

[id]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
:::::::
::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const log: &lt;never, never, void&gt;(label: string, effect: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::::: code
[ ]{.indent}[\`task
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>id: number</code></pre>
</figure>
:::
::::

[id]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

:::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import SynchronizedRef</code></pre>
</figure>
:::
::::

[SynchronizedRef]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const updateEffect: &lt;number[], never, never&gt;(self: SynchronizedRef.SynchronizedRef&lt;number[]&gt;, f: (a: number[]) =&gt; Effect.Effect&lt;number[], never, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt; (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[updateEffect]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ref: SynchronizedRef.SynchronizedRef&lt;number[]&gt;</code></pre>
</figure>
:::
::::

[ref]{style="--0:#24292E;--1:#E1E4E8"}[,
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>sumOfAges: number[]</code></pre>
</figure>
:::
::::

[sumOfAges]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
::::::::::::
:::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;number, never, never&gt;&gt;, number[]&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;number, never, never&gt;&gt;, number[], never&gt;) =&gt; Effect.Effect&lt;number[], never, never&gt; (+1 overload)</code></pre>
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

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getUserAge: (userId: number) =&gt; Effect.Effect&lt;number, never, never&gt;</code></pre>
</figure>
:::
::::

[getUserAge]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>id: number</code></pre>
</figure>
:::
::::

[id]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::::::::::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>sumOfAges: number[]</code></pre>
</figure>
:::
::::

[sumOfAges]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Array&lt;number&gt;.concat(...items: (number | ConcatArray&lt;number&gt;)[]): number[] (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Combines two or more arrays. This method returns a new array without
modifying any existing arrays.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [items Additional arrays
and/or items to add to the end of the
array.]{.twoslash-popup-docs-tag-value}
:::
::::::

[concat]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
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
27
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

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
:::
::::

::: code
[ ]{.indent}[// Run tasks concurrently with a limit of 2 concurrent
tasks]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
:::
::::

:::::::::::::::::::::::::: code
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

:::::::::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const all: &lt;readonly [Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;], {    concurrency: number;}&gt;(arg: readonly [Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;void, never, never&gt;], options?: {    concurrency: number;} | undefined) =&gt; Effect.Effect&lt;[void, void, void, void], never, never&gt;</code></pre>
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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const task: (id: number) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[),
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const task: (id: number) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[),
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const task: (id: number) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[3]{style="--0:#005CC5;--1:#79B8FF"}[),
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const task: (id: number) =&gt; Effect.Effect&lt;void, never, never&gt;</code></pre>
</figure>
:::
::::

[task]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[4]{style="--0:#005CC5;--1:#79B8FF"}[)\],
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::::
:::::::::::::::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
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
<pre data-language="ts"><code>concurrency: number</code></pre>
</figure>
:::
::::

[concurrency]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
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
34
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::: code
[ ]{.indent}[// Retrieve the updated
value]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
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
<pre data-language="ts"><code>const value: number[]</code></pre>
</figure>
:::
::::

[value]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import SynchronizedRef</code></pre>
</figure>
:::
::::

[SynchronizedRef]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const get: &lt;number[]&gt;(self: SynchronizedRef.SynchronizedRef&lt;number[]&gt;) =&gt; Effect.Effect&lt;number[], never, never&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[get]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ref: SynchronizedRef.SynchronizedRef&lt;number[]&gt;</code></pre>
</figure>
:::
::::

[ref]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
:::
::::

::::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const value: number[]</code></pre>
</figure>
:::
::::

[value]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
:::
::::

::: code
:::
::::::

:::::::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runPromise: &lt;number[], never&gt;(effect: Effect.Effect&lt;number[], never, never&gt;, options?: {    readonly signal?: AbortSignal | undefined;} | undefined) =&gt; Promise&lt;number[]&gt;</code></pre>
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
<pre data-language="ts"><code>const meanAge: Effect.Effect&lt;number[], never, never&gt;</code></pre>
</figure>
:::
::::

[meanAge]{style="--0:#24292E;--1:#E1E4E8"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Promise&lt;number[]&gt;.then&lt;void, never&gt;(onfulfilled?: ((value: number[]) =&gt; void | PromiseLike&lt;void&gt;) | null | undefined, onrejected?: ((reason: any) =&gt; PromiseLike&lt;never&gt;) | null | undefined): Promise&lt;void&gt;</code></pre>
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
:::::::::::::::::::::::::::::
::::::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
41
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
43
:::
::::

::: code
[timestamp=\... level=INFO fiber=#2 message=\"task 1\"
message=\[\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
44
:::
::::

::: code
[timestamp=\... level=INFO fiber=#3 message=\"task 2\"
message=\[\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
45
:::
::::

::: code
[timestamp=\... level=INFO fiber=#2 message=\"task 3\"
message=\"\[]{style="--0:#616972;--1:#99A0A6"}
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
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[10]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
47
:::
::::

::: code
[\]\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
48
:::
::::

::: code
[timestamp=\... level=INFO fiber=#3 message=\"task 4\"
message=\"\[]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
49
:::
::::

::: code
[[
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[10,]{style="--0:#616972;--1:#99A0A6"}
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
]{style="--0:#616972;--1:#99A0A6"}]{.indent}[20]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
51
:::
::::

::: code
[\]\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
52
:::
::::

::: code
[\[ 10, 20, 30, 40 \]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
53
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
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/state-management/synchronizedref.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Ref]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../ref/index.html){.astro-u5aomj4k rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[SubscriptionRef]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../subscriptionref/index.html){.astro-u5aomj4k
rel="next"}
:::
:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
