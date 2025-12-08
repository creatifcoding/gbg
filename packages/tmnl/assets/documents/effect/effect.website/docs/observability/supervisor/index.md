::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Supervisor {#_top .astro-np5lzwrf}
:::
::::

::::::::::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::::::::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::: sl-markdown-content
A `Supervisor<A>`{dir="auto"} is a utility for managing fibers in
Effect, allowing you to track their lifecycle (creation and termination)
and producing a value of type `A`{dir="auto"} that reflects this
supervision. Supervisors are useful when you need insight into or
control over the behavior of fibers within your application.

To create a supervisor, you can use the `Supervisor.track`{dir="auto"}
function. This generates a new supervisor that keeps track of its child
fibers, maintaining them in a set. This allows you to observe and
monitor their status during execution.

You can supervise an effect by using the `Effect.supervised`{dir="auto"}
function. This function takes a supervisor as an argument and returns an
effect where all child fibers forked within it are supervised by the
provided supervisor. This enables you to capture detailed information
about these child fibers, such as their status, through the supervisor.

**Example** (Monitoring Fiber Count)

In this example, we'll periodically monitor the number of fibers running
in the application using a supervisor. The program calculates a
Fibonacci number, spawning multiple fibers in the process, while a
separate monitor tracks the fiber count.

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

[Effect]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Supervisor</code></pre>
</figure>
:::
::::

[Supervisor]{style="--0:#24292E;--1:#E1E4E8"}[,
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

[Fiber]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import FiberStatus</code></pre>
</figure>
:::
::::

[FiberStatus]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}
::::::::::::::
:::::::::::::::

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
[// Main program that monitors fibers while calculating a Fibonacci
number]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;Supervisor.Supervisor&lt;Fiber.RuntimeFiber&lt;any, any&gt;[]&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;number, never, never&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;Supervisor.Supervisor&lt;Fiber.RuntimeFiber&lt;any, any&gt;[]&gt;, never, never&gt;&gt; | YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;&gt; | YieldWrap&lt;...&gt;, void, never&gt;) =&gt; Effect.Effect&lt;...&gt; (+1 overload)</code></pre>
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
5
:::
::::

::: code
[ ]{.indent}[// Create a supervisor to track child
fibers]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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
<pre data-language="ts"><code>const supervisor: Supervisor.Supervisor&lt;Fiber.RuntimeFiber&lt;any, any&gt;[]&gt;</code></pre>
</figure>
:::
::::

[supervisor]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Supervisor</code></pre>
</figure>
:::
::::

[Supervisor]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const track: Effect.Effect&lt;Supervisor.Supervisor&lt;Fiber.RuntimeFiber&lt;any, any&gt;[]&gt;, never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a new supervisor that tracks children in a set.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[track]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

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
[ ]{.indent}[// Start a Fibonacci calculation, supervised by the
supervisor]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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
<pre data-language="ts"><code>const fibFiber: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[fibFiber]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
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

[fib]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[20]{style="--0:#005CC5;--1:#79B8FF"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;number, never, never&gt;, Effect.Effect&lt;number, never, never&gt;, Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;&gt;(this: Effect.Effect&lt;number, never, never&gt;, ab: (_: Effect.Effect&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;number, never, never&gt;, bc: (_: Effect.Effect&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;): Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
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
<pre data-language="ts"><code>const supervised: &lt;Fiber.RuntimeFiber&lt;any, any&gt;[]&gt;(supervisor: Supervisor.Supervisor&lt;Fiber.RuntimeFiber&lt;any, any&gt;[]&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, R&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Supervises child fibers by reporting them to a specified supervisor.

**Details**

This function takes a supervisor as an argument and returns an effect
where all child fibers forked within it are supervised by the provided
supervisor. This enables you to capture detailed information about these
child fibers, such as their status, through the supervisor.

**Example** (Monitoring Fiber Count)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect, Supervisor, Schedule, Fiber, FiberStatus } from &quot;effect&quot;
// Main program that monitors fibers while calculating a Fibonacci numberconst program = Effect.gen(function* () {  // Create a supervisor to track child fibers  const supervisor = yield* Supervisor.track
  // Start a Fibonacci calculation, supervised by the supervisor  const fibFiber = yield* fib(20).pipe(    Effect.supervised(supervisor),    // Fork the Fibonacci effect into a fiber    Effect.fork  )
  // Define a schedule to periodically monitor the fiber count every 500ms  const policy = Schedule.spaced(&quot;500 millis&quot;).pipe(    Schedule.whileInputEffect((_) =&gt;      Fiber.status(fibFiber).pipe(        // Continue while the Fibonacci fiber is not done        Effect.andThen((status) =&gt; status !== FiberStatus.done)      )    )  )
  // Start monitoring the fibers, using the supervisor to track the count  const monitorFiber = yield* monitorFibers(supervisor).pipe(    // Repeat the monitoring according to the schedule    Effect.repeat(policy),    // Fork the monitoring into its own fiber    Effect.fork  )
  // Join the monitor and Fibonacci fibers to ensure they complete  yield* Fiber.join(monitorFiber)  const result = yield* Fiber.join(fibFiber)
  console.log(`fibonacci result: ${result}`)})
// Function to monitor and log the number of active fibersconst monitorFibers = (  supervisor: Supervisor.Supervisor&lt;Array&lt;Fiber.RuntimeFiber&lt;any, any&gt;&gt;&gt;): Effect.Effect&lt;void&gt; =&gt;  Effect.gen(function* () {    const fibers = yield* supervisor.value // Get the current set of fibers    console.log(`number of fibers: ${fibers.length}`)  })
// Recursive Fibonacci calculation, spawning fibers for each recursive stepconst fib = (n: number): Effect.Effect&lt;number&gt; =&gt;  Effect.gen(function* () {    if (n &lt;= 1) {      return 1    }    yield* Effect.sleep(&quot;500 millis&quot;) // Simulate work by delaying
    // Fork two fibers for the recursive Fibonacci calls    const fiber1 = yield* Effect.fork(fib(n - 2))    const fiber2 = yield* Effect.fork(fib(n - 1))
    // Join the fibers to retrieve their results    const v1 = yield* Fiber.join(fiber1)    const v2 = yield* Fiber.join(fiber2)
    return v1 + v2 // Combine the results  })
Effect.runPromise(program)// Output:// number of fibers: 0// number of fibers: 2// number of fibers: 6// number of fibers: 14// number of fibers: 30// number of fibers: 62// number of fibers: 126// number of fibers: 254// number of fibers: 510// number of fibers: 1022// number of fibers: 2034// number of fibers: 3795// number of fibers: 5810// number of fibers: 6474// number of fibers: 4942// number of fibers: 2515// number of fibers: 832// number of fibers: 170// number of fibers: 18// number of fibers: 0// fibonacci result: 10946</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[supervised]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const supervisor: Supervisor.Supervisor&lt;Fiber.RuntimeFiber&lt;any, any&gt;[]&gt;</code></pre>
</figure>
:::
::::

[supervisor]{style="--0:#24292E;--1:#E1E4E8"}[),]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[ ]{.indent}[// Fork the Fibonacci effect into a
fiber]{style="--0:#616972;--1:#99A0A6"}
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
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fork: &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;A, E&gt;, never, R&gt;</code></pre>
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
[ ]{.indent}[// Define a schedule to periodically monitor the fiber
count every 500ms]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const policy: Schedule.Schedule&lt;number, unknown, never&gt;</code></pre>
</figure>
:::
::::

[policy]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
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

[Schedule]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const spaced: (duration: DurationInput) =&gt; Schedule.Schedule&lt;number&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a schedule that recurs continuously, with each repetition spaced
by the specified `duration` from the last run.

**Details**

This schedule ensures that executions occur at a fixed interval,
maintaining a consistent delay between repetitions. The delay starts
from the end of the last execution, not from the schedule start time.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [fixed If you need to run at a
fixed interval from the start.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[spaced]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"500
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Schedule.Schedule&lt;number, unknown, never&gt;, Schedule.Schedule&lt;number, unknown, never&gt;&gt;(this: Schedule.Schedule&lt;number, unknown, never&gt;, ab: (_: Schedule.Schedule&lt;number, unknown, never&gt;) =&gt; Schedule.Schedule&lt;number, unknown, never&gt;): Schedule.Schedule&lt;number, unknown, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::::::::::: code
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

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const whileInputEffect: &lt;unknown, never&gt;(f: (input: unknown) =&gt; Effect.Effect&lt;boolean, never, never&gt;) =&gt; &lt;Out, R&gt;(self: Schedule.Schedule&lt;Out, unknown, R&gt;) =&gt; Schedule.Schedule&lt;Out, unknown, R&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a new schedule that continues execution for as long as the given
effectful predicate on the input evaluates to `true`.

**Details**

This function modifies an existing schedule so that it only continues
execution while an effectful predicate holds true for its input. If the
predicate evaluates to `false` at any step, the schedule stops.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whileInput If you need to use
a pure predicate.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[whileInputEffect]{style="--0:#6F42C1;--1:#B392F0"}[((]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>_: unknown</code></pre>
</figure>
:::
::::

[\_]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
:::::::::::
::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const status: &lt;number, never&gt;(self: Fiber.RuntimeFiber&lt;number, never&gt;) =&gt; Effect.Effect&lt;FiberStatus.FiberStatus&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns the `FiberStatus` of a `RuntimeFiber`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[status]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fibFiber: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[fibFiber]{style="--0:#24292E;--1:#E1E4E8"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;FiberStatus.FiberStatus, never, never&gt;, Effect.Effect&lt;boolean, never, never&gt;&gt;(this: Effect.Effect&lt;FiberStatus.FiberStatus, never, never&gt;, ab: (_: Effect.Effect&lt;FiberStatus.FiberStatus, never, never&gt;) =&gt; Effect.Effect&lt;boolean, never, never&gt;): Effect.Effect&lt;boolean, never, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::: code
[ ]{.indent}[// Continue while the Fibonacci fiber is not
done]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::::::::::::::::::::: code
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const andThen: &lt;FiberStatus.FiberStatus, boolean&gt;(f: (a: FiberStatus.FiberStatus) =&gt; boolean) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;FiberStatus.FiberStatus, E, R&gt;) =&gt; Effect.Effect&lt;boolean, E, R&gt; (+3 overloads)</code></pre>
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

[andThen]{style="--0:#6F42C1;--1:#B392F0"}[((]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>status: FiberStatus.FiberStatus</code></pre>
</figure>
:::
::::

[status]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>status: FiberStatus.FiberStatus</code></pre>
</figure>
:::
::::

[status]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[!==]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import FiberStatus</code></pre>
</figure>
:::
::::

[FiberStatus]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const done: FiberStatus.FiberStatus</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[done]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::
::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
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
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
[ ]{.indent}[// Start monitoring the fibers, using the supervisor to
track the count]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
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
<pre data-language="ts"><code>const monitorFiber: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[monitorFiber]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const monitorFibers: (supervisor: Supervisor.Supervisor&lt;Array&lt;Fiber.RuntimeFiber&lt;any, any&gt;&gt;&gt;) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::
::::

[monitorFibers]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const supervisor: Supervisor.Supervisor&lt;Fiber.RuntimeFiber&lt;any, any&gt;[]&gt;</code></pre>
</figure>
:::
::::

[supervisor]{style="--0:#24292E;--1:#E1E4E8"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;void, never, never&gt;, Effect.Effect&lt;number, never, never&gt;, Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;&gt;(this: Effect.Effect&lt;void, never, never&gt;, ab: (_: Effect.Effect&lt;void, never, never&gt;) =&gt; Effect.Effect&lt;number, never, never&gt;, bc: (_: Effect.Effect&lt;number, never, never&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt;): Effect.Effect&lt;Fiber.RuntimeFiber&lt;number, never&gt;, never, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
:::
::::

::: code
[ ]{.indent}[// Repeat the monitoring according to the
schedule]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

:::::::::::::: code
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const repeat: &lt;number, unknown, never&gt;(schedule: Schedule.Schedule&lt;number, unknown, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;unknown, E, R&gt;) =&gt; Effect.Effect&lt;number, E, R&gt; (+3 overloads)</code></pre>
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

[repeat]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const policy: Schedule.Schedule&lt;number, unknown, never&gt;</code></pre>
</figure>
:::
::::

[policy]{style="--0:#24292E;--1:#E1E4E8"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
[ ]{.indent}[// Fork the monitoring into its own
fiber]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
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
<pre data-language="ts"><code>const fork: &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;Fiber.RuntimeFiber&lt;A, E&gt;, never, R&gt;</code></pre>
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
[ ]{.indent}[// Join the monitor and Fibonacci fibers to ensure they
complete]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const monitorFiber: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[monitorFiber]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
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
<pre data-language="ts"><code>const result: number</code></pre>
</figure>
:::
::::

[result]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const fibFiber: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[fibFiber]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

::: code
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`fibonacci
result:
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const result: number</code></pre>
</figure>
:::
::::

[result]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

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

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
:::
::::

::: code
[// Function to monitor and log the number of active
fibers]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
41
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
<pre data-language="ts"><code>const monitorFibers: (supervisor: Supervisor.Supervisor&lt;Array&lt;Fiber.RuntimeFiber&lt;any, any&gt;&gt;&gt;) =&gt; Effect.Effect&lt;void&gt;</code></pre>
</figure>
:::
::::

[monitorFibers]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
:::
::::

:::::::::::::::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>supervisor: Supervisor.Supervisor&lt;Fiber.RuntimeFiber&lt;any, any&gt;[]&gt;</code></pre>
</figure>
:::
::::

[supervisor]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Supervisor</code></pre>
</figure>
:::
::::

[Supervisor]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Supervisor&lt;out T&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Supervisor]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Array&lt;T&gt;</code></pre>
</figure>
:::
::::

[Array]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Fiber</code></pre>
</figure>
:::
::::

[Fiber]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface RuntimeFiber&lt;out A, out E = never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A runtime fiber that is executing an effect. Runtime fibers have an
identity and a trace.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[RuntimeFiber]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[any]{style="--0:#005CC5;--1:#79B8FF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[any]{style="--0:#005CC5;--1:#79B8FF"}[\>\>\>]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
43
:::
::::

:::::::::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
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
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}
::::::::::
:::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
44
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;any, any&gt;[], never, never&gt;&gt;, void&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;Fiber.RuntimeFiber&lt;any, any&gt;[], never, never&gt;&gt;, void, never&gt;) =&gt; Effect.Effect&lt;void, never, never&gt; (+1 overload)</code></pre>
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

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
45
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
<pre data-language="ts"><code>const fibers: Fiber.RuntimeFiber&lt;any, any&gt;[]</code></pre>
</figure>
:::
::::

[fibers]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>supervisor: Supervisor.Supervisor&lt;Fiber.RuntimeFiber&lt;any, any&gt;[]&gt;</code></pre>
</figure>
:::
::::

[supervisor]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Supervisor&lt;RuntimeFiber&lt;any, any&gt;[]&gt;.value: Effect.Effect&lt;Fiber.RuntimeFiber&lt;any, any&gt;[], never, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns an `Effect` that succeeds with the value produced by this
supervisor. This value may change over time, reflecting what the
supervisor produces as it supervises fibers.
:::
:::::

[value]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[// Get the current set of
fibers]{style="--0:#616972;--1:#99A0A6"}
::::::::::
:::::::::::::

:::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
46
:::
::::

::::::::::::::::::: code
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

[log]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`number
of fibers:
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fibers: Fiber.RuntimeFiber&lt;any, any&gt;[]</code></pre>
</figure>
:::
::::

[fibers]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Array&lt;RuntimeFiber&lt;any, any&gt;&gt;.length: number</code></pre>
</figure>
:::

::: twoslash-popup-docs
Gets or sets the length of the array. This is a number one higher than
the highest index in the array.
:::
:::::

[length]{style="--0:#005CC5;--1:#79B8FF"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::
::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
47
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
48
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
49
:::
::::

::: code
[// Recursive Fibonacci calculation, spawning fibers for each recursive
step]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
50
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

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
51
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, number&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Effect.Effect&lt;void, never, never&gt;&gt;, number, never&gt;) =&gt; Effect.Effect&lt;number, never, never&gt; (+1 overload)</code></pre>
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

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
52
:::
::::

::::: code
[ ]{.indent}[if]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
]{style="--0:#24292E;--1:#E1E4E8"}[\<=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[)
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
53
:::
::::

::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
54
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
55
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

[sleep]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"500
millis\"]{style="--0:#032F62;--1:#9ECBFF"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[// Simulate work by
delaying]{style="--0:#616972;--1:#99A0A6"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
56
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
57
:::
::::

::: code
[ ]{.indent}[// Fork two fibers for the recursive Fibonacci
calls]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
58
:::
::::

::::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber1: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
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
]{style="--0:#24292E;--1:#E1E4E8"}[2]{style="--0:#005CC5;--1:#79B8FF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::
::::::::::::::::::::

:::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
59
:::
::::

::::::::::::::::: code
[ ]{.indent}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fiber2: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
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
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::
::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
60
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
61
:::
::::

::: code
[ ]{.indent}[// Join the fibers to retrieve their
results]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
62
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
<pre data-language="ts"><code>const v1: number</code></pre>
</figure>
:::
::::

[v1]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const fiber1: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[fiber1]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
63
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
<pre data-language="ts"><code>const v2: number</code></pre>
</figure>
:::
::::

[v2]{style="--0:#005CC5;--1:#79B8FF"}[
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
<pre data-language="ts"><code>const fiber2: Fiber.RuntimeFiber&lt;number, never&gt;</code></pre>
</figure>
:::
::::

[fiber2]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
64
:::
::::

::: code
:::
::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
65
:::
::::

::::::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const v1: number</code></pre>
</figure>
:::
::::

[v1]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[+]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const v2: number</code></pre>
</figure>
:::
::::

[v2]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[// Combine the
results]{style="--0:#616972;--1:#99A0A6"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
66
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
67
:::
::::

::: code
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
68
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
69
:::
::::

::: code
[/\*]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
70
:::
::::

::: code
[Output:]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
71
:::
::::

::: code
[number of fibers: 0]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
72
:::
::::

::: code
[number of fibers: 2]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
73
:::
::::

::: code
[number of fibers: 6]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
74
:::
::::

::: code
[number of fibers: 14]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
75
:::
::::

::: code
[number of fibers: 30]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
76
:::
::::

::: code
[number of fibers: 62]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
77
:::
::::

::: code
[number of fibers: 126]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
78
:::
::::

::: code
[number of fibers: 254]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
79
:::
::::

::: code
[number of fibers: 510]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
80
:::
::::

::: code
[number of fibers: 1022]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
81
:::
::::

::: code
[number of fibers: 2034]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
82
:::
::::

::: code
[number of fibers: 3795]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
83
:::
::::

::: code
[number of fibers: 5810]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
84
:::
::::

::: code
[number of fibers: 6474]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
85
:::
::::

::: code
[number of fibers: 4942]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
86
:::
::::

::: code
[number of fibers: 2515]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
87
:::
::::

::: code
[number of fibers: 832]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
88
:::
::::

::: code
[number of fibers: 170]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
89
:::
::::

::: code
[number of fibers: 18]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
90
:::
::::

::: code
[number of fibers: 0]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
91
:::
::::

::: code
[fibonacci result: 10946]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
92
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
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/observability/supervisor.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Tracing]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../tracing/index.html){.astro-u5aomj4k rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[Configuration]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../../configuration/index.html){.astro-u5aomj4k
rel="next"}
:::
:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
