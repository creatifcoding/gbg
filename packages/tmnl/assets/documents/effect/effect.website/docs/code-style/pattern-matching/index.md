:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Pattern Matching {#_top .astro-np5lzwrf}
:::
::::

:::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::: sl-markdown-content
Pattern matching is a method that allows developers to handle intricate
conditions within a single, concise expression. It simplifies code,
making it more concise and easier to understand. Additionally, it
includes a process called exhaustiveness checking, which helps to ensure
that no possible case has been overlooked.

Originating from functional programming languages, pattern matching
stands as a powerful technique for code branching. It often offers a
more potent and less verbose solution compared to imperative
alternatives such as if/else or switch statements, particularly when
dealing with complex conditions.

Although not yet a native feature in JavaScript, there's an ongoing
[tc39 proposal](https://github.com/tc39/proposal-pattern-matching) in
its early stages to introduce pattern matching to JavaScript. However,
this proposal is at stage 1 and might take several years to be
implemented. Nonetheless, developers can implement pattern matching in
their codebase. The `effect/Match`{dir="auto"} module provides a
reliable, type-safe pattern matching implementation that is available
for immediate use.

**Example** (Handling Different Data Types with Pattern Matching)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::

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
[// Simulated dynamic input that can be a string or a
number]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const input: string | number</code></pre>
</figure>
:::
::::

[input]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"some
input\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

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
[// ┌─── string]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[// ▼]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>const result: string</code></pre>
</figure>
:::
::::

[result]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const value: &lt;string&gt;(i: string) =&gt; Match.Matcher&lt;string, Match.Types.Without&lt;never&gt;, string, never, string, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher from a specific value.

**Details**

This function allows you to define a `Matcher` directly from a given
value, rather than from a type. This is useful when working with known
values, enabling structured pattern matching on objects, primitives, or
any data structure.

Once the matcher is created, you can use pattern-matching functions like

when

to define how different cases should be handled.

**Example** (Matching an Object by Property)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
const input = { name: &quot;John&quot;, age: 30 }
// Create a matcher for the specific objectconst result = Match.value(input).pipe(  // Match when the &#39;name&#39; property is &quot;John&quot;  Match.when(    { name: &quot;John&quot; },    (user) =&gt; `${user.name} is ${user.age} years old`  ),  // Provide a fallback if no match is found  Match.orElse(() =&gt; &quot;Oh, not John&quot;))
console.log(result)// Output: &quot;John is 30 years old&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [type for creating a matcher
from a specific type.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[value]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const input: string</code></pre>
</figure>
:::
::::

[input]{style="--0:#24292E;--1:#E1E4E8"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;string, Match.Types.Without&lt;never&gt;, string, never, string, any&gt;, Match.Matcher&lt;string, Match.Types.Without&lt;number&gt;, string, string, string, any&gt;, Match.Matcher&lt;string, Match.Types.Without&lt;string | number&gt;, never, string, string, any&gt;, string&gt;(this: Match.Matcher&lt;...&gt;, ab: (_: Match.Matcher&lt;string, Match.Types.Without&lt;never&gt;, string, never, string, any&gt;) =&gt; Match.Matcher&lt;string, Match.Types.Without&lt;number&gt;, string, string, string, any&gt;, bc: (_: Match.Matcher&lt;string, ... 4 more ..., any&gt;) =&gt; Match.Matcher&lt;...&gt;, cd: (_: Match.Matcher&lt;...&gt;) =&gt; string): string (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[ ]{.indent}[// Match if the value is a
number]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

:::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;string, Refinement&lt;unknown, number&gt;, any, (n: number) =&gt; string&gt;(pattern: Refinement&lt;unknown, number&gt;, f: (n: number) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, string, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, number&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, number&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const number: Refinement&lt;unknown, number&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Matches values of type `number`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[number]{style="--0:#24292E;--1:#E1E4E8"}[,
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

[n]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`number:
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

[n]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::
:::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[ ]{.indent}[// Match if the value is a
string]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

:::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;string, Refinement&lt;unknown, string&gt;, any, (s: string) =&gt; string&gt;(pattern: Refinement&lt;unknown, string&gt;, f: (s: string) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, string, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, string&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, string&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const string: Refinement&lt;unknown, string&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Matches values of type `string`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[string]{style="--0:#24292E;--1:#E1E4E8"}[,
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>s: string</code></pre>
</figure>
:::
::::

[s]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`string:
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>s: string</code></pre>
</figure>
:::
::::

[s]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::
:::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[ ]{.indent}[// Ensure all possible cases are
covered]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const exhaustive: &lt;I, F, A, Pr, Ret&gt;(self: Match.Matcher&lt;I, F, never, A, Pr, Ret&gt;) =&gt; [Pr] extends [never] ? (u: I) =&gt; Unify&lt;A&gt; : Unify&lt;A&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
The `Match.exhaustive` method finalizes the pattern matching process by
ensuring that all possible cases are accounted for. If any case is
missing, TypeScript will produce a type error. This is particularly
useful when working with unions, as it helps prevent unintended gaps in
pattern matching.

**Example** (Ensuring All Cases Are Covered)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for string or number valuesconst match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Mark the match as exhaustive, ensuring all cases are handled  // TypeScript will throw an error if any case is missing  //</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[exhaustive]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
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

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

:::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
<pre data-language="ts"><code>const result: string</code></pre>
</figure>
:::
::::

[result]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[// Output: \"string: some input\"]{style="--0:#616972;--1:#99A0A6"}
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
## How Pattern Matching Works

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#how-pattern-matching-works){.anchor-link
aria-labelledby="how-pattern-matching-works"}
:::

Pattern matching follows a structured process:

1.  **Creating a matcher**. Define a `Matcher`{dir="auto"} that operates
    on either a specific [type](index.html#matching-by-type) or
    [value](index.html#matching-by-value).

2.  **Defining patterns**. Use combinators such as
    `Match.when`{dir="auto"}, `Match.not`{dir="auto"}, and
    `Match.tag`{dir="auto"} to specify matching conditions.

3.  **Completing the match**. Apply a finalizer such as
    `Match.exhaustive`{dir="auto"}, `Match.orElse`{dir="auto"}, or
    `Match.option`{dir="auto"} to determine how unmatched cases should
    be handled.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Creating a matcher

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#creating-a-matcher){.anchor-link
aria-labelledby="creating-a-matcher"}
:::

You can create a `Matcher`{dir="auto"} using either:

- `Match.type<T>()`{dir="auto"}: Matches against a specific type.
- `Match.value(value)`{dir="auto"}: Matches against a specific value.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Matching by Type

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#matching-by-type){.anchor-link
aria-labelledby="matching-by-type"}
:::

The `Match.type`{dir="auto"} constructor defines a `Matcher`{dir="auto"}
that operates on a specific type. Once created, you can use patterns
like `Match.when`{dir="auto"} to define conditions for handling
different cases.

**Example** (Matching Numbers and Strings)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Create a matcher for values that are either strings or
numbers]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::: code
[//]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
[// ┌─── (u: string \| number) =\>
string]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[// ▼]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>const match: (u: string | number) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const type: &lt;string | number&gt;() =&gt; Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher for a specific type.

**Details**

This function defines a `Matcher` that operates on a given type,
allowing you to specify conditions for handling different cases. Once
the matcher is created, you can use pattern-matching functions like

when

to define how different values should be processed.

**Example** (Matching Numbers and Strings)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for values that are either strings or numbers////      ┌─── (u: string | number) =&gt; string//      ▼const match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Match when the value is a string  Match.when(Match.string, (s) =&gt; `string: ${s}`),  // Ensure all possible cases are handled  Match.exhaustive)
console.log(match(0))// Output: &quot;number: 0&quot;
console.log(match(&quot;hello&quot;))// Output: &quot;string: hello&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [value for creating a matcher
from a specific value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[type]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[\>().]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;, Match.Matcher&lt;string | number, Match.Types.Without&lt;number&gt;, string, string, never, any&gt;, Match.Matcher&lt;string | number, Match.Types.Without&lt;string | number&gt;, never, string, never, any&gt;, (u: string | number) =&gt; string&gt;(this: Match.Matcher&lt;...&gt;, ab: (_: Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;) =&gt; Match.Matcher&lt;string | number, Match.Types.Without&lt;number&gt;, string, string, never, any&gt;, bc: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, cd: (_: Match.Matcher&lt;...&gt;) =&gt; (u: string | number) =&gt; string): (u: string | number) =&gt; string (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[ ]{.indent}[// Match when the value is a
number]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

:::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;string | number, Refinement&lt;unknown, number&gt;, any, (n: number) =&gt; string&gt;(pattern: Refinement&lt;unknown, number&gt;, f: (n: number) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, string | number, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, number&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, number&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const number: Refinement&lt;unknown, number&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Matches values of type `number`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[number]{style="--0:#24292E;--1:#E1E4E8"}[,
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

[n]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`number:
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

[n]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::
:::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[ ]{.indent}[// Match when the value is a
string]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

:::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;string, Refinement&lt;unknown, string&gt;, any, (s: string) =&gt; string&gt;(pattern: Refinement&lt;unknown, string&gt;, f: (s: string) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, string, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, string&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, string&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const string: Refinement&lt;unknown, string&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Matches values of type `string`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[string]{style="--0:#24292E;--1:#E1E4E8"}[,
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>s: string</code></pre>
</figure>
:::
::::

[s]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`string:
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>s: string</code></pre>
</figure>
:::
::::

[s]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::
:::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[ ]{.indent}[// Ensure all possible cases are
handled]{style="--0:#616972;--1:#99A0A6"}
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

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const exhaustive: &lt;I, F, A, Pr, Ret&gt;(self: Match.Matcher&lt;I, F, never, A, Pr, Ret&gt;) =&gt; [Pr] extends [never] ? (u: I) =&gt; Unify&lt;A&gt; : Unify&lt;A&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
The `Match.exhaustive` method finalizes the pattern matching process by
ensuring that all possible cases are accounted for. If any case is
missing, TypeScript will produce a type error. This is particularly
useful when working with unions, as it helps prevent unintended gaps in
pattern matching.

**Example** (Ensuring All Cases Are Covered)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for string or number valuesconst match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Mark the match as exhaustive, ensuring all cases are handled  // TypeScript will throw an error if any case is missing  //</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[exhaustive]{style="--0:#24292E;--1:#E1E4E8"}
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

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

:::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (u: string | number) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[0]{style="--0:#005CC5;--1:#79B8FF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[// Output: \"number: 0\"]{style="--0:#616972;--1:#99A0A6"}
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

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

:::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (u: string | number) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"hello\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[// Output: \"string: hello\"]{style="--0:#616972;--1:#99A0A6"}
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
### Matching by Value

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#matching-by-value){.anchor-link
aria-labelledby="matching-by-value"}
:::

Instead of creating a matcher for a type, you can define one directly
from a specific value using `Match.value`{dir="auto"}.

**Example** (Matching an Object by Property)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
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
<pre data-language="ts"><code>const input: {    name: string;    age: number;}</code></pre>
</figure>
:::
::::

[input]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
{ ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>name: string</code></pre>
</figure>
:::
::::

[name]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"John\"]{style="--0:#032F62;--1:#9ECBFF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[30]{style="--0:#005CC5;--1:#79B8FF"}[
}]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

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
[// Create a matcher for the specific
object]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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
<pre data-language="ts"><code>const result: string</code></pre>
</figure>
:::
::::

[result]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const value: &lt;{    name: string;    age: number;}&gt;(i: {    name: string;    age: number;}) =&gt; Match.Matcher&lt;{    name: string;    age: number;}, Match.Types.Without&lt;never&gt;, {    name: string;    age: number;}, never, {    name: string;    age: number;}, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher from a specific value.

**Details**

This function allows you to define a `Matcher` directly from a given
value, rather than from a type. This is useful when working with known
values, enabling structured pattern matching on objects, primitives, or
any data structure.

Once the matcher is created, you can use pattern-matching functions like

when

to define how different cases should be handled.

**Example** (Matching an Object by Property)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
const input = { name: &quot;John&quot;, age: 30 }
// Create a matcher for the specific objectconst result = Match.value(input).pipe(  // Match when the &#39;name&#39; property is &quot;John&quot;  Match.when(    { name: &quot;John&quot; },    (user) =&gt; `${user.name} is ${user.age} years old`  ),  // Provide a fallback if no match is found  Match.orElse(() =&gt; &quot;Oh, not John&quot;))
console.log(result)// Output: &quot;John is 30 years old&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [type for creating a matcher
from a specific type.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[value]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const input: {    name: string;    age: number;}</code></pre>
</figure>
:::
::::

[input]{style="--0:#24292E;--1:#E1E4E8"}[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;{    name: string;    age: number;}, Match.Types.Without&lt;never&gt;, {    name: string;    age: number;}, never, {    name: string;    age: number;}, any&gt;, Match.Matcher&lt;{    name: string;    age: number;}, Match.Types.Without&lt;{    readonly name: &quot;John&quot;;}&gt;, {    name: string;    age: number;}, string, {    name: string;    age: number;}, any&gt;, string&gt;(this: Match.Matcher&lt;...&gt;, ab: (_: Match.Matcher&lt;{    name: string;    age: number;}, Match.Types.Without&lt;never&gt;, {    name: string;    age: number;}, never, {    name: string;    age: number;}, any&gt;) =&gt; Match.Matcher&lt;{    name: string;    age: number;}, Match.Types.Without&lt;{    readonly name: &quot;John&quot;;}&gt;, {    name: string;    age: number;}, string, {    name: string;    age: number;}, any&gt;, bc: (_: Match.Matcher&lt;...&gt;) =&gt; string): string (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[ ]{.indent}[// Match when the \'name\' property is
\"John\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;{    name: string;    age: number;}, {    readonly name: &quot;John&quot;;}, any, (user: {    name: &quot;John&quot;;    age: number;}) =&gt; string&gt;(pattern: {    readonly name: &quot;John&quot;;}, f: (user: {    name: &quot;John&quot;;    age: number;}) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, {    name: string;    age: number;}, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly name: &quot;John&quot;;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly name: &quot;John&quot;;}&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::: code
[[ ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[{
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>name: &quot;John&quot;</code></pre>
</figure>
:::
::::

[name]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"John\"]{style="--0:#032F62;--1:#9ECBFF"}[
},]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>user: {    name: &quot;John&quot;;    age: number;}</code></pre>
</figure>
:::
::::

[user]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>user: {    name: &quot;John&quot;;    age: number;}</code></pre>
</figure>
:::
::::

[user]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>name: &quot;John&quot;</code></pre>
</figure>
:::
::::

[name]{style="--0:#24292E;--1:#E1E4E8"}[} is
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>user: {    name: &quot;John&quot;;    age: number;}</code></pre>
</figure>
:::
::::

[user]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#24292E;--1:#E1E4E8"}[} years
old\`]{style="--0:#032F62;--1:#9ECBFF"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[),]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[ ]{.indent}[// Provide a fallback if no match is
found]{style="--0:#616972;--1:#99A0A6"}
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

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const orElse: &lt;{    name: string;    age: number;}, any, () =&gt; string&gt;(f: () =&gt; string) =&gt; &lt;I, R, A, Pr&gt;(self: Match.Matcher&lt;I, R, {    name: string;    age: number;}, A, Pr, any&gt;) =&gt; [Pr] extends [never] ? (input: I) =&gt; Unify&lt;string | A&gt; : Unify&lt;string | A&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Provides a fallback value when no patterns match.

**Details**

This function ensures that a matcher always returns a valid result, even
if no defined patterns match. It acts as a default case, similar to the
`default` clause in a `switch` statement or the final `else` in an
`if-else` chain.

**Example** (Providing a Default Value When No Patterns Match)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for string or number valuesconst match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is &quot;a&quot;  Match.when(&quot;a&quot;, () =&gt; &quot;ok&quot;),  // Fallback when no patterns match  Match.orElse(() =&gt; &quot;fallback&quot;))
console.log(match(&quot;a&quot;))// Output: &quot;ok&quot;
console.log(match(&quot;b&quot;))// Output: &quot;fallback&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[orElse]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"Oh, not
John\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
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

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

:::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
<pre data-language="ts"><code>const result: string</code></pre>
</figure>
:::
::::

[result]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[// Output: \"John is 30 years old\"]{style="--0:#616972;--1:#99A0A6"}
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
### Enforcing a Return Type

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#enforcing-a-return-type){.anchor-link
aria-labelledby="enforcing-a-return-type"}
:::

You can use `Match.withReturnType<T>()`{dir="auto"} to ensure that all
branches return a specific type.

**Example** (Validating Return Type Consistency)

This example enforces that every matching branch returns a
`string`{dir="auto"}.

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

:::::::::::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (u: {    a: number;} | {    b: string;}) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const type: &lt;{    a: number;} | {    b: string;}&gt;() =&gt; Match.Matcher&lt;{    a: number;} | {    b: string;}, Match.Types.Without&lt;never&gt;, {    a: number;} | {    b: string;}, never, never, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher for a specific type.

**Details**

This function defines a `Matcher` that operates on a given type,
allowing you to specify conditions for handling different cases. Once
the matcher is created, you can use pattern-matching functions like

when

to define how different values should be processed.

**Example** (Matching Numbers and Strings)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for values that are either strings or numbers////      ┌─── (u: string | number) =&gt; string//      ▼const match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Match when the value is a string  Match.when(Match.string, (s) =&gt; `string: ${s}`),  // Ensure all possible cases are handled  Match.exhaustive)
console.log(match(0))// Output: &quot;number: 0&quot;
console.log(match(&quot;hello&quot;))// Output: &quot;string: hello&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [value for creating a matcher
from a specific value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[type]{style="--0:#6F42C1;--1:#B392F0"}[\<{
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>a: number</code></pre>
</figure>
:::
::::

[a]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
}
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
{ ]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>b: string</code></pre>
</figure>
:::
::::

[b]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[
}\>().]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;{    a: number;} | {    b: string;}, Match.Types.Without&lt;never&gt;, {    a: number;} | {    b: string;}, never, never, any&gt;, Match.Matcher&lt;{    a: number;} | {    b: string;}, Match.Types.Without&lt;never&gt;, {    a: number;} | {    b: string;}, never, never, string&gt;, Match.Matcher&lt;{    a: number;} | {    b: string;}, Match.Types.Without&lt;{    readonly a: number;}&gt;, {    b: string;}, string, never, string&gt;, Match.Matcher&lt;{    a: number;} | {    b: string;}, Match.Types.Without&lt;{    readonly a: number;} | {    readonly b: string;}&gt;, never, string, never, string&gt;, (u: {    a: number;} | {    b: string;}) =&gt; string&gt;(this: Match.Matcher&lt;...&gt;, ab: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, bc: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, cd: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, de: (_: Match.Matcher&lt;...&gt;) =&gt; (u: {    a: number;} | {    b: string;}) =&gt; string): (u: {    a: number;} | {    b: string;}) =&gt; string (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::: code
[ ]{.indent}[// Ensure all branches return a
string]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const withReturnType: &lt;string&gt;() =&gt; &lt;I, F, R, A, Pr, _&gt;(self: Match.Matcher&lt;I, F, R, A, Pr, _&gt;) =&gt; [string] extends [[A] extends [never] ? any : A] ? Match.Matcher&lt;I, F, R, A, Pr, ([A] extends [never] ? any : A) &amp; string&gt; : &quot;withReturnType constraint does not extend Result type&quot;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Ensures that all branches of a matcher return a specific type.

**Details**

This function enforces a consistent return type across all
pattern-matching branches. By specifying a return type, TypeScript will
check that every matching condition produces a value of the expected
type.

**Important:** This function must be the first step in the matcher
pipeline. If used later, TypeScript will not enforce type consistency
correctly.

**Example** (Validating Return Type Consistency)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
const match = Match.type&lt;{ a: number } | { b: string }&gt;().pipe(  // Ensure all branches return a string  Match.withReturnType&lt;string&gt;(),  // ❌ Type error: &#39;number&#39; is not assignable to type &#39;string&#39;  //</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[withReturnType]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[\>(),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[ ]{.indent}[// ❌ Type error: returns a
number]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;{    a: number;} | {    b: string;}, {    readonly a: Refinement&lt;unknown, number&gt;;}, string, (_: {    a: number;}) =&gt; string&gt;(pattern: {    readonly a: Refinement&lt;unknown, number&gt;;}, f: (_: {    a: number;}) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, {    a: number;} | {    b: string;}, A, Pr, string&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly a: number;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly a: number;}&gt;&gt;, string | A, Pr, string&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>a: Refinement&lt;unknown, number&gt;</code></pre>
</figure>
:::
::::

[a]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const number: Refinement&lt;unknown, number&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Matches values of type `number`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[number]{style="--0:#24292E;--1:#E1E4E8"}[ },
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>_: {    a: number;}</code></pre>
</figure>
:::
::::

[\_]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
.twoslash .twoslash-error-underline}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>_: {    a: number;}</code></pre>
</figure>
:::
::::

[[\_]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoslash-error-underline}[[.]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoslash-error-underline}[[]{.twoslash-hover}]{.twoslash .twoslash
.twoslash-error-underline}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>a: number</code></pre>
</figure>
:::
::::

[[a]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoslash-error-underline}[),]{style="--0:#24292E;--1:#E1E4E8"}[[]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoerror}

::: {.twoslash-error-box .twoslash-error-level-error}
[]{.twoslash-error-box-icon}[[Error ts(2322) ―
]{.twoslash-error-box-content-title}[Type \'number\' is not assignable
to type
\'string\'.]{.twoslash-error-box-content-message}]{.twoslash-error-box-content}
:::
:::::::::::::::::::::::::
::::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[ ]{.indent}[// ✅ Correct: returns a
string]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

:::::::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;{    b: string;}, {    readonly b: Refinement&lt;unknown, string&gt;;}, string, (_: {    b: string;}) =&gt; string&gt;(pattern: {    readonly b: Refinement&lt;unknown, string&gt;;}, f: (_: {    b: string;}) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, {    b: string;}, A, Pr, string&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly b: string;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly b: string;}&gt;&gt;, string | A, Pr, string&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>b: Refinement&lt;unknown, string&gt;</code></pre>
</figure>
:::
::::

[b]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const string: Refinement&lt;unknown, string&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Matches values of type `string`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[string]{style="--0:#24292E;--1:#E1E4E8"}[ },
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>_: {    b: string;}</code></pre>
</figure>
:::
::::

[\_]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>_: {    b: string;}</code></pre>
</figure>
:::
::::

[\_]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>b: string</code></pre>
</figure>
:::
::::

[b]{style="--0:#24292E;--1:#E1E4E8"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::
:::::::::::::::::::::::::::

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

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const exhaustive: &lt;I, F, A, Pr, Ret&gt;(self: Match.Matcher&lt;I, F, never, A, Pr, Ret&gt;) =&gt; [Pr] extends [never] ? (u: I) =&gt; Unify&lt;A&gt; : Unify&lt;A&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
The `Match.exhaustive` method finalizes the pattern matching process by
ensuring that all possible cases are accounted for. If any case is
missing, TypeScript will produce a type error. This is particularly
useful when working with unions, as it helps prevent unintended gaps in
pattern matching.

**Example** (Ensuring All Cases Are Covered)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for string or number valuesconst match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Mark the match as exhaustive, ensuring all cases are handled  // TypeScript will throw an error if any case is missing  //</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[exhaustive]{style="--0:#24292E;--1:#E1E4E8"}
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

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9InN0YXJsaWdodC1hc2lkZV9faWNvbiBhc3Ryby00cmd5N2NycCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Ym94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciIgc3R5bGU9Ii0tc2wtaWNvbi1zaXplOiAxZW07Ij48cGF0aCBkPSJNMTIgMTFhMSAxIDAgMCAwLTEgMXY0YTEgMSAwIDAgMCAyIDB2LTRhMSAxIDAgMCAwLTEtMVptLjM4LTMuOTJhMSAxIDAgMCAwLS43NiAwIDEgMSAwIDAgMC0uMzMuMjEgMS4xNSAxLjE1IDAgMCAwLS4yMS4zMyAxIDEgMCAwIDAgLjIxIDEuMDljLjA5Ny4wODguMjA5LjE2LjMzLjIxQTEgMSAwIDAgMCAxMyA4YTEuMDUgMS4wNSAwIDAgMC0uMjktLjcxIDEgMSAwIDAgMC0uMzMtLjIxWk0xMiAyYTEwIDEwIDAgMSAwIDAgMjAgMTAgMTAgMCAwIDAgMC0yMFptMCAxOGE4IDggMCAxIDEgMC0xNi4wMDFBOCA4IDAgMCAxIDEyIDIwWiIgLz48L3N2Zz4=){.starlight-aside__icon
.astro-4rgy7crp} Must Be First in the Pipeline

::: starlight-aside__content
The `Match.withReturnType<T>()`{dir="auto"} call must be the first
instruction in the pipeline. If placed later, TypeScript will not
properly enforce return type consistency.
:::

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Defining patterns

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#defining-patterns){.anchor-link
aria-labelledby="defining-patterns"}
:::

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### when

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#when){.anchor-link
aria-labelledby="when"}
:::

The `Match.when`{dir="auto"} function allows you to define conditions
for matching values. It supports both direct value comparisons and
predicate functions.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Create a matcher for objects with an \"age\"
property]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>const match: (input: {    age: number;}) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const type: &lt;{    age: number;}&gt;() =&gt; Match.Matcher&lt;{    age: number;}, Match.Types.Without&lt;never&gt;, {    age: number;}, never, never, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher for a specific type.

**Details**

This function defines a `Matcher` that operates on a given type,
allowing you to specify conditions for handling different cases. Once
the matcher is created, you can use pattern-matching functions like

when

to define how different values should be processed.

**Example** (Matching Numbers and Strings)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for values that are either strings or numbers////      ┌─── (u: string | number) =&gt; string//      ▼const match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Match when the value is a string  Match.when(Match.string, (s) =&gt; `string: ${s}`),  // Ensure all possible cases are handled  Match.exhaustive)
console.log(match(0))// Output: &quot;number: 0&quot;
console.log(match(&quot;hello&quot;))// Output: &quot;string: hello&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [value for creating a matcher
from a specific value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[type]{style="--0:#6F42C1;--1:#B392F0"}[\<{
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
}\>().]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;{    age: number;}, Match.Types.Without&lt;never&gt;, {    age: number;}, never, never, any&gt;, Match.Matcher&lt;{    age: number;}, Match.Types.Without&lt;{    readonly age: never;}&gt;, {    age: number;}, string, never, any&gt;, Match.Matcher&lt;{    age: number;}, Match.Types.Without&lt;{    readonly age: never;} | {    readonly age: 18;}&gt;, {    age: number;}, string, never, any&gt;, (input: {    age: number;}) =&gt; string&gt;(this: Match.Matcher&lt;...&gt;, ab: (_: Match.Matcher&lt;{    age: number;}, Match.Types.Without&lt;never&gt;, {    age: number;}, never, never, any&gt;) =&gt; Match.Matcher&lt;...&gt;, bc: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, cd: (_: Match.Matcher&lt;...&gt;) =&gt; (input: {    age: number;}) =&gt; string): (input: {    age: number;}) =&gt; string (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
[ ]{.indent}[// Match when age is greater than
18]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

:::::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;{    age: number;}, {    readonly age: (age: number) =&gt; boolean;}, any, (user: {    age: number;}) =&gt; string&gt;(pattern: {    readonly age: (age: number) =&gt; boolean;}, f: (user: {    age: number;}) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, {    age: number;}, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly age: never;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly age: never;}&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: (age: number) =&gt; boolean</code></pre>
</figure>
:::
::::

[age]{style="--0:#6F42C1;--1:#B392F0"}[:
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[18]{style="--0:#005CC5;--1:#79B8FF"}[
}, (]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>user: {    age: number;}</code></pre>
</figure>
:::
::::

[user]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`Age:
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>user: {    age: number;}</code></pre>
</figure>
:::
::::

[user]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::
:::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[ ]{.indent}[// Match when age is exactly
18]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;{    age: number;}, {    readonly age: 18;}, any, () =&gt; string&gt;(pattern: {    readonly age: 18;}, f: () =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, {    age: number;}, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly age: 18;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly age: 18;}&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: 18</code></pre>
</figure>
:::
::::

[age]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[18]{style="--0:#005CC5;--1:#79B8FF"}[
}, ()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"You can
vote\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[ ]{.indent}[// Fallback case for all other
ages]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

:::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const orElse: &lt;{    age: number;}, any, (user: {    age: number;}) =&gt; string&gt;(f: (user: {    age: number;}) =&gt; string) =&gt; &lt;I, R, A, Pr&gt;(self: Match.Matcher&lt;I, R, {    age: number;}, A, Pr, any&gt;) =&gt; [Pr] extends [never] ? (input: I) =&gt; Unify&lt;string | A&gt; : Unify&lt;string | A&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Provides a fallback value when no patterns match.

**Details**

This function ensures that a matcher always returns a valid result, even
if no defined patterns match. It acts as a default case, similar to the
`default` clause in a `switch` statement or the final `else` in an
`if-else` chain.

**Example** (Providing a Default Value When No Patterns Match)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for string or number valuesconst match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is &quot;a&quot;  Match.when(&quot;a&quot;, () =&gt; &quot;ok&quot;),  // Fallback when no patterns match  Match.orElse(() =&gt; &quot;fallback&quot;))
console.log(match(&quot;a&quot;))// Output: &quot;ok&quot;
console.log(match(&quot;b&quot;))// Output: &quot;fallback&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[orElse]{style="--0:#6F42C1;--1:#B392F0"}[((]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>user: {    age: number;}</code></pre>
</figure>
:::
::::

[user]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>user: {    age: number;}</code></pre>
</figure>
:::
::::

[user]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#24292E;--1:#E1E4E8"}[} is too
young\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

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

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

:::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (input: {    age: number;}) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[20]{style="--0:#005CC5;--1:#79B8FF"}[
}))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[// Output: \"Age: 20\"]{style="--0:#616972;--1:#99A0A6"}
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

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

:::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (input: {    age: number;}) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[18]{style="--0:#005CC5;--1:#79B8FF"}[
}))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[// Output: \"You can vote\"]{style="--0:#616972;--1:#99A0A6"}
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

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

:::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (input: {    age: number;}) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>age: number</code></pre>
</figure>
:::
::::

[age]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[4]{style="--0:#005CC5;--1:#79B8FF"}[
}))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[// Output: \"4 is too young\"]{style="--0:#616972;--1:#99A0A6"}
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
### not

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#not){.anchor-link aria-labelledby="not"}
:::

The `Match.not`{dir="auto"} function allows you to exclude specific
values while matching all others.

**Example** (Ignoring a Specific Value)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Create a matcher for string or number
values]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const match: (input: string | number) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const type: &lt;string | number&gt;() =&gt; Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher for a specific type.

**Details**

This function defines a `Matcher` that operates on a given type,
allowing you to specify conditions for handling different cases. Once
the matcher is created, you can use pattern-matching functions like

when

to define how different values should be processed.

**Example** (Matching Numbers and Strings)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for values that are either strings or numbers////      ┌─── (u: string | number) =&gt; string//      ▼const match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Match when the value is a string  Match.when(Match.string, (s) =&gt; `string: ${s}`),  // Ensure all possible cases are handled  Match.exhaustive)
console.log(match(0))// Output: &quot;number: 0&quot;
console.log(match(&quot;hello&quot;))// Output: &quot;string: hello&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [value for creating a matcher
from a specific value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[type]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[\>().]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;, Match.Matcher&lt;string | number, Match.Types.Only&lt;&quot;hi&quot;&gt;, &quot;hi&quot;, string, never, any&gt;, (input: string | number) =&gt; string&gt;(this: Match.Matcher&lt;...&gt;, ab: (_: Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;) =&gt; Match.Matcher&lt;string | number, Match.Types.Only&lt;&quot;hi&quot;&gt;, &quot;hi&quot;, string, never, any&gt;, bc: (_: Match.Matcher&lt;string | number, Match.Types.Only&lt;&quot;hi&quot;&gt;, &quot;hi&quot;, string, never, any&gt;) =&gt; (input: string | number) =&gt; string): (input: string | number) =&gt; string (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
[ ]{.indent}[// Match any value except \"hi\", returning
\"ok\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const not: &lt;string | number, &quot;hi&quot;, any, () =&gt; string&gt;(pattern: &quot;hi&quot;, f: () =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, string | number, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddOnly&lt;F, &quot;hi&quot;&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddOnly&lt;F, &quot;hi&quot;&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Excludes a specific value from matching while allowing all others.

**Details**

This function is useful when you need to **handle all values except one
or more specific cases**. Instead of listing all possible matches
manually, this function simplifies the logic by allowing you to specify
values to exclude. Any excluded value will bypass the provided function
and continue matching through other cases.

**Example** (Ignoring a Specific Value)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for string or number valuesconst match = Match.type&lt;string | number&gt;().pipe(  // Match any value except &quot;hi&quot;, returning &quot;ok&quot;  Match.not(&quot;hi&quot;, () =&gt; &quot;ok&quot;),  // Fallback case for when the value is &quot;hi&quot;  Match.orElse(() =&gt; &quot;fallback&quot;))
console.log(match(&quot;hello&quot;))// Output: &quot;ok&quot;
console.log(match(&quot;hi&quot;))// Output: &quot;fallback&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[not]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"hi\"]{style="--0:#032F62;--1:#9ECBFF"}[,
()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"ok\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[ ]{.indent}[// Fallback case for when the value is
\"hi\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const orElse: &lt;&quot;hi&quot;, any, () =&gt; string&gt;(f: () =&gt; string) =&gt; &lt;I, R, A, Pr&gt;(self: Match.Matcher&lt;I, R, &quot;hi&quot;, A, Pr, any&gt;) =&gt; [Pr] extends [never] ? (input: I) =&gt; Unify&lt;string | A&gt; : Unify&lt;string | A&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Provides a fallback value when no patterns match.

**Details**

This function ensures that a matcher always returns a valid result, even
if no defined patterns match. It acts as a default case, similar to the
`default` clause in a `switch` statement or the final `else` in an
`if-else` chain.

**Example** (Providing a Default Value When No Patterns Match)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for string or number valuesconst match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is &quot;a&quot;  Match.when(&quot;a&quot;, () =&gt; &quot;ok&quot;),  // Fallback when no patterns match  Match.orElse(() =&gt; &quot;fallback&quot;))
console.log(match(&quot;a&quot;))// Output: &quot;ok&quot;
console.log(match(&quot;b&quot;))// Output: &quot;fallback&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[orElse]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"fallback\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

:::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (input: string | number) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"hello\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[// Output: \"ok\"]{style="--0:#616972;--1:#99A0A6"}
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

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

:::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (input: string | number) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"hi\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[// Output: \"fallback\"]{style="--0:#616972;--1:#99A0A6"}
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
### tag

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#tag){.anchor-link aria-labelledby="tag"}
:::

The `Match.tag`{dir="auto"} function allows pattern matching based on
the `_tag`{dir="auto"} field in a [Discriminated
Union](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions).
You can specify multiple tags to match within a single pattern.

**Example** (Matching a Discriminated Union by Tag)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Event = {    readonly _tag: &quot;fetch&quot;;} | {    readonly _tag: &quot;success&quot;;    readonly data: string;} | {    readonly _tag: &quot;error&quot;;    readonly error: Error;} | {    readonly _tag: &quot;cancel&quot;;}</code></pre>
</figure>
:::
::::

[Event]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::: code
[ ]{.indent}[\|]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>_tag: &quot;fetch&quot;</code></pre>
</figure>
:::
::::

[\_tag]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"fetch\"]{style="--0:#032F62;--1:#9ECBFF"}[
}]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::: code
[ ]{.indent}[\|]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>_tag: &quot;success&quot;</code></pre>
</figure>
:::
::::

[\_tag]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"success\"]{style="--0:#032F62;--1:#9ECBFF"}[;
]{style="--0:#24292E;--1:#E1E4E8"}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>data: string</code></pre>
</figure>
:::
::::

[data]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[
}]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::::::::: code
[ ]{.indent}[\|]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>_tag: &quot;error&quot;</code></pre>
</figure>
:::
::::

[\_tag]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"error\"]{style="--0:#032F62;--1:#9ECBFF"}[;
]{style="--0:#24292E;--1:#E1E4E8"}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>error: Error</code></pre>
</figure>
:::
::::

[error]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Error</code></pre>
</figure>
:::
::::

[Error]{style="--0:#6F42C1;--1:#B392F0"}[
}]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::::: code
[ ]{.indent}[\|]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>_tag: &quot;cancel&quot;</code></pre>
</figure>
:::
::::

[\_tag]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"cancel\"]{style="--0:#032F62;--1:#9ECBFF"}[
}]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

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
[// Create a Matcher for Either\<number,
string\>]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
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
<pre data-language="ts"><code>const match: (u: Event) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const type: &lt;Event&gt;() =&gt; Match.Matcher&lt;Event, Match.Types.Without&lt;never&gt;, Event, never, never, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher for a specific type.

**Details**

This function defines a `Matcher` that operates on a given type,
allowing you to specify conditions for handling different cases. Once
the matcher is created, you can use pattern-matching functions like

when

to define how different values should be processed.

**Example** (Matching Numbers and Strings)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for values that are either strings or numbers////      ┌─── (u: string | number) =&gt; string//      ▼const match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Match when the value is a string  Match.when(Match.string, (s) =&gt; `string: ${s}`),  // Ensure all possible cases are handled  Match.exhaustive)
console.log(match(0))// Output: &quot;number: 0&quot;
console.log(match(&quot;hello&quot;))// Output: &quot;string: hello&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [value for creating a matcher
from a specific value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[type]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Event = {    readonly _tag: &quot;fetch&quot;;} | {    readonly _tag: &quot;success&quot;;    readonly data: string;} | {    readonly _tag: &quot;error&quot;;    readonly error: Error;} | {    readonly _tag: &quot;cancel&quot;;}</code></pre>
</figure>
:::
::::

[Event]{style="--0:#6F42C1;--1:#B392F0"}[\>().]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;Event, Match.Types.Without&lt;never&gt;, Event, never, never, any&gt;, Match.Matcher&lt;Event, Match.Types.Without&lt;{    readonly _tag: &quot;fetch&quot;;} | {    readonly _tag: &quot;success&quot;;    readonly data: string;}&gt;, {    readonly _tag: &quot;error&quot;;    readonly error: Error;} | {    readonly _tag: &quot;cancel&quot;;}, string, never, any&gt;, Match.Matcher&lt;Event, Match.Types.Without&lt;{    readonly _tag: &quot;fetch&quot;;} | {    readonly _tag: &quot;success&quot;;    readonly data: string;} | {    readonly _tag: &quot;error&quot;;    readonly error: Error;}&gt;, {    readonly _tag: &quot;cancel&quot;;}, string, never, any&gt;, Match.Matcher&lt;...&gt;, (u: Event) =&gt; string&gt;(this: Match.Matcher&lt;...&gt;, ab: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, bc: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, cd: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, de: (_: Match.Matcher&lt;...&gt;) =&gt; (u: Event) =&gt; string): (u: Event) =&gt; string (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[ ]{.indent}[// Match either \"fetch\" or
\"success\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const tag: &lt;Event, &quot;fetch&quot; | &quot;success&quot;, any, () =&gt; string&gt;(...pattern: [first: &quot;fetch&quot; | &quot;success&quot;, ...values: (&quot;fetch&quot; | &quot;success&quot;)[], f: () =&gt; string]) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, Event, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly _tag: &quot;fetch&quot;;} | {    readonly _tag: &quot;success&quot;;    readonly data: string;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly _tag: &quot;fetch&quot;;} | {    readonly _tag: &quot;success&quot;;    readonly data: string;}&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
The `Match.tag` function allows pattern matching based on the `_tag`
field in a [Discriminated
Union](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions).
You can specify multiple tags to match within a single pattern.

**Note**

The `Match.tag` function relies on the convention within the Effect
ecosystem of naming the tag field as `"_tag"`. Ensure that your
discriminated unions follow this naming convention for proper
functionality.

**Example** (Matching a Discriminated Union by Tag)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
type Event =  | { readonly _tag: &quot;fetch&quot; }  | { readonly _tag: &quot;success&quot;; readonly data: string }  | { readonly _tag: &quot;error&quot;; readonly error: Error }  | { readonly _tag: &quot;cancel&quot; }
// Create a Matcher for Either&lt;number, string&gt;const match = Match.type&lt;Event&gt;().pipe(  // Match either &quot;fetch&quot; or &quot;success&quot;  Match.tag(&quot;fetch&quot;, &quot;success&quot;, () =&gt; `Ok!`),  // Match &quot;error&quot; and extract the error message  Match.tag(&quot;error&quot;, (event) =&gt; `Error: ${event.error.message}`),  // Match &quot;cancel&quot;  Match.tag(&quot;cancel&quot;, () =&gt; &quot;Cancelled&quot;),  Match.exhaustive)
console.log(match({ _tag: &quot;success&quot;, data: &quot;Hello&quot; }))// Output: &quot;Ok!&quot;
console.log(match({ _tag: &quot;error&quot;, error: new Error(&quot;Oops!&quot;) }))// Output: &quot;Error: Oops!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[tag]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"fetch\"]{style="--0:#032F62;--1:#9ECBFF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[\"success\"]{style="--0:#032F62;--1:#9ECBFF"}[,
()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`Ok!\`]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[ ]{.indent}[// Match \"error\" and extract the error
message]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

:::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const tag: &lt;{    readonly _tag: &quot;error&quot;;    readonly error: Error;} | {    readonly _tag: &quot;cancel&quot;;}, &quot;error&quot;, any, (event: {    readonly _tag: &quot;error&quot;;    readonly error: Error;}) =&gt; string&gt;(...pattern: [first: &quot;error&quot;, ...values: &quot;error&quot;[], f: (event: {    readonly _tag: &quot;error&quot;;    readonly error: Error;}) =&gt; string]) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, {    readonly _tag: &quot;error&quot;;    readonly error: Error;} | {    readonly _tag: &quot;cancel&quot;;}, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly _tag: &quot;error&quot;;    readonly error: Error;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly _tag: &quot;error&quot;;    readonly error: Error;}&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
The `Match.tag` function allows pattern matching based on the `_tag`
field in a [Discriminated
Union](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions).
You can specify multiple tags to match within a single pattern.

**Note**

The `Match.tag` function relies on the convention within the Effect
ecosystem of naming the tag field as `"_tag"`. Ensure that your
discriminated unions follow this naming convention for proper
functionality.

**Example** (Matching a Discriminated Union by Tag)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
type Event =  | { readonly _tag: &quot;fetch&quot; }  | { readonly _tag: &quot;success&quot;; readonly data: string }  | { readonly _tag: &quot;error&quot;; readonly error: Error }  | { readonly _tag: &quot;cancel&quot; }
// Create a Matcher for Either&lt;number, string&gt;const match = Match.type&lt;Event&gt;().pipe(  // Match either &quot;fetch&quot; or &quot;success&quot;  Match.tag(&quot;fetch&quot;, &quot;success&quot;, () =&gt; `Ok!`),  // Match &quot;error&quot; and extract the error message  Match.tag(&quot;error&quot;, (event) =&gt; `Error: ${event.error.message}`),  // Match &quot;cancel&quot;  Match.tag(&quot;cancel&quot;, () =&gt; &quot;Cancelled&quot;),  Match.exhaustive)
console.log(match({ _tag: &quot;success&quot;, data: &quot;Hello&quot; }))// Output: &quot;Ok!&quot;
console.log(match({ _tag: &quot;error&quot;, error: new Error(&quot;Oops!&quot;) }))// Output: &quot;Error: Oops!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[tag]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"error\"]{style="--0:#032F62;--1:#9ECBFF"}[,
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>event: {    readonly _tag: &quot;error&quot;;    readonly error: Error;}</code></pre>
</figure>
:::
::::

[event]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`Error:
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>event: {    readonly _tag: &quot;error&quot;;    readonly error: Error;}</code></pre>
</figure>
:::
::::

[event]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>error: Error</code></pre>
</figure>
:::
::::

[error]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Error.message: string</code></pre>
</figure>
:::
::::

[message]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[ ]{.indent}[// Match \"cancel\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const tag: &lt;{    readonly _tag: &quot;cancel&quot;;}, &quot;cancel&quot;, any, () =&gt; string&gt;(...pattern: [first: &quot;cancel&quot;, ...values: &quot;cancel&quot;[], f: () =&gt; string]) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, {    readonly _tag: &quot;cancel&quot;;}, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly _tag: &quot;cancel&quot;;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly _tag: &quot;cancel&quot;;}&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
The `Match.tag` function allows pattern matching based on the `_tag`
field in a [Discriminated
Union](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions).
You can specify multiple tags to match within a single pattern.

**Note**

The `Match.tag` function relies on the convention within the Effect
ecosystem of naming the tag field as `"_tag"`. Ensure that your
discriminated unions follow this naming convention for proper
functionality.

**Example** (Matching a Discriminated Union by Tag)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
type Event =  | { readonly _tag: &quot;fetch&quot; }  | { readonly _tag: &quot;success&quot;; readonly data: string }  | { readonly _tag: &quot;error&quot;; readonly error: Error }  | { readonly _tag: &quot;cancel&quot; }
// Create a Matcher for Either&lt;number, string&gt;const match = Match.type&lt;Event&gt;().pipe(  // Match either &quot;fetch&quot; or &quot;success&quot;  Match.tag(&quot;fetch&quot;, &quot;success&quot;, () =&gt; `Ok!`),  // Match &quot;error&quot; and extract the error message  Match.tag(&quot;error&quot;, (event) =&gt; `Error: ${event.error.message}`),  // Match &quot;cancel&quot;  Match.tag(&quot;cancel&quot;, () =&gt; &quot;Cancelled&quot;),  Match.exhaustive)
console.log(match({ _tag: &quot;success&quot;, data: &quot;Hello&quot; }))// Output: &quot;Ok!&quot;
console.log(match({ _tag: &quot;error&quot;, error: new Error(&quot;Oops!&quot;) }))// Output: &quot;Error: Oops!&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[tag]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"cancel\"]{style="--0:#032F62;--1:#9ECBFF"}[,
()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"Cancelled\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const exhaustive: &lt;I, F, A, Pr, Ret&gt;(self: Match.Matcher&lt;I, F, never, A, Pr, Ret&gt;) =&gt; [Pr] extends [never] ? (u: I) =&gt; Unify&lt;A&gt; : Unify&lt;A&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
The `Match.exhaustive` method finalizes the pattern matching process by
ensuring that all possible cases are accounted for. If any case is
missing, TypeScript will produce a type error. This is particularly
useful when working with unions, as it helps prevent unintended gaps in
pattern matching.

**Example** (Ensuring All Cases Are Covered)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for string or number valuesconst match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Mark the match as exhaustive, ensuring all cases are handled  // TypeScript will throw an error if any case is missing  //</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[exhaustive]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
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

::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

:::::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (u: Event) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>_tag: &quot;success&quot;</code></pre>
</figure>
:::
::::

[\_tag]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"success\"]{style="--0:#032F62;--1:#9ECBFF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>data: string</code></pre>
</figure>
:::
::::

[data]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"Hello\"]{style="--0:#032F62;--1:#9ECBFF"}[
}))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::
:::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
[// Output: \"Ok!\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::: code
:::
::::::

::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

:::::::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (u: Event) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>_tag: &quot;error&quot;</code></pre>
</figure>
:::
::::

[\_tag]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"error\"]{style="--0:#032F62;--1:#9ECBFF"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>error: Error</code></pre>
</figure>
:::
::::

[error]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[new]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Error: ErrorConstructornew (message?: string) =&gt; Error</code></pre>
</figure>
:::
::::

[Error]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"Oops!\"]{style="--0:#032F62;--1:#9ECBFF"}[)
}))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::
:::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
:::
::::

::: code
[// Output: \"Error: Oops!\"]{style="--0:#616972;--1:#99A0A6"}
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

![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9InN0YXJsaWdodC1hc2lkZV9faWNvbiBhc3Ryby00cmd5N2NycCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Ym94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciIgc3R5bGU9Ii0tc2wtaWNvbi1zaXplOiAxZW07Ij48cGF0aCBkPSJNMTIgMTZhMSAxIDAgMSAwIDAgMiAxIDEgMCAwIDAgMC0yWm0xMC42NyAxLjQ3LTguMDUtMTRhMyAzIDAgMCAwLTUuMjQgMGwtOCAxNEEzIDMgMCAwIDAgMy45NCAyMmgxNi4xMmEzIDMgMCAwIDAgMi42MS00LjUzWm0tMS43MyAyYTEgMSAwIDAgMS0uODguNTFIMy45NGExIDEgMCAwIDEtLjg4LS41MSAxIDEgMCAwIDEgMC0xbDgtMTRhMSAxIDAgMCAxIDEuNzggMGw4LjA1IDE0YTEgMSAwIDAgMSAuMDUgMS4wMnYtLjAyWk0xMiA4YTEgMSAwIDAgMC0xIDF2NGExIDEgMCAwIDAgMiAwVjlhMSAxIDAgMCAwLTEtMVoiIC8+PC9zdmc+){.starlight-aside__icon
.astro-4rgy7crp} Tag Field Naming Convention

::: starlight-aside__content
The `Match.tag`{dir="auto"} function relies on the convention within the
Effect ecosystem of naming the tag field as `"_tag"`{dir="auto"}. Ensure
that your discriminated unions follow this naming convention for proper
functionality.
:::

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Built-in Predicates

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#built-in-predicates){.anchor-link
aria-labelledby="built-in-predicates"}
:::

The `Match`{dir="auto"} module provides built-in predicates for common
types, such as `Match.number`{dir="auto"}, `Match.string`{dir="auto"},
and `Match.boolean`{dir="auto"}. These predicates simplify the process
of matching against primitive types.

**Example** (Using Built-in Predicates for Property Keys)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
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
<pre data-language="ts"><code>const matchPropertyKey: (u: PropertyKey) =&gt; string</code></pre>
</figure>
:::
::::

[matchPropertyKey]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const type: &lt;PropertyKey&gt;() =&gt; Match.Matcher&lt;PropertyKey, Match.Types.Without&lt;never&gt;, PropertyKey, never, never, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher for a specific type.

**Details**

This function defines a `Matcher` that operates on a given type,
allowing you to specify conditions for handling different cases. Once
the matcher is created, you can use pattern-matching functions like

when

to define how different values should be processed.

**Example** (Matching Numbers and Strings)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for values that are either strings or numbers////      ┌─── (u: string | number) =&gt; string//      ▼const match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Match when the value is a string  Match.when(Match.string, (s) =&gt; `string: ${s}`),  // Ensure all possible cases are handled  Match.exhaustive)
console.log(match(0))// Output: &quot;number: 0&quot;
console.log(match(&quot;hello&quot;))// Output: &quot;string: hello&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [value for creating a matcher
from a specific value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[type]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type PropertyKey = string | number | symbol</code></pre>
</figure>
:::
::::

[PropertyKey]{style="--0:#6F42C1;--1:#B392F0"}[\>().]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;PropertyKey, Match.Types.Without&lt;never&gt;, PropertyKey, never, never, any&gt;, Match.Matcher&lt;PropertyKey, Match.Types.Without&lt;number&gt;, string | symbol, string, never, any&gt;, Match.Matcher&lt;PropertyKey, Match.Types.Without&lt;string | number&gt;, symbol, string, never, any&gt;, Match.Matcher&lt;PropertyKey, Match.Types.Without&lt;string | number | symbol&gt;, never, string, never, any&gt;, (u: PropertyKey) =&gt; string&gt;(this: Match.Matcher&lt;...&gt;, ab: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, bc: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, cd: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, de: (_: Match.Matcher&lt;...&gt;) =&gt; (u: PropertyKey) =&gt; string): (u: PropertyKey) =&gt; string (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::: code
[ ]{.indent}[// Match when the value is a
number]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

:::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;PropertyKey, Refinement&lt;unknown, number&gt;, any, (n: number) =&gt; string&gt;(pattern: Refinement&lt;unknown, number&gt;, f: (n: number) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, PropertyKey, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, number&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, number&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const number: Refinement&lt;unknown, number&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Matches values of type `number`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[number]{style="--0:#24292E;--1:#E1E4E8"}[,
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

[n]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`Key is a number:
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

[n]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::
:::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[ ]{.indent}[// Match when the value is a
string]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

:::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;string | symbol, Refinement&lt;unknown, string&gt;, any, (s: string) =&gt; string&gt;(pattern: Refinement&lt;unknown, string&gt;, f: (s: string) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, string | symbol, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, string&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, string&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const string: Refinement&lt;unknown, string&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Matches values of type `string`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[string]{style="--0:#24292E;--1:#E1E4E8"}[,
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>s: string</code></pre>
</figure>
:::
::::

[s]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`Key is a string:
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>s: string</code></pre>
</figure>
:::
::::

[s]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::
:::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[ ]{.indent}[// Match when the value is a
symbol]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;symbol, Refinement&lt;unknown, symbol&gt;, any, (s: symbol) =&gt; string&gt;(pattern: Refinement&lt;unknown, symbol&gt;, f: (s: symbol) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, symbol, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, symbol&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, symbol&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const symbol: Refinement&lt;unknown, symbol&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Matches values of type `symbol`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[symbol]{style="--0:#24292E;--1:#E1E4E8"}[,
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>s: symbol</code></pre>
</figure>
:::
::::

[s]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`Key is a symbol:
\${]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var String: StringConstructor(value?: any) =&gt; string</code></pre>
</figure>
:::

::: twoslash-popup-docs
Allows manipulation and formatting of text strings and determination and
location of substrings within strings.
:::
:::::

[String]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#032F62;--1:#9ECBFF"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>s: symbol</code></pre>
</figure>
:::
::::

[s]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#032F62;--1:#9ECBFF"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::::::
::::::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[ ]{.indent}[// Ensure all possible cases are
handled]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

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

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const exhaustive: &lt;I, F, A, Pr, Ret&gt;(self: Match.Matcher&lt;I, F, never, A, Pr, Ret&gt;) =&gt; [Pr] extends [never] ? (u: I) =&gt; Unify&lt;A&gt; : Unify&lt;A&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
The `Match.exhaustive` method finalizes the pattern matching process by
ensuring that all possible cases are accounted for. If any case is
missing, TypeScript will produce a type error. This is particularly
useful when working with unions, as it helps prevent unintended gaps in
pattern matching.

**Example** (Ensuring All Cases Are Covered)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for string or number valuesconst match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Mark the match as exhaustive, ensuring all cases are handled  // TypeScript will throw an error if any case is missing  //</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[exhaustive]{style="--0:#24292E;--1:#E1E4E8"}
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

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

:::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const matchPropertyKey: (u: PropertyKey) =&gt; string</code></pre>
</figure>
:::
::::

[matchPropertyKey]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[42]{style="--0:#005CC5;--1:#79B8FF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[// Output: \"Key is a number: 42\"]{style="--0:#616972;--1:#99A0A6"}
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

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

:::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const matchPropertyKey: (u: PropertyKey) =&gt; string</code></pre>
</figure>
:::
::::

[matchPropertyKey]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"username\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[// Output: \"Key is a string:
username\"]{style="--0:#616972;--1:#99A0A6"}
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

::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

:::::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const matchPropertyKey: (u: PropertyKey) =&gt; string</code></pre>
</figure>
:::
::::

[matchPropertyKey]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Symbol: SymbolConstructor(description?: string | number) =&gt; symbol</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a new unique Symbol value.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [description Description of
the new Symbol object.]{.twoslash-popup-docs-tag-value}
:::
::::::

[Symbol]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"id\"]{style="--0:#032F62;--1:#9ECBFF"}[)))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::
:::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

::: code
[// Output: \"Key is a symbol:
Symbol(id)\"]{style="--0:#616972;--1:#99A0A6"}
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

  Predicate                               Description
  --------------------------------------- -------------------------------------------------------------------------------------------------------------------
  `Match.string`{dir="auto"}              Matches values of type `string`{dir="auto"}.
  `Match.nonEmptyString`{dir="auto"}      Matches non-empty strings.
  `Match.number`{dir="auto"}              Matches values of type `number`{dir="auto"}.
  `Match.boolean`{dir="auto"}             Matches values of type `boolean`{dir="auto"}.
  `Match.bigint`{dir="auto"}              Matches values of type `bigint`{dir="auto"}.
  `Match.symbol`{dir="auto"}              Matches values of type `symbol`{dir="auto"}.
  `Match.date`{dir="auto"}                Matches values that are instances of `Date`{dir="auto"}.
  `Match.record`{dir="auto"}              Matches objects where keys are `string`{dir="auto"} or `symbol`{dir="auto"} and values are `unknown`{dir="auto"}.
  `Match.null`{dir="auto"}                Matches the value `null`{dir="auto"}.
  `Match.undefined`{dir="auto"}           Matches the value `undefined`{dir="auto"}.
  `Match.defined`{dir="auto"}             Matches any defined (non-null and non-undefined) value.
  `Match.any`{dir="auto"}                 Matches any value without restrictions.
  `Match.is(...values)`{dir="auto"}       Matches a specific set of literal values (e.g., `Match.is("a", 42, true)`{dir="auto"}).
  `Match.instanceOf(Class)`{dir="auto"}   Matches instances of a given class.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Completing the match

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#completing-the-match){.anchor-link
aria-labelledby="completing-the-match"}
:::

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### exhaustive

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#exhaustive){.anchor-link
aria-labelledby="exhaustive"}
:::

The `Match.exhaustive`{dir="auto"} method finalizes the pattern matching
process by ensuring that all possible cases are accounted for. If any
case is missing, TypeScript will produce a type error. This is
particularly useful when working with unions, as it helps prevent
unintended gaps in pattern matching.

**Example** (Ensuring All Cases Are Covered)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Create a matcher for string or number
values]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const match: never</code></pre>
</figure>
:::
::::

[match]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const type: &lt;string | number&gt;() =&gt; Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher for a specific type.

**Details**

This function defines a `Matcher` that operates on a given type,
allowing you to specify conditions for handling different cases. Once
the matcher is created, you can use pattern-matching functions like

when

to define how different values should be processed.

**Example** (Matching Numbers and Strings)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for values that are either strings or numbers////      ┌─── (u: string | number) =&gt; string//      ▼const match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Match when the value is a string  Match.when(Match.string, (s) =&gt; `string: ${s}`),  // Ensure all possible cases are handled  Match.exhaustive)
console.log(match(0))// Output: &quot;number: 0&quot;
console.log(match(&quot;hello&quot;))// Output: &quot;string: hello&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [value for creating a matcher
from a specific value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[type]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[\>().]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;, never, never&gt;(this: Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;, ab: (_: Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;) =&gt; never, bc: (_: never) =&gt; never): never (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
[ ]{.indent}[// Match when the value is a
number]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

:::::::::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;string | number, Refinement&lt;unknown, number&gt;, any, (n: number) =&gt; string&gt;(pattern: Refinement&lt;unknown, number&gt;, f: (n: number) =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, string | number, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, number&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, number&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const number: Refinement&lt;unknown, number&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Matches values of type `number`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[number]{style="--0:#24292E;--1:#E1E4E8"}[,
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

[n]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\`number:
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

[n]{style="--0:#24292E;--1:#E1E4E8"}[}\`]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::
:::::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[ ]{.indent}[// Mark the match as exhaustive, ensuring all cases are
handled]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[ ]{.indent}[// TypeScript will throw an error if any case is
missing]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

:::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
.twoslash .twoslash-error-underline}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[[Match]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoslash-error-underline}[[.]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoslash-error-underline}[[exhaustive]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoslash-error-underline}[[[]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoslash-error-underline}]{.twoslash .twoerror}

::: {.twoslash-error-box .twoslash-error-level-error}
[]{.twoslash-error-box-icon}[[Error ts(2345) ―
]{.twoslash-error-box-content-title}[Argument of type \'\<I, F, A, Pr,
Ret\>(self: Matcher\<I, F, never, A, Pr, Ret\>) =\> \[Pr\] extends
\[never\] ? (u: I) =\> Unify\<A\> : Unify\<A\>\' is not assignable to
parameter of type \'(\_: Matcher\<string \| number, Without\<number\>,
string, string, never, any\>) =\> (u: string \| number) =\> string\'.
Types of parameters \'self\' and \'\_\' are incompatible. Type
\'Matcher\<string \| number, Without\<number\>, string, string, never,
any\>\' is not assignable to type \'Matcher\<string \| number,
Without\<number\>, never, string, never, any\>\'. Type
\'TypeMatcher\<string \| number, Without\<number\>, string, string,
any\>\' is not assignable to type \'Matcher\<string \| number,
Without\<number\>, never, string, never, any\>\'. Type
\'TypeMatcher\<string \| number, Without\<number\>, string, string,
any\>\' is not assignable to type \'TypeMatcher\<string \| number,
Without\<number\>, never, string, any\>\'. Type \'string\' is not
assignable to type
\'never\'.]{.twoslash-error-box-content-message}]{.twoslash-error-box-content}
:::
::::::
:::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
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
### orElse

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#orelse){.anchor-link
aria-labelledby="orelse"}
:::

The `Match.orElse`{dir="auto"} method defines a fallback value to return
when no other patterns match. This ensures that the matcher always
produces a valid result.

**Example** (Providing a Default Value When No Patterns Match)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Create a matcher for string or number
values]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const match: (input: string | number) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const type: &lt;string | number&gt;() =&gt; Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher for a specific type.

**Details**

This function defines a `Matcher` that operates on a given type,
allowing you to specify conditions for handling different cases. Once
the matcher is created, you can use pattern-matching functions like

when

to define how different values should be processed.

**Example** (Matching Numbers and Strings)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for values that are either strings or numbers////      ┌─── (u: string | number) =&gt; string//      ▼const match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Match when the value is a string  Match.when(Match.string, (s) =&gt; `string: ${s}`),  // Ensure all possible cases are handled  Match.exhaustive)
console.log(match(0))// Output: &quot;number: 0&quot;
console.log(match(&quot;hello&quot;))// Output: &quot;string: hello&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [value for creating a matcher
from a specific value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[type]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[\>().]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;, Match.Matcher&lt;string | number, Match.Types.Without&lt;&quot;a&quot;&gt;, string | number, string, never, any&gt;, (input: string | number) =&gt; string&gt;(this: Match.Matcher&lt;...&gt;, ab: (_: Match.Matcher&lt;string | number, Match.Types.Without&lt;never&gt;, string | number, never, never, any&gt;) =&gt; Match.Matcher&lt;string | number, Match.Types.Without&lt;&quot;a&quot;&gt;, string | number, string, never, any&gt;, bc: (_: Match.Matcher&lt;string | number, ... 4 more ..., any&gt;) =&gt; (input: string | number) =&gt; string): (input: string | number) =&gt; string (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::: code
[ ]{.indent}[// Match when the value is
\"a\"]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;string | number, &quot;a&quot;, any, () =&gt; string&gt;(pattern: &quot;a&quot;, f: () =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, string | number, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, &quot;a&quot;&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, &quot;a&quot;&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"a\"]{style="--0:#032F62;--1:#9ECBFF"}[,
()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"ok\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[ ]{.indent}[// Fallback when no patterns
match]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const orElse: &lt;string | number, any, () =&gt; string&gt;(f: () =&gt; string) =&gt; &lt;I, R, A, Pr&gt;(self: Match.Matcher&lt;I, R, string | number, A, Pr, any&gt;) =&gt; [Pr] extends [never] ? (input: I) =&gt; Unify&lt;string | A&gt; : Unify&lt;string | A&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Provides a fallback value when no patterns match.

**Details**

This function ensures that a matcher always returns a valid result, even
if no defined patterns match. It acts as a default case, similar to the
`default` clause in a `switch` statement or the final `else` in an
`if-else` chain.

**Example** (Providing a Default Value When No Patterns Match)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for string or number valuesconst match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is &quot;a&quot;  Match.when(&quot;a&quot;, () =&gt; &quot;ok&quot;),  // Fallback when no patterns match  Match.orElse(() =&gt; &quot;fallback&quot;))
console.log(match(&quot;a&quot;))// Output: &quot;ok&quot;
console.log(match(&quot;b&quot;))// Output: &quot;fallback&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[orElse]{style="--0:#6F42C1;--1:#B392F0"}[(()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"fallback\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

:::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (input: string | number) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"a\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[// Output: \"ok\"]{style="--0:#616972;--1:#99A0A6"}
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

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

:::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const match: (input: string | number) =&gt; string</code></pre>
</figure>
:::
::::

[match]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"b\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::: code
[// Output: \"fallback\"]{style="--0:#616972;--1:#99A0A6"}
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
### option

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#option){.anchor-link
aria-labelledby="option"}
:::

`Match.option`{dir="auto"} wraps the match result in an
[Option](../../data-types/option/index.html). If a match is found, it
returns `Some(value)`{dir="auto"}, otherwise, it returns
`None`{dir="auto"}.

**Example** (Extracting a User Role with Option)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type User = {    readonly role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot;;}</code></pre>
</figure>
:::
::::

[User]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
{
]{style="--0:#24292E;--1:#E1E4E8"}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot;</code></pre>
</figure>
:::
::::

[role]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"admin\"]{style="--0:#032F62;--1:#9ECBFF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"editor\"]{style="--0:#032F62;--1:#9ECBFF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"viewer\"]{style="--0:#032F62;--1:#9ECBFF"}[
}]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

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
[// Create a matcher to extract user
roles]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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
<pre data-language="ts"><code>const getRole: (input: User) =&gt; Option&lt;string&gt;</code></pre>
</figure>
:::
::::

[getRole]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const type: &lt;User&gt;() =&gt; Match.Matcher&lt;User, Match.Types.Without&lt;never&gt;, User, never, never, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher for a specific type.

**Details**

This function defines a `Matcher` that operates on a given type,
allowing you to specify conditions for handling different cases. Once
the matcher is created, you can use pattern-matching functions like

when

to define how different values should be processed.

**Example** (Matching Numbers and Strings)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for values that are either strings or numbers////      ┌─── (u: string | number) =&gt; string//      ▼const match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Match when the value is a string  Match.when(Match.string, (s) =&gt; `string: ${s}`),  // Ensure all possible cases are handled  Match.exhaustive)
console.log(match(0))// Output: &quot;number: 0&quot;
console.log(match(&quot;hello&quot;))// Output: &quot;string: hello&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [value for creating a matcher
from a specific value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[type]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type User = {    readonly role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot;;}</code></pre>
</figure>
:::
::::

[User]{style="--0:#6F42C1;--1:#B392F0"}[\>().]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;User, Match.Types.Without&lt;never&gt;, User, never, never, any&gt;, Match.Matcher&lt;User, Match.Types.Without&lt;{    readonly role: &quot;admin&quot;;}&gt;, User, string, never, any&gt;, Match.Matcher&lt;User, Match.Types.Without&lt;{    readonly role: &quot;admin&quot;;} | {    readonly role: &quot;editor&quot;;}&gt;, User, string, never, any&gt;, (input: User) =&gt; Option&lt;string&gt;&gt;(this: Match.Matcher&lt;...&gt;, ab: (_: Match.Matcher&lt;User, Match.Types.Without&lt;never&gt;, User, never, never, any&gt;) =&gt; Match.Matcher&lt;...&gt;, bc: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, cd: (_: Match.Matcher&lt;...&gt;) =&gt; (input: User) =&gt; Option&lt;string&gt;): (input: User) =&gt; Option&lt;string&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;User, {    readonly role: &quot;admin&quot;;}, any, () =&gt; string&gt;(pattern: {    readonly role: &quot;admin&quot;;}, f: () =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, User, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly role: &quot;admin&quot;;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly role: &quot;admin&quot;;}&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>role: &quot;admin&quot;</code></pre>
</figure>
:::
::::

[role]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"admin\"]{style="--0:#032F62;--1:#9ECBFF"}[
}, ()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"Has full
access\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;User, {    readonly role: &quot;editor&quot;;}, any, () =&gt; string&gt;(pattern: {    readonly role: &quot;editor&quot;;}, f: () =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, User, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly role: &quot;editor&quot;;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly role: &quot;editor&quot;;}&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>role: &quot;editor&quot;</code></pre>
</figure>
:::
::::

[role]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"editor\"]{style="--0:#032F62;--1:#9ECBFF"}[
}, ()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"Can edit
content\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const option: &lt;I, F, R, A, Pr, Ret&gt;(self: Match.Matcher&lt;I, F, R, A, Pr, Ret&gt;) =&gt; [Pr] extends [never] ? (input: I) =&gt; Option&lt;Unify&lt;A&gt;&gt; : Option&lt;Unify&lt;A&gt;&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Wraps the match result in an `Option`, representing an optional match.

**Details**

This function ensures that the result of a matcher is wrapped in an
`Option`, making it easy to handle cases where no pattern matches. If a
match is found, it returns `Some(value)`, otherwise, it returns `None`.

This is useful in cases where a missing match is expected and should be
handled explicitly rather than throwing an error or returning a default
value.

**Example** (Extracting a User Role with `Match.option`)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
type User = { readonly role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot; }
// Create a matcher to extract user rolesconst getRole = Match.type&lt;User&gt;().pipe(  Match.when({ role: &quot;admin&quot; }, () =&gt; &quot;Has full access&quot;),  Match.when({ role: &quot;editor&quot; }, () =&gt; &quot;Can edit content&quot;),  Match.option // Wrap the result in an Option)
console.log(getRole({ role: &quot;admin&quot; }))// Output: { _id: &#39;Option&#39;, _tag: &#39;Some&#39;, value: &#39;Has full access&#39; }
console.log(getRole({ role: &quot;viewer&quot; }))// Output: { _id: &#39;Option&#39;, _tag: &#39;None&#39; }</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[option]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[// Wrap the result in an
Option]{style="--0:#616972;--1:#99A0A6"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
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

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

:::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getRole: (input: User) =&gt; Option&lt;string&gt;</code></pre>
</figure>
:::
::::

[getRole]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot;</code></pre>
</figure>
:::
::::

[role]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"admin\"]{style="--0:#032F62;--1:#9ECBFF"}[
}))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[// Output: { \_id: \'Option\', \_tag: \'Some\', value: \'Has full
access\' }]{style="--0:#616972;--1:#99A0A6"}
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

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

:::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getRole: (input: User) =&gt; Option&lt;string&gt;</code></pre>
</figure>
:::
::::

[getRole]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot;</code></pre>
</figure>
:::
::::

[role]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"viewer\"]{style="--0:#032F62;--1:#9ECBFF"}[
}))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[// Output: { \_id: \'Option\', \_tag: \'None\'
}]{style="--0:#616972;--1:#99A0A6"}
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
### either

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#either){.anchor-link
aria-labelledby="either"}
:::

The `Match.either`{dir="auto"} method wraps the result in an
[Either](../../data-types/either/index.html), providing a structured way
to distinguish between matched and unmatched cases. If a match is found,
it returns `Right(value)`{dir="auto"}, otherwise, it returns
`Left(no match)`{dir="auto"}.

**Example** (Extracting a User Role with Either)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Match</code></pre>
</figure>
:::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type User = {    readonly role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot;;}</code></pre>
</figure>
:::
::::

[User]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
{
]{style="--0:#24292E;--1:#E1E4E8"}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot;</code></pre>
</figure>
:::
::::

[role]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"admin\"]{style="--0:#032F62;--1:#9ECBFF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"editor\"]{style="--0:#032F62;--1:#9ECBFF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"viewer\"]{style="--0:#032F62;--1:#9ECBFF"}[
}]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

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
[// Create a matcher to extract user
roles]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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
<pre data-language="ts"><code>const getRole: (input: User) =&gt; Either&lt;string, User&gt;</code></pre>
</figure>
:::
::::

[getRole]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const type: &lt;User&gt;() =&gt; Match.Matcher&lt;User, Match.Types.Without&lt;never&gt;, User, never, never, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Creates a matcher for a specific type.

**Details**

This function defines a `Matcher` that operates on a given type,
allowing you to specify conditions for handling different cases. Once
the matcher is created, you can use pattern-matching functions like

when

to define how different values should be processed.

**Example** (Matching Numbers and Strings)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for values that are either strings or numbers////      ┌─── (u: string | number) =&gt; string//      ▼const match = Match.type&lt;string | number&gt;().pipe(  // Match when the value is a number  Match.when(Match.number, (n) =&gt; `number: ${n}`),  // Match when the value is a string  Match.when(Match.string, (s) =&gt; `string: ${s}`),  // Ensure all possible cases are handled  Match.exhaustive)
console.log(match(0))// Output: &quot;number: 0&quot;
console.log(match(&quot;hello&quot;))// Output: &quot;string: hello&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [value for creating a matcher
from a specific value.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[type]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type User = {    readonly role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot;;}</code></pre>
</figure>
:::
::::

[User]{style="--0:#6F42C1;--1:#B392F0"}[\>().]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Match.Matcher&lt;User, Match.Types.Without&lt;never&gt;, User, never, never, any&gt;, Match.Matcher&lt;User, Match.Types.Without&lt;{    readonly role: &quot;admin&quot;;}&gt;, User, string, never, any&gt;, Match.Matcher&lt;User, Match.Types.Without&lt;{    readonly role: &quot;admin&quot;;} | {    readonly role: &quot;editor&quot;;}&gt;, User, string, never, any&gt;, (input: User) =&gt; Either&lt;string, User&gt;&gt;(this: Match.Matcher&lt;...&gt;, ab: (_: Match.Matcher&lt;User, Match.Types.Without&lt;never&gt;, User, never, never, any&gt;) =&gt; Match.Matcher&lt;...&gt;, bc: (_: Match.Matcher&lt;...&gt;) =&gt; Match.Matcher&lt;...&gt;, cd: (_: Match.Matcher&lt;...&gt;) =&gt; (input: User) =&gt; Either&lt;string, User&gt;): (input: User) =&gt; Either&lt;string, User&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;User, {    readonly role: &quot;admin&quot;;}, any, () =&gt; string&gt;(pattern: {    readonly role: &quot;admin&quot;;}, f: () =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, User, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly role: &quot;admin&quot;;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly role: &quot;admin&quot;;}&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>role: &quot;admin&quot;</code></pre>
</figure>
:::
::::

[role]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"admin\"]{style="--0:#032F62;--1:#9ECBFF"}[
}, ()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"Has full
access\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const when: &lt;User, {    readonly role: &quot;editor&quot;;}, any, () =&gt; string&gt;(pattern: {    readonly role: &quot;editor&quot;;}, f: () =&gt; string) =&gt; &lt;I, F, A, Pr&gt;(self: Match.Matcher&lt;I, F, User, A, Pr, any&gt;) =&gt; Match.Matcher&lt;I, Match.Types.AddWithout&lt;F, {    readonly role: &quot;editor&quot;;}&gt;, Match.Types.ApplyFilters&lt;I, Match.Types.AddWithout&lt;F, {    readonly role: &quot;editor&quot;;}&gt;&gt;, string | A, Pr, any&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Defines a condition for matching values.

**Details**

This function enables pattern matching by checking whether a given value
satisfies a condition. It supports both direct value comparisons and
predicate functions. If the condition is met, the associated function is
executed.

This function is useful when defining matchers that need to check for
specific values or apply logical conditions to determine a match. It
works well with structured objects and primitive types.

**Example** (Matching with Values and Predicates)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
// Create a matcher for objects with an &quot;age&quot; propertyconst match = Match.type&lt;{ age: number }&gt;().pipe(  // Match when age is greater than 18  Match.when({ age: (age) =&gt; age &gt; 18 }, (user) =&gt; `Age: ${user.age}`),  // Match when age is exactly 18  Match.when({ age: 18 }, () =&gt; &quot;You can vote&quot;),  // Fallback case for all other ages  Match.orElse((user) =&gt; `${user.age} is too young`))
console.log(match({ age: 20 }))// Output: &quot;Age: 20&quot;
console.log(match({ age: 18 }))// Output: &quot;You can vote&quot;
console.log(match({ age: 4 }))// Output: &quot;4 is too young&quot;</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [whenOr Use this when multiple
patterns should match in a single
condition.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [whenAnd Use this when a value
must match all provided patterns.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [orElse Provides a fallback
when no patterns match.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[when]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>role: &quot;editor&quot;</code></pre>
</figure>
:::
::::

[role]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"editor\"]{style="--0:#032F62;--1:#9ECBFF"}[
}, ()
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"Can edit
content\"]{style="--0:#032F62;--1:#9ECBFF"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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
<pre data-language="ts"><code>import Match</code></pre>
</figure>
:::
::::

[Match]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const either: &lt;I, F, R, A, Pr, Ret&gt;(self: Match.Matcher&lt;I, F, R, A, Pr, Ret&gt;) =&gt; [Pr] extends [never] ? (input: I) =&gt; Either&lt;Unify&lt;A&gt;, R&gt; : Either&lt;Unify&lt;A&gt;, R&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Wraps the match result in an `Either`, distinguishing matched and
unmatched cases.

**Details**

This function ensures that the result of a matcher is always wrapped in
an `Either`, allowing clear differentiation between successful matches
(`Right(value)`) and cases where no pattern matched
(`Left(unmatched value)`).

This approach is particularly useful when handling optional values or
when an unmatched case should be explicitly handled rather than
returning a default value or throwing an error.

**Example** (Extracting a User Role with `Match.either`)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Match } from &quot;effect&quot;
type User = { readonly role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot; }
// Create a matcher to extract user rolesconst getRole = Match.type&lt;User&gt;().pipe(  Match.when({ role: &quot;admin&quot; }, () =&gt; &quot;Has full access&quot;),  Match.when({ role: &quot;editor&quot; }, () =&gt; &quot;Can edit content&quot;),  Match.either // Wrap the result in an Either)
console.log(getRole({ role: &quot;admin&quot; }))// Output: { _id: &#39;Either&#39;, _tag: &#39;Right&#39;, right: &#39;Has full access&#39; }
console.log(getRole({ role: &quot;viewer&quot; }))// Output: { _id: &#39;Either&#39;, _tag: &#39;Left&#39;, left: { role: &#39;viewer&#39; } }</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[either]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[// Wrap the result in an
Either]{style="--0:#616972;--1:#99A0A6"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
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

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

:::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getRole: (input: User) =&gt; Either&lt;string, User&gt;</code></pre>
</figure>
:::
::::

[getRole]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot;</code></pre>
</figure>
:::
::::

[role]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"admin\"]{style="--0:#032F62;--1:#9ECBFF"}[
}))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[// Output: { \_id: \'Either\', \_tag: \'Right\', right: \'Has full
access\' }]{style="--0:#616972;--1:#99A0A6"}
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

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

:::::::::::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

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
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getRole: (input: User) =&gt; Either&lt;string, User&gt;</code></pre>
</figure>
:::
::::

[getRole]{style="--0:#6F42C1;--1:#B392F0"}[({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>role: &quot;admin&quot; | &quot;editor&quot; | &quot;viewer&quot;</code></pre>
</figure>
:::
::::

[role]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"viewer\"]{style="--0:#032F62;--1:#9ECBFF"}[
}))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[// Output: { \_id: \'Either\', \_tag: \'Left\', left: { role:
\'viewer\' } }]{style="--0:#616972;--1:#99A0A6"}
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
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/code-style/pattern-matching.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Branded Types]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../branded-types/index.html){.astro-u5aomj4k
rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[Excessive Nesting]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../do/index.html){.astro-u5aomj4k rel="next"}
:::
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
