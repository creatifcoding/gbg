::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Branded Types {#_top .astro-np5lzwrf}
:::
::::

::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::: sl-markdown-content
In this guide, we will explore the concept of **branded types** in
TypeScript and learn how to create and work with them using the Brand
module. Branded types are TypeScript types with an added type tag that
helps prevent accidental usage of a value in the wrong context. They
allow us to create distinct types based on an existing underlying type,
enabling type safety and better code organization.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## The Problem with TypeScript's Structural Typing

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#the-problem-with-typescripts-structural-typing){.anchor-link
aria-labelledby="the-problem-with-typescripts-structural-typing"}
:::

TypeScript's type system is structurally typed, meaning that two types
are considered compatible if their members are compatible. This can lead
to situations where values of the same underlying type are used
interchangeably, even when they represent different concepts or have
different meanings.

Consider the following types:

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1type type UserId = number</code></pre>
</figure>
:::
:::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}
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
<pre data-language="ts"><code>type ProductId = number</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}
:::::
::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

Here, `UserId`{dir="auto"} and `ProductId`{dir="auto"} are structurally
identical as they are both based on `number`{dir="auto"}. TypeScript
will treat these as interchangeable, potentially causing bugs if they
are mixed up in your application.

**Example** (Unintended Type Compatibility)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1type type UserId = number</code></pre>
</figure>
:::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}

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
<pre data-language="ts"><code>type ProductId = number</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}
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

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getUserById: (id: UserId) =&gt; void</code></pre>
</figure>
:::
::::

[getUserById]{style="--0:#6F42C1;--1:#B392F0"}[
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
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type UserId = number</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[ ]{.indent}[// Logic to retrieve user]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getProductById: (id: ProductId) =&gt; void</code></pre>
</figure>
:::
::::

[getProductById]{style="--0:#6F42C1;--1:#B392F0"}[
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
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId = number</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[ ]{.indent}[// Logic to retrieve
product]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
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
<pre data-language="ts"><code>const id: number</code></pre>
</figure>
:::
::::

[id]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type UserId = number</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
:::
::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getProductById: (id: ProductId) =&gt; void</code></pre>
</figure>
:::
::::

[getProductById]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const id: number</code></pre>
</figure>
:::
::::

[id]{style="--0:#24292E;--1:#E1E4E8"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[// No type error, but incorrect
usage]{style="--0:#616972;--1:#99A0A6"}
:::::::
::::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

In the example above, passing a `UserId`{dir="auto"} to
`getProductById`{dir="auto"} does not produce a type error, even though
it's logically incorrect. This happens because both types are considered
interchangeable.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## How Branded Types Help

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#how-branded-types-help){.anchor-link
aria-labelledby="how-branded-types-help"}
:::

Branded types allow you to create distinct types from the same
underlying type by adding a unique type tag, enforcing proper usage at
compile-time.

Branding is accomplished by adding a symbolic identifier that
distinguishes one type from another at the type level. This method
ensures that types remain distinct without altering their runtime
characteristics.

Let's start by introducing the `BrandTypeId`{dir="auto"} symbol:

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1const const BrandTypeId: typeof BrandTypeId</code></pre>
</figure>
:::

[BrandTypeId]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[unique]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[symbol]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Symbol: SymbolConstructor</code></pre>
</figure>
:::
::::

[Symbol]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>SymbolConstructor.for(key: string): symbol</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a Symbol object from the global symbol registry matching the
given key if found. Otherwise, returns a new symbol with this key.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [key key to search
for.]{.twoslash-popup-docs-tag-value}
:::
::::::

[for]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"effect/Brand\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}

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
<pre data-language="ts"><code>type ProductId = number &amp; {    readonly [BrandTypeId]: {        readonly ProductId: &quot;ProductId&quot;;    };}</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const BrandTypeId: typeof BrandTypeId</code></pre>
</figure>
:::
::::

[BrandTypeId]{style="--0:#24292E;--1:#E1E4E8"}[\]]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId: &quot;ProductId&quot;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"ProductId\"]{style="--0:#032F62;--1:#9ECBFF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[// unique identifier for
ProductId]{style="--0:#616972;--1:#99A0A6"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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

This approach assigns a unique identifier as a brand to the
`number`{dir="auto"} type, effectively differentiating
`ProductId`{dir="auto"} from other numerical types. The use of a symbol
ensures that the branding field does not conflict with any existing
properties of the `number`{dir="auto"} type.

Attempting to use a `UserId`{dir="auto"} in place of a
`ProductId`{dir="auto"} now results in an error:

**Example** (Enforcing Type Safety with Branded Types)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1const const BrandTypeId: typeof BrandTypeId</code></pre>
</figure>
:::

[BrandTypeId]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[unique]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[symbol]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Symbol: SymbolConstructor</code></pre>
</figure>
:::
::::

[Symbol]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>SymbolConstructor.for(key: string): symbol</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a Symbol object from the global symbol registry matching the
given key if found. Otherwise, returns a new symbol with this key.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [key key to search
for.]{.twoslash-popup-docs-tag-value}
:::
::::::

[for]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"effect/Brand\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}

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
<pre data-language="ts"><code>type ProductId = number &amp; {    readonly [BrandTypeId]: {        readonly ProductId: &quot;ProductId&quot;;    };}</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const BrandTypeId: typeof BrandTypeId</code></pre>
</figure>
:::
::::

[BrandTypeId]{style="--0:#24292E;--1:#E1E4E8"}[\]]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId: &quot;ProductId&quot;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"ProductId\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getProductById: (id: ProductId) =&gt; void</code></pre>
</figure>
:::
::::

[getProductById]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>id: ProductId</code></pre>
</figure>
:::
::::

[id]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId = number &amp; {    readonly [BrandTypeId]: {        readonly ProductId: &quot;ProductId&quot;;    };}</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[ ]{.indent}[// Logic to retrieve
product]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
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
<pre data-language="ts"><code>type UserId = number</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
:::
::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
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
<pre data-language="ts"><code>const id: number</code></pre>
</figure>
:::
::::

[id]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type UserId = number</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

:::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getProductById: (id: ProductId) =&gt; void</code></pre>
</figure>
:::
::::

[getProductById]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[id]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoslash-error-underline}[)]{style="--0:#24292E;--1:#E1E4E8"}[[]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoerror}

::: {.twoslash-error-box .twoslash-error-level-error}
[]{.twoslash-error-box-icon}[[Error ts(2345) ―
]{.twoslash-error-box-content-title}[Argument of type \'number\' is not
assignable to parameter of type \'ProductId\'. Type \'number\' is not
assignable to type \'{ readonly \[BrandTypeId\]: { readonly ProductId:
\"ProductId\"; };
}\'.]{.twoslash-error-box-content-message}]{.twoslash-error-box-content}
:::
::::::
:::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

The error message clearly states that a `number`{dir="auto"} cannot be
used in place of a `ProductId`{dir="auto"}.

TypeScript won't let us pass an instance of `number`{dir="auto"} to the
function accepting `ProductId`{dir="auto"} because it's missing the
brand field.

Let's add branding to `UserId`{dir="auto"} as well:

**Example** (Branding UserId and ProductId)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1const const BrandTypeId: typeof BrandTypeId</code></pre>
</figure>
:::

[BrandTypeId]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[unique]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[symbol]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Symbol: SymbolConstructor</code></pre>
</figure>
:::
::::

[Symbol]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>SymbolConstructor.for(key: string): symbol</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a Symbol object from the global symbol registry matching the
given key if found. Otherwise, returns a new symbol with this key.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [key key to search
for.]{.twoslash-popup-docs-tag-value}
:::
::::::

[for]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"effect/Brand\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}

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
<pre data-language="ts"><code>type ProductId = number &amp; {    readonly [BrandTypeId]: {        readonly ProductId: &quot;ProductId&quot;;    };}</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const BrandTypeId: typeof BrandTypeId</code></pre>
</figure>
:::
::::

[BrandTypeId]{style="--0:#24292E;--1:#E1E4E8"}[\]]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId: &quot;ProductId&quot;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"ProductId\"]{style="--0:#032F62;--1:#9ECBFF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[// unique identifier for
ProductId]{style="--0:#616972;--1:#99A0A6"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getProductById: (id: ProductId) =&gt; void</code></pre>
</figure>
:::
::::

[getProductById]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>id: ProductId</code></pre>
</figure>
:::
::::

[id]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId = number &amp; {    readonly [BrandTypeId]: {        readonly ProductId: &quot;ProductId&quot;;    };}</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[ ]{.indent}[// Logic to retrieve
product]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
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
<pre data-language="ts"><code>type UserId = number &amp; {    readonly [BrandTypeId]: {        readonly UserId: &quot;UserId&quot;;    };}</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const BrandTypeId: typeof BrandTypeId</code></pre>
</figure>
:::
::::

[BrandTypeId]{style="--0:#24292E;--1:#E1E4E8"}[\]]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type UserId: &quot;UserId&quot;</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"UserId\"]{style="--0:#032F62;--1:#9ECBFF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[// unique identifier for
UserId]{style="--0:#616972;--1:#99A0A6"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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
[declare]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const id: UserId</code></pre>
</figure>
:::
::::

[id]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type UserId = number &amp; {    readonly [BrandTypeId]: {        readonly UserId: &quot;UserId&quot;;    };}</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
:::
::::

:::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getProductById: (id: ProductId) =&gt; void</code></pre>
</figure>
:::
::::

[getProductById]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[id]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoslash-error-underline}[)]{style="--0:#24292E;--1:#E1E4E8"}[[]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoerror}

::: {.twoslash-error-box .twoslash-error-level-error}
[]{.twoslash-error-box-icon}[[Error ts(2345) ―
]{.twoslash-error-box-content-title}[Argument of type \'UserId\' is not
assignable to parameter of type \'ProductId\'. Type \'UserId\' is not
assignable to type \'{ readonly \[BrandTypeId\]: { readonly ProductId:
\"ProductId\"; }; }\'. Types of property \'\[BrandTypeId\]\' are
incompatible. Property \'ProductId\' is missing in type \'{ readonly
UserId: \"UserId\"; }\' but required in type \'{ readonly ProductId:
\"ProductId\";
}\'.]{.twoslash-error-box-content-message}]{.twoslash-error-box-content}
:::
::::::
:::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

The error indicates that while both types use branding, the unique
values associated with the branding fields (`"ProductId"`{dir="auto"}
and `"UserId"`{dir="auto"}) ensure they remain distinct and
non-interchangeable.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Generalizing Branded Types

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#generalizing-branded-types){.anchor-link
aria-labelledby="generalizing-branded-types"}
:::

To enhance the versatility and reusability of branded types, they can be
generalized using a standardized approach:

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1const const BrandTypeId: typeof BrandTypeId</code></pre>
</figure>
:::

[BrandTypeId]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[unique]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[symbol]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Symbol: SymbolConstructor</code></pre>
</figure>
:::
::::

[Symbol]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>SymbolConstructor.for(key: string): symbol</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a Symbol object from the global symbol registry matching the
given key if found. Otherwise, returns a new symbol with this key.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [key key to search
for.]{.twoslash-popup-docs-tag-value}
:::
::::::

[for]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"effect/Brand\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}

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
[// Create a generic Brand interface using a unique
identifier]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::::: code
[interface]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out ID extends string | symbol&gt;</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[in]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[out]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) ID in Brand&lt;in out ID extends string | symbol&gt;</code></pre>
</figure>
:::
::::

[ID]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[extends]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[symbol]{style="--0:#005CC5;--1:#79B8FF"}[\>
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const BrandTypeId: typeof BrandTypeId</code></pre>
</figure>
:::
::::

[BrandTypeId]{style="--0:#24292E;--1:#E1E4E8"}[\]]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::::::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) id</code></pre>
</figure>
:::
::::

[id]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[in]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) ID in Brand&lt;in out ID extends string | symbol&gt;</code></pre>
</figure>
:::
::::

[ID]{style="--0:#6F42C1;--1:#B392F0"}[\]]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) ID in Brand&lt;in out ID extends string | symbol&gt;</code></pre>
</figure>
:::
::::

[ID]{style="--0:#6F42C1;--1:#B392F0"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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
[// Define a ProductId type branded with a unique
identifier]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
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
<pre data-language="ts"><code>type ProductId = number &amp; Brand&lt;&quot;ProductId&quot;&gt;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out ID extends string | symbol&gt;</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"ProductId\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

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
[// Define a UserId type branded
similarly]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
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
<pre data-language="ts"><code>type UserId = number &amp; Brand&lt;&quot;UserId&quot;&gt;</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out ID extends string | symbol&gt;</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"UserId\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

This design allows any type to be branded using a unique identifier,
either a string or symbol.

Here's how you can utilize the `Brand`{dir="auto"} interface, which is
readily available from the Brand module, eliminating the need to craft
your own implementation:

**Example** (Using the Brand Interface from the Brand Module)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { Brand } from &quot;effect&quot;2
3// Define a ProductId type branded with a unique identifier4type ProductId = number &amp; Brand.Brand&lt;&quot;ProductId&quot;&gt;5
6// Define a UserId type branded similarly7type UserId = number &amp; Brand.Brand&lt;&quot;UserId&quot;&gt;</code></pre>
<div class="copy">
<div>

</div>
</div>
</figure>
:::

However, creating instances of these types directly leads to an error
because the type system expects the brand structure:

**Example** (Direct Assignment Error)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1const const BrandTypeId: typeof BrandTypeId</code></pre>
</figure>
:::

[BrandTypeId]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[unique]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[symbol]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Symbol: SymbolConstructor</code></pre>
</figure>
:::
::::

[Symbol]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>SymbolConstructor.for(key: string): symbol</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a Symbol object from the global symbol registry matching the
given key if found. Otherwise, returns a new symbol with this key.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [key key to search
for.]{.twoslash-popup-docs-tag-value}
:::
::::::

[for]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"effect/Brand\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}

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
[interface]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[in]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[out]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) K in Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::
::::

[K]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[extends]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\|]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[symbol]{style="--0:#005CC5;--1:#79B8FF"}[\>
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const BrandTypeId: typeof BrandTypeId</code></pre>
</figure>
:::
::::

[BrandTypeId]{style="--0:#24292E;--1:#E1E4E8"}[\]]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
:::
::::

::::::::: code
[ ]{.indent}[readonly]{style="--0:#BF3441;--1:#F97583"}[
\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) k</code></pre>
</figure>
:::
::::

[k]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[in]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) K in Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::
::::

[K]{style="--0:#6F42C1;--1:#B392F0"}[\]]{style="--0:#24292E;--1:#E1E4E8"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function (type parameter) K in Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::
::::

[K]{style="--0:#6F42C1;--1:#B392F0"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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
<pre data-language="ts"><code>type ProductId = number &amp; Brand&lt;&quot;ProductId&quot;&gt;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"ProductId\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

:::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[id]{style="--0:#005CC5;--1:#79B8FF"}]{.twoslash
.twoslash-error-underline}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId = number &amp; Brand&lt;&quot;ProductId&quot;&gt;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[[]{style="--0:#005CC5;--1:#79B8FF"}]{.twoslash
.twoerror}

::: {.twoslash-error-box .twoslash-error-level-error}
[]{.twoslash-error-box-icon}[[Error ts(2322) ―
]{.twoslash-error-box-content-title}[Type \'number\' is not assignable
to type \'ProductId\'. Type \'number\' is not assignable to type
\'Brand\<\"ProductId\"\>\'.]{.twoslash-error-box-content-message}]{.twoslash-error-box-content}
:::
::::::
:::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

You cannot directly assign a `number`{dir="auto"} to
`ProductId`{dir="auto"}. The Brand module provides utilities to
correctly construct values of branded types.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Constructing Branded Types

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#constructing-branded-types){.anchor-link
aria-labelledby="constructing-branded-types"}
:::

The Brand module provides two main functions for creating branded types:
`nominal`{dir="auto"} and `refined`{dir="auto"}.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### nominal

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#nominal){.anchor-link
aria-labelledby="nominal"}
:::

The `Brand.nominal`{dir="auto"} function is designed for defining
branded types that do not require runtime validations. It simply adds a
type tag to the underlying type, allowing us to distinguish between
values of the same type but with different meanings. Nominal branded
types are useful when we only want to create distinct types for clarity
and code organization purposes.

**Example** (Defining Distinct Identifiers with Nominal Branding)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Brand</code></pre>
</figure>
:::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Define UserId as a branded number]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type UserId = number &amp; Brand.Brand&lt;&quot;UserId&quot;&gt;</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A generic interface that defines a branded type.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"UserId\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

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
[// Constructor for UserId]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const UserId: Brand.Brand.Constructor&lt;UserId&gt;</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const nominal: &lt;UserId&gt;() =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor&lt;UserId&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
This function returns a `Brand.Constructor` that **does not apply any
runtime checks**, it just returns the provided value. It can be used to
create nominal types that allow distinguishing between two values of the
same type but with different meanings.

If you also want to perform some validation, see

refined

.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import * as assert from &quot;node:assert&quot;import { Brand } from &quot;effect&quot;
type UserId = number &amp; Brand.Brand&lt;&quot;UserId&quot;&gt;
const UserId = Brand.nominal&lt;UserId&gt;()
console.log(UserId(1))// 1</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[nominal]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type UserId = number &amp; Brand.Brand&lt;&quot;UserId&quot;&gt;</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[\>()]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
:::
::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getUserById: (id: UserId) =&gt; void</code></pre>
</figure>
:::
::::

[getUserById]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>id: UserId</code></pre>
</figure>
:::
::::

[id]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type UserId = number &amp; Brand.Brand&lt;&quot;UserId&quot;&gt;</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[ ]{.indent}[// Logic to retrieve user]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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
[// Define ProductId as a branded
number]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::::::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId = number &amp; Brand.Brand&lt;&quot;ProductId&quot;&gt;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A generic interface that defines a branded type.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"ProductId\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[// Constructor for ProductId]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
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
<pre data-language="ts"><code>const ProductId: Brand.Brand.Constructor&lt;ProductId&gt;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const nominal: &lt;ProductId&gt;() =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor&lt;ProductId&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
This function returns a `Brand.Constructor` that **does not apply any
runtime checks**, it just returns the provided value. It can be used to
create nominal types that allow distinguishing between two values of the
same type but with different meanings.

If you also want to perform some validation, see

refined

.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import * as assert from &quot;node:assert&quot;import { Brand } from &quot;effect&quot;
type UserId = number &amp; Brand.Brand&lt;&quot;UserId&quot;&gt;
const UserId = Brand.nominal&lt;UserId&gt;()
console.log(UserId(1))// 1</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[nominal]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId = number &amp; Brand.Brand&lt;&quot;ProductId&quot;&gt;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[\>()]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
:::
::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getProductById: (id: ProductId) =&gt; void</code></pre>
</figure>
:::
::::

[getProductById]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>id: ProductId</code></pre>
</figure>
:::
::::

[id]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId = number &amp; Brand.Brand&lt;&quot;ProductId&quot;&gt;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[ ]{.indent}[// Logic to retrieve
product]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
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

Attempting to assign a non-`ProductId`{dir="auto"} value will result in
a compile-time error:

**Example** (Type Safety with Branded Identifiers)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Brand</code></pre>
</figure>
:::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type UserId = number &amp; Brand.Brand&lt;&quot;UserId&quot;&gt;</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A generic interface that defines a branded type.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"UserId\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

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
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const UserId: Brand.Brand.Constructor&lt;UserId&gt;</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const nominal: &lt;UserId&gt;() =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor&lt;UserId&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
This function returns a `Brand.Constructor` that **does not apply any
runtime checks**, it just returns the provided value. It can be used to
create nominal types that allow distinguishing between two values of the
same type but with different meanings.

If you also want to perform some validation, see

refined

.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import * as assert from &quot;node:assert&quot;import { Brand } from &quot;effect&quot;
type UserId = number &amp; Brand.Brand&lt;&quot;UserId&quot;&gt;
const UserId = Brand.nominal&lt;UserId&gt;()
console.log(UserId(1))// 1</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[nominal]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type UserId = number &amp; Brand.Brand&lt;&quot;UserId&quot;&gt;</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[\>()]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
:::
::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getUserById: (id: UserId) =&gt; void</code></pre>
</figure>
:::
::::

[getUserById]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>id: UserId</code></pre>
</figure>
:::
::::

[id]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type UserId = number &amp; Brand.Brand&lt;&quot;UserId&quot;&gt;</code></pre>
</figure>
:::
::::

[UserId]{style="--0:#6F42C1;--1:#B392F0"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[ ]{.indent}[// Logic to retrieve user]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::::::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId = number &amp; Brand.Brand&lt;&quot;ProductId&quot;&gt;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A generic interface that defines a branded type.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"ProductId\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
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
<pre data-language="ts"><code>const ProductId: Brand.Brand.Constructor&lt;ProductId&gt;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const nominal: &lt;ProductId&gt;() =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor&lt;ProductId&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
This function returns a `Brand.Constructor` that **does not apply any
runtime checks**, it just returns the provided value. It can be used to
create nominal types that allow distinguishing between two values of the
same type but with different meanings.

If you also want to perform some validation, see

refined

.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import * as assert from &quot;node:assert&quot;import { Brand } from &quot;effect&quot;
type UserId = number &amp; Brand.Brand&lt;&quot;UserId&quot;&gt;
const UserId = Brand.nominal&lt;UserId&gt;()
console.log(UserId(1))// 1</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[nominal]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId = number &amp; Brand.Brand&lt;&quot;ProductId&quot;&gt;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[\>()]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
:::
::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
:::
::::

::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getProductById: (id: ProductId) =&gt; void</code></pre>
</figure>
:::
::::

[getProductById]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>id: ProductId</code></pre>
</figure>
:::
::::

[id]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type ProductId = number &amp; Brand.Brand&lt;&quot;ProductId&quot;&gt;</code></pre>
</figure>
:::
::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
[ ]{.indent}[// Logic to retrieve
product]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[}]{style="--0:#24292E;--1:#E1E4E8"}
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
[// Correct usage]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

:::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getProductById: (id: ProductId) =&gt; void</code></pre>
</figure>
:::
::::

[getProductById]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const ProductId: Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor(args: number) =&gt; ProductId</code></pre>
</figure>
:::

::: twoslash-popup-docs
Constructs a branded type from a value of type `A`, throwing an error if
the provided `A` is not valid.
:::
:::::

[ProductId]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[1]{style="--0:#005CC5;--1:#79B8FF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

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
[// Incorrect, will result in an error]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
:::
::::

:::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getProductById: (id: ProductId) =&gt; void</code></pre>
</figure>
:::
::::

[getProductById]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[1]{style="--0:#005CC5;--1:#79B8FF"}]{.twoslash
.twoslash-error-underline}[)]{style="--0:#24292E;--1:#E1E4E8"}[[]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoerror}

::: {.twoslash-error-box .twoslash-error-level-error}
[]{.twoslash-error-box-icon}[[Error ts(2345) ―
]{.twoslash-error-box-content-title}[Argument of type \'number\' is not
assignable to parameter of type \'ProductId\'. Type \'number\' is not
assignable to type
\'Brand\<\"ProductId\"\>\'.]{.twoslash-error-box-content-message}]{.twoslash-error-box-content}
:::
::::::
:::::::::

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
[// Also incorrect, will result in an
error]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const getProductById: (id: ProductId) =&gt; void</code></pre>
</figure>
:::
::::

[getProductById]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
.twoslash .twoslash-error-underline}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const UserId: Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor(args: number) =&gt; UserId</code></pre>
</figure>
:::

::: twoslash-popup-docs
Constructs a branded type from a value of type `A`, throwing an error if
the provided `A` is not valid.
:::
:::::

[[UserId]{style="--0:#6F42C1;--1:#B392F0"}]{.twoslash
.twoslash-error-underline}[[(]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoslash-error-underline}[[1]{style="--0:#005CC5;--1:#79B8FF"}]{.twoslash
.twoslash-error-underline}[[)]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoslash-error-underline}[)]{style="--0:#24292E;--1:#E1E4E8"}[[]{style="--0:#24292E;--1:#E1E4E8"}]{.twoslash
.twoerror}

::: {.twoslash-error-box .twoslash-error-level-error}
[]{.twoslash-error-box-icon}[[Error ts(2345) ―
]{.twoslash-error-box-content-title}[Argument of type \'UserId\' is not
assignable to parameter of type \'ProductId\'. Type \'UserId\' is not
assignable to type \'Brand\<\"ProductId\"\>\'. Types of property
\'\[BrandTypeId\]\' are incompatible. Property \'ProductId\' is missing
in type \'{ readonly UserId: \"UserId\"; }\' but required in type \'{
readonly ProductId: \"ProductId\";
}\'.]{.twoslash-error-box-content-message}]{.twoslash-error-box-content}
:::
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

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### refined

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#refined){.anchor-link
aria-labelledby="refined"}
:::

The `Brand.refined`{dir="auto"} function enables the creation of branded
types that include data validation. It requires a refinement predicate
to check the validity of input data against specific criteria.

When the input data does not meet the criteria, the function uses
`Brand.error`{dir="auto"} to generate a `BrandErrors`{dir="auto"} data
type. This provides detailed information about why the validation
failed.

**Example** (Creating a Branded Type with Validation)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Brand</code></pre>
</figure>
:::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[ }
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
[// Define a branded type \'Int\' to represent integer
values]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
:::
::::

::::::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A generic interface that defines a branded type.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"Int\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

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
[// Define the constructor using \'refined\' to enforce integer
values]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const Int: Brand.Brand.Constructor&lt;Int&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function refined&lt;Int&gt;(refinement: Predicate&lt;number&gt;, onFailure: (unbranded: number) =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.BrandErrors): Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor&lt;Int&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Returns a `Brand.Constructor` that can construct a branded type from an
unbranded value using the provided `refinement` predicate as validation
of the input data.

If you don\'t want to perform any validation but only distinguish
between two values of the same type but with different meanings, see

nominal

.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import * as assert from &quot;node:assert&quot;import { Brand } from &quot;effect&quot;
type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;
const Int = Brand.refined&lt;Int&gt;(  (n) =&gt; Number.isInteger(n),  (n) =&gt; Brand.error(`Expected ${n} to be an integer`))
console.log(Int(1))// 1
assert.throws(() =&gt; Int(1.1))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[refined]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[ ]{.indent}[// Validation to ensure the value is an
integer]{style="--0:#616972;--1:#99A0A6"}
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
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Number: NumberConstructor</code></pre>
</figure>
:::

::: twoslash-popup-docs
An object that represents a number of any kind. All JavaScript numbers
are 64-bit floating-point numbers.
:::
:::::

[Number]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>NumberConstructor.isInteger(number: unknown): boolean</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns true if the value passed is an integer, false otherwise.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [number A numeric
value.]{.twoslash-popup-docs-tag-value}
:::
::::::

[isInteger]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::: code
[ ]{.indent}[// Provide an error if validation
fails]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
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
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const error: (message: string, meta?: unknown) =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.BrandErrors</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a `BrandErrors` that contains a single `RefinementError`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[error]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`Expected
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

[n]{style="--0:#24292E;--1:#E1E4E8"}[} to be an
integer\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

**Example** (Using the `Int`{dir="auto"} Constructor)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Brand</code></pre>
</figure>
:::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A generic interface that defines a branded type.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"Int\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

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
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Int: Brand.Brand.Constructor&lt;Int&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function refined&lt;Int&gt;(refinement: Predicate&lt;number&gt;, onFailure: (unbranded: number) =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.BrandErrors): Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor&lt;Int&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Returns a `Brand.Constructor` that can construct a branded type from an
unbranded value using the provided `refinement` predicate as validation
of the input data.

If you don\'t want to perform any validation but only distinguish
between two values of the same type but with different meanings, see

nominal

.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import * as assert from &quot;node:assert&quot;import { Brand } from &quot;effect&quot;
type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;
const Int = Brand.refined&lt;Int&gt;(  (n) =&gt; Number.isInteger(n),  (n) =&gt; Brand.error(`Expected ${n} to be an integer`))
console.log(Int(1))// 1
assert.throws(() =&gt; Int(1.1))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[refined]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

::: code
[ ]{.indent}[// Check if the value is an
integer]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Number: NumberConstructor</code></pre>
</figure>
:::

::: twoslash-popup-docs
An object that represents a number of any kind. All JavaScript numbers
are 64-bit floating-point numbers.
:::
:::::

[Number]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>NumberConstructor.isInteger(number: unknown): boolean</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns true if the value passed is an integer, false otherwise.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [number A numeric
value.]{.twoslash-popup-docs-tag-value}
:::
::::::

[isInteger]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

::: code
[ ]{.indent}[// Error message if the value is not an
integer]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const error: (message: string, meta?: unknown) =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.BrandErrors</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a `BrandErrors` that contains a single `RefinementError`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[error]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`Expected
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

[n]{style="--0:#24292E;--1:#E1E4E8"}[} to be an
integer\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
:::
::::

::: code
[// Create a valid Int value]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const x: Int</code></pre>
</figure>
:::
::::

[x]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Int: Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor(args: number) =&gt; Int</code></pre>
</figure>
:::

::: twoslash-popup-docs
Constructs a branded type from a value of type `A`, throwing an error if
the provided `A` is not valid.
:::
:::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[3]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const x: Int</code></pre>
</figure>
:::
::::

[x]{style="--0:#24292E;--1:#E1E4E8"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[// Output:
3]{style="--0:#616972;--1:#99A0A6"}
::::::::::::::::
:::::::::::::::::::

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
[// Attempt to create an Int with an invalid
value]{style="--0:#616972;--1:#99A0A6"}
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
<pre data-language="ts"><code>const y: Int</code></pre>
</figure>
:::
::::

[y]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Int: Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor(args: number) =&gt; Int</code></pre>
</figure>
:::

::: twoslash-popup-docs
Constructs a branded type from a value of type `A`, throwing an error if
the provided `A` is not valid.
:::
:::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[3.14]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[// throws \[ { message: \'Expected 3.14 to be an integer\' }
\]]{style="--0:#616972;--1:#99A0A6"}
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

Attempting to assign a non-`Int`{dir="auto"} value will result in a
compile-time error:

**Example** (Compile-Time Error for Incorrect Assignments)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Brand</code></pre>
</figure>
:::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A generic interface that defines a branded type.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"Int\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

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
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Int: Brand.Brand.Constructor&lt;Int&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function refined&lt;Int&gt;(refinement: Predicate&lt;number&gt;, onFailure: (unbranded: number) =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.BrandErrors): Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor&lt;Int&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Returns a `Brand.Constructor` that can construct a branded type from an
unbranded value using the provided `refinement` predicate as validation
of the input data.

If you don\'t want to perform any validation but only distinguish
between two values of the same type but with different meanings, see

nominal

.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import * as assert from &quot;node:assert&quot;import { Brand } from &quot;effect&quot;
type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;
const Int = Brand.refined&lt;Int&gt;(  (n) =&gt; Number.isInteger(n),  (n) =&gt; Brand.error(`Expected ${n} to be an integer`))
console.log(Int(1))// 1
assert.throws(() =&gt; Int(1.1))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[refined]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Number: NumberConstructor</code></pre>
</figure>
:::

::: twoslash-popup-docs
An object that represents a number of any kind. All JavaScript numbers
are 64-bit floating-point numbers.
:::
:::::

[Number]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>NumberConstructor.isInteger(number: unknown): boolean</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns true if the value passed is an integer, false otherwise.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [number A numeric
value.]{.twoslash-popup-docs-tag-value}
:::
::::::

[isInteger]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const error: (message: string, meta?: unknown) =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.BrandErrors</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a `BrandErrors` that contains a single `RefinementError`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[error]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`Expected
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

[n]{style="--0:#24292E;--1:#E1E4E8"}[} to be an
integer\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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
[// Correct usage]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
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
<pre data-language="ts"><code>const good: Int</code></pre>
</figure>
:::
::::

[good]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Int: Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor(args: number) =&gt; Int</code></pre>
</figure>
:::

::: twoslash-popup-docs
Constructs a branded type from a value of type `A`, throwing an error if
the provided `A` is not valid.
:::
:::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[3]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
[// Incorrect, will result in an error]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

:::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[bad1]{style="--0:#005CC5;--1:#79B8FF"}]{.twoslash
.twoslash-error-underline}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[3]{style="--0:#005CC5;--1:#79B8FF"}[[]{style="--0:#005CC5;--1:#79B8FF"}]{.twoslash
.twoerror}

::: {.twoslash-error-box .twoslash-error-level-error}
[]{.twoslash-error-box-icon}[[Error ts(2322) ―
]{.twoslash-error-box-content-title}[Type \'number\' is not assignable
to type \'Int\'. Type \'number\' is not assignable to type
\'Brand\<\"Int\"\>\'.]{.twoslash-error-box-content-message}]{.twoslash-error-box-content}
:::
::::::
:::::::::

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
[// Also incorrect, will result in an
error]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

:::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[bad2]{style="--0:#005CC5;--1:#79B8FF"}]{.twoslash
.twoslash-error-underline}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[3.14]{style="--0:#005CC5;--1:#79B8FF"}[[]{style="--0:#005CC5;--1:#79B8FF"}]{.twoslash
.twoerror}

::: {.twoslash-error-box .twoslash-error-level-error}
[]{.twoslash-error-box-icon}[[Error ts(2322) ―
]{.twoslash-error-box-content-title}[Type \'number\' is not assignable
to type \'Int\'. Type \'number\' is not assignable to type
\'Brand\<\"Int\"\>\'.]{.twoslash-error-box-content-message}]{.twoslash-error-box-content}
:::
::::::
:::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Combining Branded Types

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#combining-branded-types){.anchor-link
aria-labelledby="combining-branded-types"}
:::

In some cases, you might need to combine multiple branded types. The
Brand module provides the `Brand.all`{dir="auto"} API for this purpose:

**Example** (Combining Multiple Branded Types)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Brand</code></pre>
</figure>
:::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[ }
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

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::::::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A generic interface that defines a branded type.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"Int\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

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
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#005CC5;--1:#79B8FF"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Int: Brand.Brand.Constructor&lt;Int&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function refined&lt;Int&gt;(refinement: Predicate&lt;number&gt;, onFailure: (unbranded: number) =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.BrandErrors): Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor&lt;Int&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Returns a `Brand.Constructor` that can construct a branded type from an
unbranded value using the provided `refinement` predicate as validation
of the input data.

If you don\'t want to perform any validation but only distinguish
between two values of the same type but with different meanings, see

nominal

.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import * as assert from &quot;node:assert&quot;import { Brand } from &quot;effect&quot;
type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;
const Int = Brand.refined&lt;Int&gt;(  (n) =&gt; Number.isInteger(n),  (n) =&gt; Brand.error(`Expected ${n} to be an integer`))
console.log(Int(1))// 1
assert.throws(() =&gt; Int(1.1))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[refined]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#6F42C1;--1:#B392F0"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>var Number: NumberConstructor</code></pre>
</figure>
:::

::: twoslash-popup-docs
An object that represents a number of any kind. All JavaScript numbers
are 64-bit floating-point numbers.
:::
:::::

[Number]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>NumberConstructor.isInteger(number: unknown): boolean</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns true if the value passed is an integer, false otherwise.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@param]{.twoslash-popup-docs-tag-name} ― [number A numeric
value.]{.twoslash-popup-docs-tag-value}
:::
::::::

[isInteger]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const error: (message: string, meta?: unknown) =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.BrandErrors</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a `BrandErrors` that contains a single `RefinementError`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[error]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`Expected
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

[n]{style="--0:#24292E;--1:#E1E4E8"}[} to be an
integer\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
:::
::::

::::::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Positive = number &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::
::::

[Positive]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[number]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[&]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>interface Brand&lt;in out K extends string | symbol&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
A generic interface that defines a branded type.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[\"Positive\"]{style="--0:#032F62;--1:#9ECBFF"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
:::
::::

::: code
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
12
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
<pre data-language="ts"><code>const Positive: Brand.Brand.Constructor&lt;Positive&gt;</code></pre>
</figure>
:::
::::

[Positive]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>function refined&lt;Positive&gt;(refinement: Predicate&lt;number&gt;, onFailure: (unbranded: number) =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.BrandErrors): Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor&lt;Positive&gt; (+1 overload)</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Returns a `Brand.Constructor` that can construct a branded type from an
unbranded value using the provided `refinement` predicate as validation
of the input data.

If you don\'t want to perform any validation but only distinguish
between two values of the same type but with different meanings, see

nominal

.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import * as assert from &quot;node:assert&quot;import { Brand } from &quot;effect&quot;
type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;
const Int = Brand.refined&lt;Int&gt;(  (n) =&gt; Number.isInteger(n),  (n) =&gt; Brand.error(`Expected ${n} to be an integer`))
console.log(Int(1))// 1
assert.throws(() =&gt; Int(1.1))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[refined]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Positive = number &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::
::::

[Positive]{style="--0:#6F42C1;--1:#B392F0"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>n: number</code></pre>
</figure>
:::
::::

[n]{style="--0:#24292E;--1:#E1E4E8"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[0]{style="--0:#005CC5;--1:#79B8FF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
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
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const error: (message: string, meta?: unknown) =&gt; Brand.Brand&lt;in out K extends string | symbol&gt;.BrandErrors</code></pre>
</figure>
:::

::: twoslash-popup-docs
Returns a `BrandErrors` that contains a single `RefinementError`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[error]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\`Expected
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

[n]{style="--0:#24292E;--1:#E1E4E8"}[} to be
positive\`]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[// Combine the Int and Positive
constructors]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[// into a new branded constructor
PositiveInt]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
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
<pre data-language="ts"><code>const PositiveInt: Brand.Brand.Constructor&lt;number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;&gt;</code></pre>
</figure>
:::
::::

[PositiveInt]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const all: &lt;[Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor&lt;Int&gt;, Brand.Brand.Constructor&lt;Positive&gt;]&gt;(brands_0: Brand.Brand.Constructor&lt;Int&gt;, brands_1: Brand.Brand.Constructor&lt;Positive&gt;) =&gt; Brand.Brand.Constructor&lt;number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Combines two or more brands together to form a single branded type. This
API is useful when you want to validate that the input data passes
multiple brand validators.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import * as assert from &quot;node:assert&quot;import { Brand } from &quot;effect&quot;
type Int = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt;const Int = Brand.refined&lt;Int&gt;(  (n) =&gt; Number.isInteger(n),  (n) =&gt; Brand.error(`Expected ${n} to be an integer`))type Positive = number &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;const Positive = Brand.refined&lt;Positive&gt;(  (n) =&gt; n &gt; 0,  (n) =&gt; Brand.error(`Expected ${n} to be positive`))
const PositiveInt = Brand.all(Int, Positive)
console.log(PositiveInt(1))// 1
assert.throws(() =&gt; PositiveInt(1.1))</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[all]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Int: Brand.Brand.Constructor&lt;Int&gt;</code></pre>
</figure>
:::
::::

[Int]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Positive: Brand.Brand.Constructor&lt;Positive&gt;</code></pre>
</figure>
:::
::::

[Positive]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

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
[// Extract the branded type from the PositiveInt
constructor]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
:::
::::

::::::::::::::::: code
[type]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type PositiveInt = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::
::::

[PositiveInt]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Brand</code></pre>
</figure>
:::
::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>namespace Brand</code></pre>
</figure>
:::

::: twoslash-popup-docs
A generic interface that defines a branded type.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[Brand]{style="--0:#6F42C1;--1:#B392F0"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Brand&lt;in out K extends string | symbol&gt;.FromConstructor&lt;A&gt; = A extends Brand.Brand.Constructor&lt;infer B extends Brand.Brand&lt;any&gt;&gt; ? B : never</code></pre>
</figure>
:::

::: twoslash-popup-docs
A utility type to extract a branded type from a `Brand.Constructor`.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[FromConstructor]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[typeof]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const PositiveInt: Brand.Brand.Constructor&lt;number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;&gt;</code></pre>
</figure>
:::
::::

[PositiveInt]{style="--0:#24292E;--1:#E1E4E8"}[\>]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::
::::::::::::::::::::

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
[// Usage example]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
:::
::::

::: code
[// Valid positive integer]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
27
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
<pre data-language="ts"><code>const good: number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::
::::

[good]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type PositiveInt = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::
::::

[PositiveInt]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const PositiveInt: Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor(args: number) =&gt; number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Constructs a branded type from a value of type `A`, throwing an error if
the provided `A` is not valid.
:::
:::::

[PositiveInt]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[10]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::: code
[// throws \[ { message: \'Expected -5 to be positive\' }
\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
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
<pre data-language="ts"><code>const bad1: number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::
::::

[bad1]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type PositiveInt = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::
::::

[PositiveInt]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const PositiveInt: Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor(args: number) =&gt; number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Constructs a branded type from a value of type `A`, throwing an error if
the provided `A` is not valid.
:::
:::::

[PositiveInt]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[-]{style="--0:#BF3441;--1:#F97583"}[5]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
:::
::::

::: code
[// throws \[ { message: \'Expected 3.14 to be an integer\' }
\]]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
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
<pre data-language="ts"><code>const bad2: number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::
::::

[bad2]{style="--0:#005CC5;--1:#79B8FF"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type PositiveInt = number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::
::::

[PositiveInt]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const PositiveInt: Brand.Brand&lt;in out K extends string | symbol&gt;.Constructor(args: number) =&gt; number &amp; Brand.Brand&lt;&quot;Int&quot;&gt; &amp; Brand.Brand&lt;&quot;Positive&quot;&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Constructs a branded type from a value of type `A`, throwing an error if
the provided `A` is not valid.
:::
:::::

[PositiveInt]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[3.14]{style="--0:#005CC5;--1:#79B8FF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/code-style/branded-types.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Dual APIs]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../dual/index.html){.astro-u5aomj4k rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[Pattern Matching]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../pattern-matching/index.html){.astro-u5aomj4k
rel="next"}
:::
:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
