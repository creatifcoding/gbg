:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Tool Use {#_top .astro-np5lzwrf}
:::
::::

:::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::: sl-markdown-content
Language models are great at generating text, but often we need them to
take **real-world actions**, such as querying an API, accessing a
database, or calling a service. Most LLM providers support this through
**tool use** (also known as *function calling*), where you expose
specific operations in your application that the model can invoke.

Based on the input it receives, a model may choose to **invoke (or
call)** one or more tools to augment its response. Your application then
runs the corresponding logic for the tool using the parameters provided
by the model. You then return the result to the model, allowing it to
include the output in its final response.

The `Toolkit`{dir="auto"} simplifies tool integration by offering a
structured, type-safe approach to defining tools. It takes care of all
the wiring between the model and your application - all you have to do
is define the tool and implement its behavior.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Defining a Tool

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#defining-a-tool){.anchor-link
aria-labelledby="defining-a-tool"}
:::

Let's walk through a complete example of how to define, implement, and
use a tool that fetches a dad joke from the
[icanhazdadjoke.com](https://icanhazdadjoke.com) API.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### 1. Define the Tool {#1-define-the-tool}

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#1-define-the-tool){.anchor-link
aria-labelledby="1-define-the-tool"}
:::

We start by defining a tool that the language model will have access to
using the `Tool.make`{dir="auto"} constructor.

This constructor accepts several parameters that allow us to fully
describe the tool to the language model:

- `description`{dir="auto"}: Provides an optional description of the
  tool
- `success`{dir="auto"}: The type of value the tool will return if it
  succeeds
- `failure`{dir="auto"}: The type of value the tool will return if it
  fails
- `parameters`{dir="auto"}: The parameters that the tool should be
  called with

**Example** (Defining a Tool)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Tool</code></pre>
</figure>
:::
::::::

[Tool]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/ai\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::::
::::::::

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
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::: code
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>const GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::
::::

[GetDadJoke]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Tool</code></pre>
</figure>
:::
::::

[Tool]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;&quot;GetDadJoke&quot;, {    searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;}, typeof Schema.String, typeof Schema.Never, []&gt;(name: &quot;GetDadJoke&quot;, options?: {    readonly description?: string | undefined;    readonly parameters?: {        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    } | undefined;    readonly success?: typeof Schema.String | undefined;    readonly failure?: typeof Schema.Never | undefined;    readonly dependencies?: [] | undefined;} | undefined) =&gt; Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a user-defined tool with the specified name and configuration.

This is the primary constructor for creating custom tools that AI models
can call. The tool definition includes parameter validation,
success/failure schemas, and optional service dependencies.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Tool } from &quot;@effect/ai&quot;import { Schema } from &quot;effect&quot;
// Simple tool with no parametersconst GetCurrentTime = Tool.make(&quot;GetCurrentTime&quot;, {  description: &quot;Returns the current timestamp&quot;,  success: Schema.Number})</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"GetDadJoke\"]{style="--0:#032F62;--1:#9ECBFF"}[,
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
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
<pre data-language="ts"><code>description?: string | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
An optional description explaining what the tool does.
:::
:::::

[description]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"Get a hilarious dad joke from the
ICanHazDadJoke
API\"]{style="--0:#032F62;--1:#9ECBFF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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
<pre data-language="ts"><code>success?: typeof Schema.String | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema for successful tool execution results.
:::
:::::

[success]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>failure?: typeof Schema.Never | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema for tool execution failures.
:::
:::::

[failure]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Never</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Never]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>parameters?: {    searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;} | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema defining the parameters this tool accepts.
:::
:::::

[parameters]{style="--0:#24292E;--1:#E1E4E8"}[:
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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
<pre data-language="ts"><code>searchTerm: Schema.SchemaClass&lt;string, string, never&gt;</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Annotable&lt;SchemaClass&lt;string, string, never&gt;, string, string, never&gt;.annotations(annotations: Schema.Annotations.GenericSchema&lt;string&gt;): Schema.SchemaClass&lt;string, string, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Merges a set of new annotations with existing ones, potentially
overwriting any duplicates.
:::
:::::

[annotations]{style="--0:#6F42C1;--1:#B392F0"}[({]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
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
<pre data-language="ts"><code>Annotations.Doc&lt;string&gt;.description?: string</code></pre>
</figure>
:::
::::

[description]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"The search term to use to find dad
jokes\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

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
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}]{style="--0:#24292E;--1:#E1E4E8"}
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

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

Based on the above, a request to call the `GetDadJoke`{dir="auto"} tool:

- Takes a single `searchTerm`{dir="auto"} parameter
- Will return a string if it succeeds (i.e. the joke)
- Does not have any expected failure scenarios

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### 2. Create a Toolkit {#2-create-a-toolkit}

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#2-create-a-toolkit){.anchor-link
aria-labelledby="2-create-a-toolkit"}
:::

Once we have a tool request defined, we can create a
`Toolkit`{dir="auto"}, which is a collection of tools that the model
will have access to.

**Example** (Creating a `Toolkit`{dir="auto"})

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Tool</code></pre>
</figure>
:::

[Tool]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Toolkit</code></pre>
</figure>
:::
::::

[Toolkit]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/ai\"]{style="--0:#032F62;--1:#9ECBFF"}

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
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::: code
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>const GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::
::::

[GetDadJoke]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Tool</code></pre>
</figure>
:::
::::

[Tool]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;&quot;GetDadJoke&quot;, {    searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;}, typeof Schema.String, typeof Schema.Never, []&gt;(name: &quot;GetDadJoke&quot;, options?: {    readonly description?: string | undefined;    readonly parameters?: {        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    } | undefined;    readonly success?: typeof Schema.String | undefined;    readonly failure?: typeof Schema.Never | undefined;    readonly dependencies?: [] | undefined;} | undefined) =&gt; Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a user-defined tool with the specified name and configuration.

This is the primary constructor for creating custom tools that AI models
can call. The tool definition includes parameter validation,
success/failure schemas, and optional service dependencies.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Tool } from &quot;@effect/ai&quot;import { Schema } from &quot;effect&quot;
// Simple tool with no parametersconst GetCurrentTime = Tool.make(&quot;GetCurrentTime&quot;, {  description: &quot;Returns the current timestamp&quot;,  success: Schema.Number})</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"GetDadJoke\"]{style="--0:#032F62;--1:#9ECBFF"}[,
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
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
<pre data-language="ts"><code>description?: string | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
An optional description explaining what the tool does.
:::
:::::

[description]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"Get a hilarious dad joke from the
ICanHazDadJoke
API\"]{style="--0:#032F62;--1:#9ECBFF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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
<pre data-language="ts"><code>success?: typeof Schema.String | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema for successful tool execution results.
:::
:::::

[success]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>failure?: typeof Schema.Never | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema for tool execution failures.
:::
:::::

[failure]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Never</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Never]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>parameters?: {    searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;} | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema defining the parameters this tool accepts.
:::
:::::

[parameters]{style="--0:#24292E;--1:#E1E4E8"}[:
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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
<pre data-language="ts"><code>searchTerm: Schema.SchemaClass&lt;string, string, never&gt;</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Annotable&lt;SchemaClass&lt;string, string, never&gt;, string, string, never&gt;.annotations(annotations: Schema.Annotations.GenericSchema&lt;string&gt;): Schema.SchemaClass&lt;string, string, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Merges a set of new annotations with existing ones, potentially
overwriting any duplicates.
:::
:::::

[annotations]{style="--0:#6F42C1;--1:#B392F0"}[({]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
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
<pre data-language="ts"><code>Annotations.Doc&lt;string&gt;.description?: string</code></pre>
</figure>
:::
::::

[description]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"The search term to use to find dad
jokes\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

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
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}]{style="--0:#24292E;--1:#E1E4E8"}
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
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
<pre data-language="ts"><code>const DadJokeTools: Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::
::::

[DadJokeTools]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Toolkit</code></pre>
</figure>
:::
::::

[Toolkit]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;[Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;]&gt;(tools_0: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;) =&gt; Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a new toolkit from the specified tools.

This is the primary constructor for creating toolkits. It accepts
multiple tools and organizes them into a toolkit that can be provided to
AI language models. Tools can be either Tool instances or TaggedRequest
schemas.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Toolkit, Tool } from &quot;@effect/ai&quot;import { Schema } from &quot;effect&quot;
const GetCurrentTime = Tool.make(&quot;GetCurrentTime&quot;, {  description: &quot;Get the current timestamp&quot;,  success: Schema.Number})
const GetWeather = Tool.make(&quot;get_weather&quot;, {  description: &quot;Get weather information&quot;,  parameters: { location: Schema.String },  success: Schema.Struct({    temperature: Schema.Number,    condition: Schema.String  })})
const toolkit = Toolkit.make(GetCurrentTime, GetWeather)</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::
::::

[GetDadJoke]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::: copy
<div>

</div>
::::

:::: open-in-playground
<div>

</div>
::::

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### 3. Implement the Logic {#3-implement-the-logic}

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#3-implement-the-logic){.anchor-link
aria-labelledby="3-implement-the-logic"}
:::

The `.toLayer(...)`{dir="auto"} method on a `Toolkit`{dir="auto"} allows
you to define the handlers for each tool in the toolkit. Because
`.toLayer(...)`{dir="auto"} takes an `Effect`{dir="auto"}, we can access
services from our application to implement the tool call handlers.

**Example** (Implementing a `Toolkit`{dir="auto"})

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import Tool</code></pre>
</figure>
:::

[Tool]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Toolkit</code></pre>
</figure>
:::
::::

[Toolkit]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/ai\"]{style="--0:#032F62;--1:#9ECBFF"}

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

::: code
[import]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
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
<pre data-language="ts"><code>import HttpClient</code></pre>
</figure>
:::
::::

[HttpClient]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

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
<pre data-language="ts"><code>import HttpClientRequest</code></pre>
</figure>
:::
::::

[HttpClientRequest]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

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
<pre data-language="ts"><code>import HttpClientResponse</code></pre>
</figure>
:::
::::

[HttpClientResponse]{style="--0:#24292E;--1:#E1E4E8"}
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
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/platform\"]{style="--0:#032F62;--1:#9ECBFF"}
:::
::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>import NodeHttpClient</code></pre>
</figure>
:::
::::

[NodeHttpClient]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/platform-node\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
:::
::::

:::::::::: code
[import]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Array</code></pre>
</figure>
:::
::::

[Array]{style="--0:#24292E;--1:#E1E4E8"}[,
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
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}
::::::::::
:::::::::::::

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
::: ln
:::
::::

::: code
[]{.expand}[]{.collapse}[37 collapsed lines]{.text}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
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
<pre data-language="ts"><code>class DadJoke</code></pre>
</figure>
:::
::::

[DadJoke]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[extends]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Class: &lt;DadJoke&gt;(identifier: string) =&gt; &lt;Fields&gt;(fieldsOr: Fields | HasFields&lt;Fields&gt;, annotations?: ClassAnnotations&lt;DadJoke, { [K in keyof Schema.Struct&lt;Fields extends Schema.Struct.Fields&gt;.Type&lt;Fields&gt;]: Schema.Struct.Type&lt;Fields&gt;[K]; }&gt; | undefined) =&gt; Schema.Class&lt;DadJoke, Fields, Schema.Struct.Encoded&lt;Fields&gt;, Schema.Schema&lt;in out A, in out I = A, out R = never&gt;.Context&lt;Fields[keyof Fields]&gt;, Schema.Struct.Constructor&lt;...&gt;, {}, {}&gt;</code></pre>
</figure>
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Schema } from &quot;effect&quot;
class MyClass extends Schema.Class&lt;MyClass&gt;(&quot;MyClass&quot;)({ someField: Schema.String}) { someMethod() {   return this.someField + &quot;bar&quot; }}</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
::::
::::::

[Class]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class DadJoke</code></pre>
</figure>
:::
::::

[DadJoke]{style="--0:#6F42C1;--1:#B392F0"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}[\"DadJoke\"]{style="--0:#032F62;--1:#9ECBFF"}[)({]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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
<pre data-language="ts"><code>id: typeof Schema.String</code></pre>
</figure>
:::
::::

[id]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
<pre data-language="ts"><code>joke: typeof Schema.String</code></pre>
</figure>
:::
::::

[joke]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
13
:::
::::

::: code
[}) {}]{style="--0:#24292E;--1:#E1E4E8"}
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
[class]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class SearchResponse</code></pre>
</figure>
:::
::::

[SearchResponse]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[extends]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Class: &lt;SearchResponse&gt;(identifier: string) =&gt; &lt;Fields&gt;(fieldsOr: Fields | HasFields&lt;Fields&gt;, annotations?: ClassAnnotations&lt;SearchResponse, { [K in keyof Schema.Struct&lt;Fields extends Schema.Struct.Fields&gt;.Type&lt;Fields&gt;]: Schema.Struct.Type&lt;Fields&gt;[K]; }&gt; | undefined) =&gt; Schema.Class&lt;SearchResponse, Fields, Schema.Struct.Encoded&lt;Fields&gt;, Schema.Schema&lt;in out A, in out I = A, out R = never&gt;.Context&lt;Fields[keyof Fields]&gt;, Schema.Struct.Constructor&lt;...&gt;, {}, {}&gt;</code></pre>
</figure>
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Schema } from &quot;effect&quot;
class MyClass extends Schema.Class&lt;MyClass&gt;(&quot;MyClass&quot;)({ someField: Schema.String}) { someMethod() {   return this.someField + &quot;bar&quot; }}</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
::::
::::::

[Class]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class SearchResponse</code></pre>
</figure>
:::
::::

[SearchResponse]{style="--0:#6F42C1;--1:#B392F0"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}[\"SearchResponse\"]{style="--0:#032F62;--1:#9ECBFF"}[)({]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
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
<pre data-language="ts"><code>results: Schema.Array$&lt;typeof DadJoke&gt;</code></pre>
</figure>
:::
::::

[results]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Array&lt;typeof DadJoke&gt;(value: typeof DadJoke): Schema.Array$&lt;typeof DadJoke&gt;export Array</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Array]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class DadJoke</code></pre>
</figure>
:::
::::

[DadJoke]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
:::
::::

::: code
[}) {}]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

::::::::::::::: code
[class]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ICanHazDadJoke</code></pre>
</figure>
:::
::::

[ICanHazDadJoke]{style="--0:#6F42C1;--1:#B392F0"}[
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
<pre data-language="ts"><code>const Service: &lt;ICanHazDadJoke&gt;() =&gt; {    &lt;Key, Make&gt;(key: Key, make: Make): Effect.Service.Class&lt;ICanHazDadJoke, Key, Make&gt;;    &lt;Key, Make&gt;(key: Key, make: Make): Effect.Service.Class&lt;ICanHazDadJoke, Key, Make&gt;;    &lt;Key, Make&gt;(key: Key, make: Make): Effect.Service.Class&lt;ICanHazDadJoke, Key, Make&gt;;    &lt;Key, Make&gt;(key: Key, make: Make): Effect.Service.Class&lt;ICanHazDadJoke, Key, Make&gt;;    &lt;Key, Make&gt;(key: Key, make: Make): Effect.Service.Class&lt;...&gt;;}</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Simplifies the creation and management of services in Effect by defining
both a `Tag` and a `Layer`.

**Details**

This function allows you to streamline the creation of services by
combining the definition of a `Context.Tag` and a `Layer` in a single
step. It supports various ways of providing the service implementation:

- Using an `effect` to define the service dynamically.
- Using `sync` or `succeed` to define the service statically.
- Using `scoped` to create services with lifecycle management.

It also allows you to specify dependencies for the service, which will
be provided automatically when the service is used. Accessors can be
optionally generated for the service, making it more convenient to use.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &#39;effect&#39;;
class Prefix extends Effect.Service&lt;Prefix&gt;()(&quot;Prefix&quot;, { sync: () =&gt; ({ prefix: &quot;PRE&quot; })}) {}
class Logger extends Effect.Service&lt;Logger&gt;()(&quot;Logger&quot;, { accessors: true, effect: Effect.gen(function* () {   const { prefix } = yield* Prefix   return {     info: (message: string) =&gt;       Effect.sync(() =&gt; {         console.log(`[${prefix}][${message}]`)       })   } }), dependencies: [Prefix.Default]}) {}</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.9.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[Service]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ICanHazDadJoke</code></pre>
</figure>
:::
::::

[ICanHazDadJoke]{style="--0:#6F42C1;--1:#B392F0"}[\>()(]{style="--0:#24292E;--1:#E1E4E8"}[\"ICanHazDadJoke\"]{style="--0:#032F62;--1:#9ECBFF"}[,
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
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
<pre data-language="ts"><code>dependencies: readonly [Layer&lt;HttpClient.HttpClient, never, never&gt;]</code></pre>
</figure>
:::
::::

[dependencies]{style="--0:#24292E;--1:#E1E4E8"}[:
\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeHttpClient</code></pre>
</figure>
:::
::::

[NodeHttpClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const layerUndici: Layer&lt;HttpClient.HttpClient, never, never&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[layerUndici]{style="--0:#24292E;--1:#E1E4E8"}[\],]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>effect: Effect.Effect&lt;{    readonly search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never, HttpClient.HttpClient&gt;</code></pre>
</figure>
:::
::::

[effect]{style="--0:#24292E;--1:#E1E4E8"}[:
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Tag&lt;HttpClient.HttpClient, HttpClient.HttpClient&gt;&gt;, {    readonly search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;;}&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Tag&lt;HttpClient.HttpClient, HttpClient.HttpClient&gt;&gt;, {    readonly search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never&gt;) =&gt; Effect.Effect&lt;{    readonly search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never, HttpClient.HttpClient&gt; (+1 overload)</code></pre>
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

[gen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[function\*]{style="--0:#BF3441;--1:#F97583"}[()
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
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
<pre data-language="ts"><code>const httpClient: HttpClient.HttpClient</code></pre>
</figure>
:::
::::

[httpClient]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import HttpClient</code></pre>
</figure>
:::
::::

[HttpClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const HttpClient: Tag&lt;HttpClient.HttpClient, HttpClient.HttpClient&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[HttpClient]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
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
<pre data-language="ts"><code>const httpClientOk: HttpClient.HttpClient.With&lt;HttpClientError, never&gt;</code></pre>
</figure>
:::
::::

[httpClientOk]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const httpClient: HttpClient.HttpClient</code></pre>
</figure>
:::
::::

[httpClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;HttpClient.HttpClient, HttpClient.HttpClient.With&lt;HttpClientError, never&gt;, HttpClient.HttpClient.With&lt;HttpClientError, never&gt;&gt;(this: HttpClient.HttpClient, ab: (_: HttpClient.HttpClient) =&gt; HttpClient.HttpClient.With&lt;HttpClientError, never&gt;, bc: (_: HttpClient.HttpClient.With&lt;HttpClientError, never&gt;) =&gt; HttpClient.HttpClient.With&lt;HttpClientError, never&gt;): HttpClient.HttpClient.With&lt;...&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
24
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
<pre data-language="ts"><code>import HttpClient</code></pre>
</figure>
:::
::::

[HttpClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const filterStatusOk: &lt;E, R&gt;(self: HttpClient.HttpClient.With&lt;E, R&gt;) =&gt; HttpClient.HttpClient.With&lt;E | ResponseError, R&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Filters responses that return a 2xx status code.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[filterStatusOk]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
:::
::::

:::::::::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import HttpClient</code></pre>
</figure>
:::
::::

[HttpClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const mapRequest: (f: (a: HttpClientRequest.HttpClientRequest) =&gt; HttpClientRequest.HttpClientRequest) =&gt; &lt;E, R&gt;(self: HttpClient.HttpClient.With&lt;E, R&gt;) =&gt; HttpClient.HttpClient.With&lt;E, R&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Appends a transformation of the request object before sending it.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[mapRequest]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import HttpClientRequest</code></pre>
</figure>
:::
::::

[HttpClientRequest]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const prependUrl: (path: string) =&gt; (self: HttpClientRequest.HttpClientRequest) =&gt; HttpClientRequest.HttpClientRequest (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[prependUrl]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"https://icanhazdadjoke.com\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
26
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
27
:::
::::

::: code
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
28
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
<pre data-language="ts"><code>const search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[search]{style="--0:#005CC5;--1:#79B8FF"}[
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

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fn: (name: string, options?: SpanOptions) =&gt; Effect.fn.Gen &amp; Effect.fn.NonGen (+20 overloads)</code></pre>
</figure>
:::
::::

[fn]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"ICanHazDadJoke.search\"]{style="--0:#032F62;--1:#9ECBFF"}[)(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
:::
::::

::::: code
[
]{.indent}[function\*]{style="--0:#BF3441;--1:#F97583"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>searchTerm: string</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[)
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
:::
::::

::::::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const httpClientOk: HttpClient.HttpClient.With&lt;HttpClientError, never&gt;</code></pre>
</figure>
:::
::::

[httpClientOk]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>HttpClient.With&lt;HttpClientError, never&gt;.get: (url: string | URL, options?: HttpClientRequest.Options.NoBody) =&gt; Effect.Effect&lt;HttpClientResponse.HttpClientResponse, HttpClientError, never&gt;</code></pre>
</figure>
:::
::::

[get]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"/search\"]{style="--0:#032F62;--1:#9ECBFF"}[,
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
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
<pre data-language="ts"><code>acceptJson?: boolean | undefined</code></pre>
</figure>
:::
::::

[acceptJson]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[true]{style="--0:#005CC5;--1:#79B8FF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
32
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
<pre data-language="ts"><code>urlParams?: Input | undefined</code></pre>
</figure>
:::
::::

[urlParams]{style="--0:#24292E;--1:#E1E4E8"}[: {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>searchTerm: string</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#24292E;--1:#E1E4E8"}[
}]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
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
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;HttpClientResponse.HttpClientResponse, HttpClientError, never&gt;, Effect.Effect&lt;SearchResponse, HttpClientError | ParseError, never&gt;, Effect.Effect&lt;DadJoke, HttpClientError | ParseError | NoSuchElementException, never&gt;, Effect.Effect&lt;string, HttpClientError | ParseError | NoSuchElementException, never&gt;, Effect.Effect&lt;...&gt;&gt;(this: Effect.Effect&lt;...&gt;, ab: (_: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;, bc: (_: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;, cd: (_: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;, de: (_: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;): Effect.Effect&lt;...&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
:::
::::

::::::::::::::::::: code
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
<pre data-language="ts"><code>const flatMap: &lt;HttpClientResponse.HttpClientResponse, SearchResponse, ResponseError | ParseError, never&gt;(f: (a: HttpClientResponse.HttpClientResponse) =&gt; Effect.Effect&lt;SearchResponse, ResponseError | ParseError, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;HttpClientResponse.HttpClientResponse, E, R&gt;) =&gt; Effect.Effect&lt;SearchResponse, ResponseError | ParseError | E, R&gt; (+1 overload)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains effects to produce new `Effect` instances, useful for combining
operations that depend on previous results.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const flatMappedEffect = pipe(myEffect, Effect.flatMap(transformation))// orconst flatMappedEffect = Effect.flatMap(myEffect, transformation)// orconst flatMappedEffect = myEffect.pipe(Effect.flatMap(transformation))</code></pre>
</figure>
:::

**Details**

`flatMap` lets you sequence effects so that the result of one effect can
be used in the next step. It is similar to `flatMap` used with arrays
but works specifically with `Effect` instances, allowing you to avoid
deeply nested effect structures.

Since effects are immutable, `flatMap` always returns a new effect
instead of changing the original one.

**When to Use**

Use `flatMap` when you need to chain multiple effects, ensuring that
each step produces a new `Effect` while flattening any nested effects
that may occur.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Chaining the fetch and discount application using `flatMap`const finalAmount = pipe(  fetchTransactionAmount,  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(finalAmount).then(console.log)// Output: 95</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [tap for a version that ignores
the result of the effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[flatMap]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import HttpClientResponse</code></pre>
</figure>
:::
::::

[HttpClientResponse]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>schemaBodyJson&lt;SearchResponse, {    readonly results: readonly {        readonly id: string;        readonly joke: string;    }[];}, never&gt;(schema: Schema.Schema&lt;SearchResponse, {    readonly results: readonly {        readonly id: string;        readonly joke: string;    }[];}, never&gt;, options?: ParseOptions | undefined): &lt;E&gt;(self: HttpIncomingMessage&lt;E&gt;) =&gt; Effect.Effect&lt;SearchResponse, ParseError | E, never&gt;export schemaBodyJson</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[schemaBodyJson]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class SearchResponse</code></pre>
</figure>
:::
::::

[SearchResponse]{style="--0:#24292E;--1:#E1E4E8"}[)),]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::
::::::::::::::::::::::

::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

:::::::::::::::::::::: code
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
<pre data-language="ts"><code>const flatMap: &lt;SearchResponse, DadJoke, NoSuchElementException, never&gt;(f: (a: SearchResponse) =&gt; Effect.Effect&lt;DadJoke, NoSuchElementException, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;SearchResponse, E, R&gt;) =&gt; Effect.Effect&lt;DadJoke, NoSuchElementException | E, R&gt; (+1 overload)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains effects to produce new `Effect` instances, useful for combining
operations that depend on previous results.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const flatMappedEffect = pipe(myEffect, Effect.flatMap(transformation))// orconst flatMappedEffect = Effect.flatMap(myEffect, transformation)// orconst flatMappedEffect = myEffect.pipe(Effect.flatMap(transformation))</code></pre>
</figure>
:::

**Details**

`flatMap` lets you sequence effects so that the result of one effect can
be used in the next step. It is similar to `flatMap` used with arrays
but works specifically with `Effect` instances, allowing you to avoid
deeply nested effect structures.

Since effects are immutable, `flatMap` always returns a new effect
instead of changing the original one.

**When to Use**

Use `flatMap` when you need to chain multiple effects, ensuring that
each step produces a new `Effect` while flattening any nested effects
that may occur.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Chaining the fetch and discount application using `flatMap`const finalAmount = pipe(  fetchTransactionAmount,  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(finalAmount).then(console.log)// Output: 95</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [tap for a version that ignores
the result of the effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[flatMap]{style="--0:#6F42C1;--1:#B392F0"}[(({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>results: readonly DadJoke[]</code></pre>
</figure>
:::
::::

[results]{style="--0:#AE4B07;--1:#FFAB70"}[ })
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Array</code></pre>
</figure>
:::
::::

[Array]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const head: &lt;DadJoke&gt;(self: readonly DadJoke[]) =&gt; Option&lt;DadJoke&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Get the first element of a `ReadonlyArray`, or `None` if the
`ReadonlyArray` is empty.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[head]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>results: readonly DadJoke[]</code></pre>
</figure>
:::
::::

[results]{style="--0:#24292E;--1:#E1E4E8"}[)),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::
:::::::::::::::::::::::::

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const map: &lt;DadJoke, string&gt;(f: (a: DadJoke) =&gt; string) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;DadJoke, E, R&gt;) =&gt; Effect.Effect&lt;string, E, R&gt; (+1 overload)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Transforms the value inside an effect by applying a function to it.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const mappedEffect = pipe(myEffect, Effect.map(transformation))// orconst mappedEffect = Effect.map(myEffect, transformation)// orconst mappedEffect = myEffect.pipe(Effect.map(transformation))</code></pre>
</figure>
:::

**Details**

`map` takes a function and applies it to the value contained within an
effect, creating a new effect with the transformed value.

It\'s important to note that effects are immutable, meaning that the
original effect is not modified. Instead, a new effect is returned with
the updated value.

**Example** (Adding a Service Charge)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
const addServiceCharge = (amount: number) =&gt; amount + 1
const fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
const finalAmount = pipe(  fetchTransactionAmount,  Effect.map(addServiceCharge))
Effect.runPromise(finalAmount).then(console.log)// Output: 101</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [mapError for a version that
operates on the error channel.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [mapBoth for a version that
operates on both channels.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [flatMap or andThen for a
version that can return a new effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[map]{style="--0:#6F42C1;--1:#B392F0"}[((]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>joke: DadJoke</code></pre>
</figure>
:::
::::

[joke]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>joke: DadJoke</code></pre>
</figure>
:::
::::

[joke]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>joke: string</code></pre>
</figure>
:::
::::

[joke]{style="--0:#24292E;--1:#E1E4E8"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
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
<pre data-language="ts"><code>const orDie: &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, never, R&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Converts an effect\'s failure into a fiber termination, removing the
error from the effect\'s type.

**Details**

The `orDie` function is used when you encounter errors that you do not
want to handle or recover from. It removes the error type from the
effect and ensures that any failure will terminate the fiber. This is
useful for propagating failures as defects, signaling that they should
not be handled within the effect.

\**When to Use*

Use `orDie` when failures should be treated as unrecoverable defects and
no error handling is required.

**Example** (Propagating an Error as a Defect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const divide = (a: number, b: number) =&gt;  b === 0    ? Effect.fail(new Error(&quot;Cannot divide by zero&quot;))    : Effect.succeed(a / b)
//      ┌─── Effect&lt;number, never, never&gt;//      ▼const program = Effect.orDie(divide(1, 0))
Effect.runPromise(program).catch(console.error)// Output:// (FiberFailure) Error: Cannot divide by zero//   ...stack trace...</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [orDieWith if you need to
customize the error.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[orDie]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
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
39
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
40
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
41
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
42
:::
::::

::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
43
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
<pre data-language="ts"><code>search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[search]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
44
:::
::::

::::: code
[[ ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}
]{style="--0:#24292E;--1:#E1E4E8"}[as]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#BF3441;--1:#F97583"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type const = {    readonly search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;;}</code></pre>
</figure>
:::
::::

[const]{style="--0:#BF3441;--1:#F97583"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
45
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
46
:::
::::

::: code
[}) {}]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
47
:::
::::

::: code
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
48
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
<pre data-language="ts"><code>const GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::
::::

[GetDadJoke]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Tool</code></pre>
</figure>
:::
::::

[Tool]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;&quot;GetDadJoke&quot;, {    searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;}, typeof Schema.String, typeof Schema.Never, []&gt;(name: &quot;GetDadJoke&quot;, options?: {    readonly description?: string | undefined;    readonly parameters?: {        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    } | undefined;    readonly success?: typeof Schema.String | undefined;    readonly failure?: typeof Schema.Never | undefined;    readonly dependencies?: [] | undefined;} | undefined) =&gt; Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a user-defined tool with the specified name and configuration.

This is the primary constructor for creating custom tools that AI models
can call. The tool definition includes parameter validation,
success/failure schemas, and optional service dependencies.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Tool } from &quot;@effect/ai&quot;import { Schema } from &quot;effect&quot;
// Simple tool with no parametersconst GetCurrentTime = Tool.make(&quot;GetCurrentTime&quot;, {  description: &quot;Returns the current timestamp&quot;,  success: Schema.Number})</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"GetDadJoke\"]{style="--0:#032F62;--1:#9ECBFF"}[,
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
49
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
<pre data-language="ts"><code>description?: string | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
An optional description explaining what the tool does.
:::
:::::

[description]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"Get a hilarious dad joke from the
ICanHazDadJoke
API\"]{style="--0:#032F62;--1:#9ECBFF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
50
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
<pre data-language="ts"><code>success?: typeof Schema.String | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema for successful tool execution results.
:::
:::::

[success]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

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
<pre data-language="ts"><code>failure?: typeof Schema.Never | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema for tool execution failures.
:::
:::::

[failure]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Never</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Never]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
52
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
<pre data-language="ts"><code>parameters?: {    searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;} | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema defining the parameters this tool accepts.
:::
:::::

[parameters]{style="--0:#24292E;--1:#E1E4E8"}[:
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
53
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
<pre data-language="ts"><code>searchTerm: Schema.SchemaClass&lt;string, string, never&gt;</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Annotable&lt;SchemaClass&lt;string, string, never&gt;, string, string, never&gt;.annotations(annotations: Schema.Annotations.GenericSchema&lt;string&gt;): Schema.SchemaClass&lt;string, string, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Merges a set of new annotations with existing ones, potentially
overwriting any duplicates.
:::
:::::

[annotations]{style="--0:#6F42C1;--1:#B392F0"}[({]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
54
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
<pre data-language="ts"><code>Annotations.Doc&lt;string&gt;.description?: string</code></pre>
</figure>
:::
::::

[description]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"The search term to use to find dad
jokes\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
55
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
56
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
57
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
58
:::
::::

::: code
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
59
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
<pre data-language="ts"><code>const DadJokeTools: Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::
::::

[DadJokeTools]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Toolkit</code></pre>
</figure>
:::
::::

[Toolkit]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;[Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;]&gt;(tools_0: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;) =&gt; Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a new toolkit from the specified tools.

This is the primary constructor for creating toolkits. It accepts
multiple tools and organizes them into a toolkit that can be provided to
AI language models. Tools can be either Tool instances or TaggedRequest
schemas.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Toolkit, Tool } from &quot;@effect/ai&quot;import { Schema } from &quot;effect&quot;
const GetCurrentTime = Tool.make(&quot;GetCurrentTime&quot;, {  description: &quot;Get the current timestamp&quot;,  success: Schema.Number})
const GetWeather = Tool.make(&quot;get_weather&quot;, {  description: &quot;Get weather information&quot;,  parameters: { location: Schema.String },  success: Schema.Struct({    temperature: Schema.Number,    condition: Schema.String  })})
const toolkit = Toolkit.make(GetCurrentTime, GetWeather)</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::
::::

[GetDadJoke]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
60
:::
::::

::: code
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
61
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
<pre data-language="ts"><code>const DadJokeToolHandlers: Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, ICanHazDadJoke&gt;</code></pre>
</figure>
:::
::::

[DadJokeToolHandlers]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}]{.mark}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const DadJokeTools: Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::
::::

[DadJokeTools]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#5c37a0;--1:#c5acf4"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Toolkit&lt;{ readonly GetDadJoke: Tool&lt;&quot;GetDadJoke&quot;, { readonly parameters: Struct&lt;{ searchTerm: SchemaClass&lt;string, string, never&gt;; }&gt;; readonly success: typeof String$; readonly failure: typeof Never; }, never&gt;; }&gt;.toLayer&lt;{    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never, ICanHazDadJoke&gt;(build: {    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;} | Effect.Effect&lt;{    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never, ICanHazDadJoke&gt;): Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, ICanHazDadJoke&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Converts a toolkit into a Layer containing handlers for each tool in the
toolkit.
:::
:::::

[toLayer]{style="--0:#5c37a0;--1:#c5acf4"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
62
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Tag&lt;ICanHazDadJoke, ICanHazDadJoke&gt;&gt;, {    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;}&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Tag&lt;ICanHazDadJoke, ICanHazDadJoke&gt;&gt;, {    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never&gt;) =&gt; Effect.Effect&lt;{    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never, ICanHazDadJoke&gt; (+1 overload)</code></pre>
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

[gen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[function\*]{style="--0:#BF3441;--1:#F97583"}[()
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
63
:::
::::

::: code
[ ]{.indent}[// Access the \`ICanHazDadJoke\`
service]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
64
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
<pre data-language="ts"><code>const icanhazdadjoke: ICanHazDadJoke</code></pre>
</figure>
:::
::::

[icanhazdadjoke]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ICanHazDadJoke</code></pre>
</figure>
:::
::::

[ICanHazDadJoke]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
65
:::
::::

::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
66
:::
::::

::: code
[ ]{.indent}[// Implement the handler for the \`GetDadJoke\` tool call
request]{style="--0:#616972;--1:#99A0A6"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
67
:::
::::

::::::::::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type GetDadJoke: ({ searchTerm }: {    readonly searchTerm: string;}) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[GetDadJoke]{style="--0:#6F42C1;--1:#B392F0"}[: ({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>searchTerm: string</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#AE4B07;--1:#FFAB70"}[ })
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const icanhazdadjoke: ICanHazDadJoke</code></pre>
</figure>
:::
::::

[icanhazdadjoke]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[search]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>searchTerm: string</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
68
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
69
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
70
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

In the code above:

- We access the `ICanHazDadJoke`{dir="auto"} service from our
  application
- Register a handler for the `GetDadJoke`{dir="auto"} tool using
  `.handle("GetDadJoke", ...)`{dir="auto"}
- Use the `.search`{dir="auto"} method on our
  `ICanHazDadJoke`{dir="auto"} service to search for a dad joke based on
  the tool call parameters

The result of calling `.toLayer`{dir="auto"} on a `Toolkit`{dir="auto"}
is a `Layer`{dir="auto"} that contains the handlers for all the tools in
our toolkit.

Because of this, it is quite simple to test a `Toolkit`{dir="auto"} by
using `.toLayer`{dir="auto"} to create a separate `Layer`{dir="auto"}
specifically for testing.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### 4. Give the Tools to the Model {#4-give-the-tools-to-the-model}

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#4-give-the-tools-to-the-model){.anchor-link
aria-labelledby="4-give-the-tools-to-the-model"}
:::

Once the tools are defined and implemented, you can pass them along to
the model at request time. Behind the scenes, the model is given a
structured description of each tool and can choose to call one or more
of them when responding to input.

**Example** (Using a `Toolkit`{dir="auto"})

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import LanguageModel</code></pre>
</figure>
:::

[LanguageModel]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Tool</code></pre>
</figure>
:::
::::

[Tool]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Toolkit</code></pre>
</figure>
:::
::::

[Toolkit]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/ai\"]{style="--0:#032F62;--1:#9ECBFF"}

::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

:::::::: code
[import]{style="--0:#BF3441;--1:#F97583"}[ {
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
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}
::::::::
:::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
3
:::
::::

::: code
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
4
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
<pre data-language="ts"><code>const GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::
::::

[GetDadJoke]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Tool</code></pre>
</figure>
:::
::::

[Tool]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;&quot;GetDadJoke&quot;, {    searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;}, typeof Schema.String, typeof Schema.Never, []&gt;(name: &quot;GetDadJoke&quot;, options?: {    readonly description?: string | undefined;    readonly parameters?: {        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    } | undefined;    readonly success?: typeof Schema.String | undefined;    readonly failure?: typeof Schema.Never | undefined;    readonly dependencies?: [] | undefined;} | undefined) =&gt; Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a user-defined tool with the specified name and configuration.

This is the primary constructor for creating custom tools that AI models
can call. The tool definition includes parameter validation,
success/failure schemas, and optional service dependencies.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Tool } from &quot;@effect/ai&quot;import { Schema } from &quot;effect&quot;
// Simple tool with no parametersconst GetCurrentTime = Tool.make(&quot;GetCurrentTime&quot;, {  description: &quot;Returns the current timestamp&quot;,  success: Schema.Number})</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"GetDadJoke\"]{style="--0:#032F62;--1:#9ECBFF"}[,
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
5
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
<pre data-language="ts"><code>description?: string | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
An optional description explaining what the tool does.
:::
:::::

[description]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"Get a hilarious dad joke from the
ICanHazDadJoke
API\"]{style="--0:#032F62;--1:#9ECBFF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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
<pre data-language="ts"><code>success?: typeof Schema.String | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema for successful tool execution results.
:::
:::::

[success]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
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
<pre data-language="ts"><code>failure?: typeof Schema.Never | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema for tool execution failures.
:::
:::::

[failure]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Never</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Never]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>parameters?: {    searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;} | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema defining the parameters this tool accepts.
:::
:::::

[parameters]{style="--0:#24292E;--1:#E1E4E8"}[:
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
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
<pre data-language="ts"><code>searchTerm: Schema.SchemaClass&lt;string, string, never&gt;</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Annotable&lt;SchemaClass&lt;string, string, never&gt;, string, string, never&gt;.annotations(annotations: Schema.Annotations.GenericSchema&lt;string&gt;): Schema.SchemaClass&lt;string, string, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Merges a set of new annotations with existing ones, potentially
overwriting any duplicates.
:::
:::::

[annotations]{style="--0:#6F42C1;--1:#B392F0"}[({]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
10
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
<pre data-language="ts"><code>Annotations.Doc&lt;string&gt;.description?: string</code></pre>
</figure>
:::
::::

[description]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"The search term to use to find dad
jokes\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

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
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}]{style="--0:#24292E;--1:#E1E4E8"}
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

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
15
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
<pre data-language="ts"><code>const DadJokeTools: Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::
::::

[DadJokeTools]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Toolkit</code></pre>
</figure>
:::
::::

[Toolkit]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;[Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;]&gt;(tools_0: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;) =&gt; Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a new toolkit from the specified tools.

This is the primary constructor for creating toolkits. It accepts
multiple tools and organizes them into a toolkit that can be provided to
AI language models. Tools can be either Tool instances or TaggedRequest
schemas.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Toolkit, Tool } from &quot;@effect/ai&quot;import { Schema } from &quot;effect&quot;
const GetCurrentTime = Tool.make(&quot;GetCurrentTime&quot;, {  description: &quot;Get the current timestamp&quot;,  success: Schema.Number})
const GetWeather = Tool.make(&quot;get_weather&quot;, {  description: &quot;Get weather information&quot;,  parameters: { location: Schema.String },  success: Schema.Struct({    temperature: Schema.Number,    condition: Schema.String  })})
const toolkit = Toolkit.make(GetCurrentTime, GetWeather)</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::
::::

[GetDadJoke]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
16
:::
::::

::: code
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
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
<pre data-language="ts"><code>const generateDadJoke: Effect.Effect&lt;LanguageModel.GenerateTextResponse&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;, AiError, Tool.Handler&lt;&quot;GetDadJoke&quot;&gt; | LanguageModel.LanguageModel&gt;</code></pre>
</figure>
:::
::::

[generateDadJoke]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import LanguageModel</code></pre>
</figure>
:::
::::

[LanguageModel]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const generateText: &lt;{    prompt: string;    toolkit: Toolkit.Toolkit&lt;{        readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {            readonly parameters: Schema.Struct&lt;{                searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;            }&gt;;            readonly success: typeof Schema.String;            readonly failure: typeof Schema.Never;        }, never&gt;;    }&gt;;}, {    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;(options: {    prompt: string;    toolkit: Toolkit.Toolkit&lt;{        readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {            readonly parameters: Schema.Struct&lt;{                searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;            }&gt;;            readonly success: typeof Schema.String;            readonly failure: typeof Schema.Never;        }, never&gt;;    }&gt;;} &amp; LanguageModel.GenerateTextOptions&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Generate text using a language model.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { LanguageModel } from &quot;@effect/ai&quot;import { Effect } from &quot;effect&quot;
const program = Effect.gen(function* () {  const response = yield* LanguageModel.generateText({    prompt: &quot;Write a haiku about programming&quot;,    toolChoice: &quot;none&quot;  })
  console.log(response.text)  console.log(response.usage.totalTokens)
  return response})</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[generateText]{style="--0:#6F42C1;--1:#B392F0"}[({]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
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
<pre data-language="ts"><code>prompt: string &amp; RawInput</code></pre>
</figure>
:::

::: twoslash-popup-docs
The prompt input to use to generate text.
:::
:::::

[prompt]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"Generate a dad joke about
pirates\"]{style="--0:#032F62;--1:#9ECBFF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

::::::::::: {.ec-line .highlight .mark}
:::: gutter
::: {.ln aria-hidden="true"}
19
:::
::::

:::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>toolkit: (Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt; &amp; Toolkit.WithHandler&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;) | (Toolkit.Toolkit&lt;...&gt; &amp; Effect.Effect&lt;...&gt;)</code></pre>
</figure>
:::

::: twoslash-popup-docs
A toolkit containing both the tools and the tool call handler to use to
augment text generation.
:::
:::::

[toolkit]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const DadJokeTools: Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::
::::

[DadJokeTools]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
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
### 5. Bring It All Together {#5-bring-it-all-together}

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#5-bring-it-all-together){.anchor-link
aria-labelledby="5-bring-it-all-together"}
:::

To make the program executable, we must provide the implementation of
our tool call handlers:

**Example** (Providing the Tool Call Handlers to a Program)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { import LanguageModel</code></pre>
</figure>
:::

[LanguageModel]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Tool</code></pre>
</figure>
:::
::::

[Tool]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Toolkit</code></pre>
</figure>
:::
::::

[Toolkit]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/ai\"]{style="--0:#032F62;--1:#9ECBFF"}

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
2
:::
::::

::::::: code
[import]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import OpenAiClient</code></pre>
</figure>
:::
::::

[OpenAiClient]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import OpenAiLanguageModel</code></pre>
</figure>
:::
::::

[OpenAiLanguageModel]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/ai-openai\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::::
::::::::::

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
<pre data-language="ts"><code>import HttpClient</code></pre>
</figure>
:::
::::

[HttpClient]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

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
<pre data-language="ts"><code>import HttpClientRequest</code></pre>
</figure>
:::
::::

[HttpClientRequest]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
6
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
<pre data-language="ts"><code>import HttpClientResponse</code></pre>
</figure>
:::
::::

[HttpClientResponse]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
7
:::
::::

::: code
[}
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/platform\"]{style="--0:#032F62;--1:#9ECBFF"}
:::
::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
8
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
<pre data-language="ts"><code>import NodeHttpClient</code></pre>
</figure>
:::
::::

[NodeHttpClient]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"@effect/platform-node\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
9
:::
::::

:::::::::::::::: code
[import]{style="--0:#BF3441;--1:#F97583"}[ {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Array</code></pre>
</figure>
:::
::::

[Array]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Config</code></pre>
</figure>
:::
::::

[Config]{style="--0:#24292E;--1:#E1E4E8"}[,
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
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[ }
]{style="--0:#24292E;--1:#E1E4E8"}[from]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[\"effect\"]{style="--0:#032F62;--1:#9ECBFF"}
::::::::::::::::
:::::::::::::::::::

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
::: ln
:::
::::

::: code
[]{.expand}[]{.collapse}[51 collapsed lines]{.text}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
11
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
<pre data-language="ts"><code>class DadJoke</code></pre>
</figure>
:::
::::

[DadJoke]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[extends]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Class: &lt;DadJoke&gt;(identifier: string) =&gt; &lt;Fields&gt;(fieldsOr: Fields | HasFields&lt;Fields&gt;, annotations?: ClassAnnotations&lt;DadJoke, { [K in keyof Schema.Struct&lt;Fields extends Schema.Struct.Fields&gt;.Type&lt;Fields&gt;]: Schema.Struct.Type&lt;Fields&gt;[K]; }&gt; | undefined) =&gt; Schema.Class&lt;DadJoke, Fields, Schema.Struct.Encoded&lt;Fields&gt;, Schema.Schema&lt;in out A, in out I = A, out R = never&gt;.Context&lt;Fields[keyof Fields]&gt;, Schema.Struct.Constructor&lt;...&gt;, {}, {}&gt;</code></pre>
</figure>
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Schema } from &quot;effect&quot;
class MyClass extends Schema.Class&lt;MyClass&gt;(&quot;MyClass&quot;)({ someField: Schema.String}) { someMethod() {   return this.someField + &quot;bar&quot; }}</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
::::
::::::

[Class]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class DadJoke</code></pre>
</figure>
:::
::::

[DadJoke]{style="--0:#6F42C1;--1:#B392F0"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}[\"DadJoke\"]{style="--0:#032F62;--1:#9ECBFF"}[)({]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

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
<pre data-language="ts"><code>id: typeof Schema.String</code></pre>
</figure>
:::
::::

[id]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
<pre data-language="ts"><code>joke: typeof Schema.String</code></pre>
</figure>
:::
::::

[joke]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
14
:::
::::

::: code
[}) {}]{style="--0:#24292E;--1:#E1E4E8"}
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
[class]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class SearchResponse</code></pre>
</figure>
:::
::::

[SearchResponse]{style="--0:#6F42C1;--1:#B392F0"}[
]{style="--0:#24292E;--1:#E1E4E8"}[extends]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const Class: &lt;SearchResponse&gt;(identifier: string) =&gt; &lt;Fields&gt;(fieldsOr: Fields | HasFields&lt;Fields&gt;, annotations?: ClassAnnotations&lt;SearchResponse, { [K in keyof Schema.Struct&lt;Fields extends Schema.Struct.Fields&gt;.Type&lt;Fields&gt;]: Schema.Struct.Type&lt;Fields&gt;[K]; }&gt; | undefined) =&gt; Schema.Class&lt;SearchResponse, Fields, Schema.Struct.Encoded&lt;Fields&gt;, Schema.Schema&lt;in out A, in out I = A, out R = never&gt;.Context&lt;Fields[keyof Fields]&gt;, Schema.Struct.Constructor&lt;...&gt;, {}, {}&gt;</code></pre>
</figure>
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Schema } from &quot;effect&quot;
class MyClass extends Schema.Class&lt;MyClass&gt;(&quot;MyClass&quot;)({ someField: Schema.String}) { someMethod() {   return this.someField + &quot;bar&quot; }}</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
::::
::::::

[Class]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class SearchResponse</code></pre>
</figure>
:::
::::

[SearchResponse]{style="--0:#6F42C1;--1:#B392F0"}[\>(]{style="--0:#24292E;--1:#E1E4E8"}[\"SearchResponse\"]{style="--0:#032F62;--1:#9ECBFF"}[)({]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
17
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
<pre data-language="ts"><code>results: Schema.Array$&lt;typeof DadJoke&gt;</code></pre>
</figure>
:::
::::

[results]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Array&lt;typeof DadJoke&gt;(value: typeof DadJoke): Schema.Array$&lt;typeof DadJoke&gt;export Array</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Array]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class DadJoke</code></pre>
</figure>
:::
::::

[DadJoke]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
18
:::
::::

::: code
[}) {}]{style="--0:#24292E;--1:#E1E4E8"}
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

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
20
:::
::::

::::::::::::::: code
[class]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ICanHazDadJoke</code></pre>
</figure>
:::
::::

[ICanHazDadJoke]{style="--0:#6F42C1;--1:#B392F0"}[
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
<pre data-language="ts"><code>const Service: &lt;ICanHazDadJoke&gt;() =&gt; {    &lt;Key, Make&gt;(key: Key, make: Make): Effect.Service.Class&lt;ICanHazDadJoke, Key, Make&gt;;    &lt;Key, Make&gt;(key: Key, make: Make): Effect.Service.Class&lt;ICanHazDadJoke, Key, Make&gt;;    &lt;Key, Make&gt;(key: Key, make: Make): Effect.Service.Class&lt;ICanHazDadJoke, Key, Make&gt;;    &lt;Key, Make&gt;(key: Key, make: Make): Effect.Service.Class&lt;ICanHazDadJoke, Key, Make&gt;;    &lt;Key, Make&gt;(key: Key, make: Make): Effect.Service.Class&lt;...&gt;;}</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Simplifies the creation and management of services in Effect by defining
both a `Tag` and a `Layer`.

**Details**

This function allows you to streamline the creation of services by
combining the definition of a `Context.Tag` and a `Layer` in a single
step. It supports various ways of providing the service implementation:

- Using an `effect` to define the service dynamically.
- Using `sync` or `succeed` to define the service statically.
- Using `scoped` to create services with lifecycle management.

It also allows you to specify dependencies for the service, which will
be provided automatically when the service is used. Accessors can be
optionally generated for the service, making it more convenient to use.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &#39;effect&#39;;
class Prefix extends Effect.Service&lt;Prefix&gt;()(&quot;Prefix&quot;, { sync: () =&gt; ({ prefix: &quot;PRE&quot; })}) {}
class Logger extends Effect.Service&lt;Logger&gt;()(&quot;Logger&quot;, { accessors: true, effect: Effect.gen(function* () {   const { prefix } = yield* Prefix   return {     info: (message: string) =&gt;       Effect.sync(() =&gt; {         console.log(`[${prefix}][${message}]`)       })   } }), dependencies: [Prefix.Default]}) {}</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.9.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[Service]{style="--0:#6F42C1;--1:#B392F0"}[\<]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ICanHazDadJoke</code></pre>
</figure>
:::
::::

[ICanHazDadJoke]{style="--0:#6F42C1;--1:#B392F0"}[\>()(]{style="--0:#24292E;--1:#E1E4E8"}[\"ICanHazDadJoke\"]{style="--0:#032F62;--1:#9ECBFF"}[,
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
21
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
<pre data-language="ts"><code>dependencies: readonly [Layer.Layer&lt;HttpClient.HttpClient, never, never&gt;]</code></pre>
</figure>
:::
::::

[dependencies]{style="--0:#24292E;--1:#E1E4E8"}[:
\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeHttpClient</code></pre>
</figure>
:::
::::

[NodeHttpClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const layerUndici: Layer.Layer&lt;HttpClient.HttpClient, never, never&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[layerUndici]{style="--0:#24292E;--1:#E1E4E8"}[\],]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
22
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
<pre data-language="ts"><code>effect: Effect.Effect&lt;{    readonly search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never, HttpClient.HttpClient&gt;</code></pre>
</figure>
:::
::::

[effect]{style="--0:#24292E;--1:#E1E4E8"}[:
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Tag&lt;HttpClient.HttpClient, HttpClient.HttpClient&gt;&gt;, {    readonly search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;;}&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Tag&lt;HttpClient.HttpClient, HttpClient.HttpClient&gt;&gt;, {    readonly search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never&gt;) =&gt; Effect.Effect&lt;{    readonly search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never, HttpClient.HttpClient&gt; (+1 overload)</code></pre>
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

[gen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[function\*]{style="--0:#BF3441;--1:#F97583"}[()
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
23
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
<pre data-language="ts"><code>const httpClient: HttpClient.HttpClient</code></pre>
</figure>
:::
::::

[httpClient]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import HttpClient</code></pre>
</figure>
:::
::::

[HttpClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const HttpClient: Tag&lt;HttpClient.HttpClient, HttpClient.HttpClient&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[HttpClient]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

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
<pre data-language="ts"><code>const httpClientOk: HttpClient.HttpClient.With&lt;HttpClientError, never&gt;</code></pre>
</figure>
:::
::::

[httpClientOk]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const httpClient: HttpClient.HttpClient</code></pre>
</figure>
:::
::::

[httpClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;HttpClient.HttpClient, HttpClient.HttpClient.With&lt;HttpClientError, never&gt;, HttpClient.HttpClient.With&lt;HttpClientError, never&gt;&gt;(this: HttpClient.HttpClient, ab: (_: HttpClient.HttpClient) =&gt; HttpClient.HttpClient.With&lt;HttpClientError, never&gt;, bc: (_: HttpClient.HttpClient.With&lt;HttpClientError, never&gt;) =&gt; HttpClient.HttpClient.With&lt;HttpClientError, never&gt;): HttpClient.HttpClient.With&lt;...&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

:::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
25
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
<pre data-language="ts"><code>import HttpClient</code></pre>
</figure>
:::
::::

[HttpClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const filterStatusOk: &lt;E, R&gt;(self: HttpClient.HttpClient.With&lt;E, R&gt;) =&gt; HttpClient.HttpClient.With&lt;E | ResponseError, R&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Filters responses that return a 2xx status code.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[filterStatusOk]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::
::::::::::::

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

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import HttpClient</code></pre>
</figure>
:::
::::

[HttpClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const mapRequest: (f: (a: HttpClientRequest.HttpClientRequest) =&gt; HttpClientRequest.HttpClientRequest) =&gt; &lt;E, R&gt;(self: HttpClient.HttpClient.With&lt;E, R&gt;) =&gt; HttpClient.HttpClient.With&lt;E, R&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Appends a transformation of the request object before sending it.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[mapRequest]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import HttpClientRequest</code></pre>
</figure>
:::
::::

[HttpClientRequest]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const prependUrl: (path: string) =&gt; (self: HttpClientRequest.HttpClientRequest) =&gt; HttpClientRequest.HttpClientRequest (+1 overload)</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[prependUrl]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"https://icanhazdadjoke.com\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
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
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
29
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
<pre data-language="ts"><code>const search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[search]{style="--0:#005CC5;--1:#79B8FF"}[
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

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const fn: (name: string, options?: SpanOptions) =&gt; Effect.fn.Gen &amp; Effect.fn.NonGen (+20 overloads)</code></pre>
</figure>
:::
::::

[fn]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"ICanHazDadJoke.search\"]{style="--0:#032F62;--1:#9ECBFF"}[)(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
30
:::
::::

::::: code
[
]{.indent}[function\*]{style="--0:#BF3441;--1:#F97583"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>searchTerm: string</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#AE4B07;--1:#FFAB70"}[:]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[string]{style="--0:#005CC5;--1:#79B8FF"}[)
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
31
:::
::::

::::::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const httpClientOk: HttpClient.HttpClient.With&lt;HttpClientError, never&gt;</code></pre>
</figure>
:::
::::

[httpClientOk]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>HttpClient.With&lt;HttpClientError, never&gt;.get: (url: string | URL, options?: HttpClientRequest.Options.NoBody) =&gt; Effect.Effect&lt;HttpClientResponse.HttpClientResponse, HttpClientError, never&gt;</code></pre>
</figure>
:::
::::

[get]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"/search\"]{style="--0:#032F62;--1:#9ECBFF"}[,
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

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
<pre data-language="ts"><code>acceptJson?: boolean | undefined</code></pre>
</figure>
:::
::::

[acceptJson]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[true]{style="--0:#005CC5;--1:#79B8FF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
33
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
<pre data-language="ts"><code>urlParams?: Input | undefined</code></pre>
</figure>
:::
::::

[urlParams]{style="--0:#24292E;--1:#E1E4E8"}[: {
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>searchTerm: string</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#24292E;--1:#E1E4E8"}[
}]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
34
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
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;HttpClientResponse.HttpClientResponse, HttpClientError, never&gt;, Effect.Effect&lt;SearchResponse, HttpClientError | ParseError, never&gt;, Effect.Effect&lt;DadJoke, HttpClientError | ParseError | NoSuchElementException, never&gt;, Effect.Effect&lt;string, HttpClientError | ParseError | NoSuchElementException, never&gt;, Effect.Effect&lt;...&gt;, Effect.Effect&lt;...&gt;&gt;(this: Effect.Effect&lt;...&gt;, ab: (_: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;, bc: (_: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;, cd: (_: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;, de: (_: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;, ef: (_: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;): Effect.Effect&lt;...&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
35
:::
::::

::::::::::::::::::: code
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
<pre data-language="ts"><code>const flatMap: &lt;HttpClientResponse.HttpClientResponse, SearchResponse, ResponseError | ParseError, never&gt;(f: (a: HttpClientResponse.HttpClientResponse) =&gt; Effect.Effect&lt;SearchResponse, ResponseError | ParseError, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;HttpClientResponse.HttpClientResponse, E, R&gt;) =&gt; Effect.Effect&lt;SearchResponse, ResponseError | ParseError | E, R&gt; (+1 overload)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains effects to produce new `Effect` instances, useful for combining
operations that depend on previous results.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const flatMappedEffect = pipe(myEffect, Effect.flatMap(transformation))// orconst flatMappedEffect = Effect.flatMap(myEffect, transformation)// orconst flatMappedEffect = myEffect.pipe(Effect.flatMap(transformation))</code></pre>
</figure>
:::

**Details**

`flatMap` lets you sequence effects so that the result of one effect can
be used in the next step. It is similar to `flatMap` used with arrays
but works specifically with `Effect` instances, allowing you to avoid
deeply nested effect structures.

Since effects are immutable, `flatMap` always returns a new effect
instead of changing the original one.

**When to Use**

Use `flatMap` when you need to chain multiple effects, ensuring that
each step produces a new `Effect` while flattening any nested effects
that may occur.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Chaining the fetch and discount application using `flatMap`const finalAmount = pipe(  fetchTransactionAmount,  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(finalAmount).then(console.log)// Output: 95</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [tap for a version that ignores
the result of the effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[flatMap]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import HttpClientResponse</code></pre>
</figure>
:::
::::

[HttpClientResponse]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>schemaBodyJson&lt;SearchResponse, {    readonly results: readonly {        readonly id: string;        readonly joke: string;    }[];}, never&gt;(schema: Schema.Schema&lt;SearchResponse, {    readonly results: readonly {        readonly id: string;        readonly joke: string;    }[];}, never&gt;, options?: ParseOptions | undefined): &lt;E&gt;(self: HttpIncomingMessage&lt;E&gt;) =&gt; Effect.Effect&lt;SearchResponse, ParseError | E, never&gt;export schemaBodyJson</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[schemaBodyJson]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class SearchResponse</code></pre>
</figure>
:::
::::

[SearchResponse]{style="--0:#24292E;--1:#E1E4E8"}[)),]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::::::
::::::::::::::::::::::

::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
36
:::
::::

:::::::::::::::::::::: code
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
<pre data-language="ts"><code>const flatMap: &lt;SearchResponse, DadJoke, NoSuchElementException, never&gt;(f: (a: SearchResponse) =&gt; Effect.Effect&lt;DadJoke, NoSuchElementException, never&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;SearchResponse, E, R&gt;) =&gt; Effect.Effect&lt;DadJoke, NoSuchElementException | E, R&gt; (+1 overload)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains effects to produce new `Effect` instances, useful for combining
operations that depend on previous results.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const flatMappedEffect = pipe(myEffect, Effect.flatMap(transformation))// orconst flatMappedEffect = Effect.flatMap(myEffect, transformation)// orconst flatMappedEffect = myEffect.pipe(Effect.flatMap(transformation))</code></pre>
</figure>
:::

**Details**

`flatMap` lets you sequence effects so that the result of one effect can
be used in the next step. It is similar to `flatMap` used with arrays
but works specifically with `Effect` instances, allowing you to avoid
deeply nested effect structures.

Since effects are immutable, `flatMap` always returns a new effect
instead of changing the original one.

**When to Use**

Use `flatMap` when you need to chain multiple effects, ensuring that
each step produces a new `Effect` while flattening any nested effects
that may occur.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Chaining the fetch and discount application using `flatMap`const finalAmount = pipe(  fetchTransactionAmount,  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(finalAmount).then(console.log)// Output: 95</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [tap for a version that ignores
the result of the effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[flatMap]{style="--0:#6F42C1;--1:#B392F0"}[(({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>results: readonly DadJoke[]</code></pre>
</figure>
:::
::::

[results]{style="--0:#AE4B07;--1:#FFAB70"}[ })
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Array</code></pre>
</figure>
:::
::::

[Array]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const head: &lt;DadJoke&gt;(self: readonly DadJoke[]) =&gt; Option&lt;DadJoke&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Get the first element of a `ReadonlyArray`, or `None` if the
`ReadonlyArray` is empty.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[head]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>results: readonly DadJoke[]</code></pre>
</figure>
:::
::::

[results]{style="--0:#24292E;--1:#E1E4E8"}[)),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::
:::::::::::::::::::::::::

::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
37
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const map: &lt;DadJoke, string&gt;(f: (a: DadJoke) =&gt; string) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;DadJoke, E, R&gt;) =&gt; Effect.Effect&lt;string, E, R&gt; (+1 overload)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Transforms the value inside an effect by applying a function to it.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const mappedEffect = pipe(myEffect, Effect.map(transformation))// orconst mappedEffect = Effect.map(myEffect, transformation)// orconst mappedEffect = myEffect.pipe(Effect.map(transformation))</code></pre>
</figure>
:::

**Details**

`map` takes a function and applies it to the value contained within an
effect, creating a new effect with the transformed value.

It\'s important to note that effects are immutable, meaning that the
original effect is not modified. Instead, a new effect is returned with
the updated value.

**Example** (Adding a Service Charge)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
const addServiceCharge = (amount: number) =&gt; amount + 1
const fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
const finalAmount = pipe(  fetchTransactionAmount,  Effect.map(addServiceCharge))
Effect.runPromise(finalAmount).then(console.log)// Output: 101</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [mapError for a version that
operates on the error channel.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [mapBoth for a version that
operates on both channels.]{.twoslash-popup-docs-tag-value}

[\@see]{.twoslash-popup-docs-tag-name} ― [flatMap or andThen for a
version that can return a new effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[map]{style="--0:#6F42C1;--1:#B392F0"}[((]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>joke: DadJoke</code></pre>
</figure>
:::
::::

[joke]{style="--0:#AE4B07;--1:#FFAB70"}[)
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>joke: DadJoke</code></pre>
</figure>
:::
::::

[joke]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>joke: string</code></pre>
</figure>
:::
::::

[joke]{style="--0:#24292E;--1:#E1E4E8"}[),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::
:::::::::::::::::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
38
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
style="--0:#24292E;--1:#E1E4E8"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const scoped: &lt;A, E, R&gt;(effect: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, Exclude&lt;R, Scope&gt;&gt;</code></pre>
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

[scoped]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
39
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
<pre data-language="ts"><code>const orDie: &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, never, R&gt;</code></pre>
</figure>
:::

:::: twoslash-popup-docs
Converts an effect\'s failure into a fiber termination, removing the
error from the effect\'s type.

**Details**

The `orDie` function is used when you encounter errors that you do not
want to handle or recover from. It removes the error type from the
effect and ensures that any failure will terminate the fiber. This is
useful for propagating failures as defects, signaling that they should
not be handled within the effect.

\**When to Use*

Use `orDie` when failures should be treated as unrecoverable defects and
no error handling is required.

**Example** (Propagating an Error as a Defect)

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;
const divide = (a: number, b: number) =&gt;  b === 0    ? Effect.fail(new Error(&quot;Cannot divide by zero&quot;))    : Effect.succeed(a / b)
//      ┌─── Effect&lt;number, never, never&gt;//      ▼const program = Effect.orDie(divide(1, 0))
Effect.runPromise(program).catch(console.error)// Output:// (FiberFailure) Error: Cannot divide by zero//   ...stack trace...</code></pre>
</figure>
:::
::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [orDieWith if you need to
customize the error.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::::

[orDie]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
40
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
41
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
42
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
43
:::
::::

::: code
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
44
:::
::::

::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
45
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
<pre data-language="ts"><code>search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[search]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
46
:::
::::

::::: code
[[ ]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[}
]{style="--0:#24292E;--1:#E1E4E8"}[as]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#BF3441;--1:#F97583"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type const = {    readonly search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;;}</code></pre>
</figure>
:::
::::

[const]{style="--0:#BF3441;--1:#F97583"}
:::::
::::::::

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
[}) {}]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
49
:::
::::

::: code
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
50
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
<pre data-language="ts"><code>const GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::
::::

[GetDadJoke]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Tool</code></pre>
</figure>
:::
::::

[Tool]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;&quot;GetDadJoke&quot;, {    searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;}, typeof Schema.String, typeof Schema.Never, []&gt;(name: &quot;GetDadJoke&quot;, options?: {    readonly description?: string | undefined;    readonly parameters?: {        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    } | undefined;    readonly success?: typeof Schema.String | undefined;    readonly failure?: typeof Schema.Never | undefined;    readonly dependencies?: [] | undefined;} | undefined) =&gt; Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a user-defined tool with the specified name and configuration.

This is the primary constructor for creating custom tools that AI models
can call. The tool definition includes parameter validation,
success/failure schemas, and optional service dependencies.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Tool } from &quot;@effect/ai&quot;import { Schema } from &quot;effect&quot;
// Simple tool with no parametersconst GetCurrentTime = Tool.make(&quot;GetCurrentTime&quot;, {  description: &quot;Returns the current timestamp&quot;,  success: Schema.Number})</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"GetDadJoke\"]{style="--0:#032F62;--1:#9ECBFF"}[,
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
51
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
<pre data-language="ts"><code>description?: string | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
An optional description explaining what the tool does.
:::
:::::

[description]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"Get a hilarious dad joke from the
ICanHazDadJoke
API\"]{style="--0:#032F62;--1:#9ECBFF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
52
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
<pre data-language="ts"><code>success?: typeof Schema.String | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema for successful tool execution results.
:::
:::::

[success]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
53
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
<pre data-language="ts"><code>failure?: typeof Schema.Never | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema for tool execution failures.
:::
:::::

[failure]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Never</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[Never]{style="--0:#24292E;--1:#E1E4E8"}[,]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
54
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
<pre data-language="ts"><code>parameters?: {    searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;} | undefined</code></pre>
</figure>
:::

::: twoslash-popup-docs
Schema defining the parameters this tool accepts.
:::
:::::

[parameters]{style="--0:#24292E;--1:#E1E4E8"}[:
{]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
55
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
<pre data-language="ts"><code>searchTerm: Schema.SchemaClass&lt;string, string, never&gt;</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Schema</code></pre>
</figure>
:::
::::

[Schema]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class Stringexport String</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[3.10.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[String]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Annotable&lt;SchemaClass&lt;string, string, never&gt;, string, string, never&gt;.annotations(annotations: Schema.Annotations.GenericSchema&lt;string&gt;): Schema.SchemaClass&lt;string, string, never&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Merges a set of new annotations with existing ones, potentially
overwriting any duplicates.
:::
:::::

[annotations]{style="--0:#6F42C1;--1:#B392F0"}[({]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
56
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
<pre data-language="ts"><code>Annotations.Doc&lt;string&gt;.description?: string</code></pre>
</figure>
:::
::::

[description]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"The search term to use to find dad
jokes\"]{style="--0:#032F62;--1:#9ECBFF"}
:::::
::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
57
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
58
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
59
:::
::::

::: code
[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
60
:::
::::

::: code
:::
::::::

::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
61
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
<pre data-language="ts"><code>const DadJokeTools: Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::
::::

[DadJokeTools]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Toolkit</code></pre>
</figure>
:::
::::

[Toolkit]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const make: &lt;[Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;]&gt;(tools_0: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;) =&gt; Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Creates a new toolkit from the specified tools.

This is the primary constructor for creating toolkits. It accepts
multiple tools and organizes them into a toolkit that can be provided to
AI language models. Tools can be either Tool instances or TaggedRequest
schemas.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { Toolkit, Tool } from &quot;@effect/ai&quot;import { Schema } from &quot;effect&quot;
const GetCurrentTime = Tool.make(&quot;GetCurrentTime&quot;, {  description: &quot;Get the current timestamp&quot;,  success: Schema.Number})
const GetWeather = Tool.make(&quot;get_weather&quot;, {  description: &quot;Get weather information&quot;,  parameters: { location: Schema.String },  success: Schema.Struct({    temperature: Schema.Number,    condition: Schema.String  })})
const toolkit = Toolkit.make(GetCurrentTime, GetWeather)</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[make]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {    readonly parameters: Schema.Struct&lt;{        searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;    }&gt;;    readonly success: typeof Schema.String;    readonly failure: typeof Schema.Never;}, never&gt;</code></pre>
</figure>
:::
::::

[GetDadJoke]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::
:::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
62
:::
::::

::: code
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
63
:::
::::

:::::::::: code
[const]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[[]{.twoslash-hover}]{.twoslash
style="--0:#004ba0;--1:#81bcff"}]{.mark}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const DadJokeToolHandlers: Layer.Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, never&gt;</code></pre>
</figure>
:::
::::

[DadJokeToolHandlers]{style="--0:#004ba0;--1:#81bcff"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const DadJokeTools: Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::
::::

[DadJokeTools]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Toolkit&lt;{ readonly GetDadJoke: Tool&lt;&quot;GetDadJoke&quot;, { readonly parameters: Struct&lt;{ searchTerm: SchemaClass&lt;string, string, never&gt;; }&gt;; readonly success: typeof String$; readonly failure: typeof Never; }, never&gt;; }&gt;.toLayer&lt;{    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never, ICanHazDadJoke&gt;(build: {    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;} | Effect.Effect&lt;{    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never, ICanHazDadJoke&gt;): Layer.Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, ICanHazDadJoke&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Converts a toolkit into a Layer containing handlers for each tool in the
toolkit.
:::
:::::

[toLayer]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
64
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
<pre data-language="ts"><code>const gen: &lt;YieldWrap&lt;Tag&lt;ICanHazDadJoke, ICanHazDadJoke&gt;&gt;, {    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;}&gt;(f: (resume: Effect.Adapter) =&gt; Generator&lt;YieldWrap&lt;Tag&lt;ICanHazDadJoke, ICanHazDadJoke&gt;&gt;, {    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never&gt;) =&gt; Effect.Effect&lt;{    GetDadJoke: ({ searchTerm }: {        readonly searchTerm: string;    }) =&gt; Effect.Effect&lt;string, never, never&gt;;}, never, ICanHazDadJoke&gt; (+1 overload)</code></pre>
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

[gen]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[function\*]{style="--0:#BF3441;--1:#F97583"}[()
{]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
65
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
<pre data-language="ts"><code>const icanhazdadjoke: ICanHazDadJoke</code></pre>
</figure>
:::
::::

[icanhazdadjoke]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[yield\*]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ICanHazDadJoke</code></pre>
</figure>
:::
::::

[ICanHazDadJoke]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
66
:::
::::

::: code
[ ]{.indent}[return]{style="--0:#BF3441;--1:#F97583"}[
{]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
67
:::
::::

::::::::::::: code
[ ]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type GetDadJoke: ({ searchTerm }: {    readonly searchTerm: string;}) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[GetDadJoke]{style="--0:#6F42C1;--1:#B392F0"}[: ({
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>searchTerm: string</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#AE4B07;--1:#FFAB70"}[ })
]{style="--0:#24292E;--1:#E1E4E8"}[=\>]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const icanhazdadjoke: ICanHazDadJoke</code></pre>
</figure>
:::
::::

[icanhazdadjoke]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>search: (searchTerm: string) =&gt; Effect.Effect&lt;string, never, never&gt;</code></pre>
</figure>
:::
::::

[search]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>searchTerm: string</code></pre>
</figure>
:::
::::

[searchTerm]{style="--0:#24292E;--1:#E1E4E8"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::
::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
68
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
69
:::
::::

::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[})]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
70
:::
::::

::::::::::::::: code
[).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Layer.Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, ICanHazDadJoke&gt;, Layer.Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, never&gt;&gt;(this: Layer.Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, ICanHazDadJoke&gt;, ab: (_: Layer.Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, ICanHazDadJoke&gt;) =&gt; Layer.Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, never&gt;): Layer.Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, never&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const provide: &lt;never, never, ICanHazDadJoke&gt;(that: Layer.Layer&lt;ICanHazDadJoke, never, never&gt;) =&gt; &lt;RIn2, E2, ROut2&gt;(self: Layer.Layer&lt;ROut2, E2, RIn2&gt;) =&gt; Layer.Layer&lt;ROut2, E2, Exclude&lt;RIn2, ICanHazDadJoke&gt;&gt; (+3 overloads)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Feeds the output services of this builder into the input of the
specified builder, resulting in a new builder with the inputs of this
builder as well as any leftover inputs, and the outputs of the specified
builder.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[provide]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>class ICanHazDadJoke</code></pre>
</figure>
:::
::::

[ICanHazDadJoke]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>type Default: Layer.Layer&lt;ICanHazDadJoke, never, never&gt;</code></pre>
</figure>
:::
::::

[Default]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
71
:::
::::

::: code
:::
::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
72
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
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, AiError, Tool.Handler&lt;&quot;GetDadJoke&quot;&gt; | OpenAiClient.OpenAiClient&gt;</code></pre>
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
<pre data-language="ts"><code>import LanguageModel</code></pre>
</figure>
:::
::::

[LanguageModel]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const generateText: &lt;{    prompt: string;    toolkit: Toolkit.Toolkit&lt;{        readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {            readonly parameters: Schema.Struct&lt;{                searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;            }&gt;;            readonly success: typeof Schema.String;            readonly failure: typeof Schema.Never;        }, never&gt;;    }&gt;;}, {    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;(options: {    prompt: string;    toolkit: Toolkit.Toolkit&lt;{        readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {            readonly parameters: Schema.Struct&lt;{                searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;            }&gt;;            readonly success: typeof Schema.String;            readonly failure: typeof Schema.Never;        }, never&gt;;    }&gt;;} &amp; LanguageModel.GenerateTextOptions&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;</code></pre>
</figure>
:::

::: twoslash-popup-docs
Generate text using a language model.
:::

:::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@example]{.twoslash-popup-docs-tag-name}
[]{.twoslash-popup-docs-tag-value}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { LanguageModel } from &quot;@effect/ai&quot;import { Effect } from &quot;effect&quot;
const program = Effect.gen(function* () {  const response = yield* LanguageModel.generateText({    prompt: &quot;Write a haiku about programming&quot;,    toolChoice: &quot;none&quot;  })
  console.log(response.text)  console.log(response.usage.totalTokens)
  return response})</code></pre>
</figure>
:::

[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
::::
:::::::

[generateText]{style="--0:#6F42C1;--1:#B392F0"}[({]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
73
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
<pre data-language="ts"><code>prompt: string &amp; RawInput</code></pre>
</figure>
:::

::: twoslash-popup-docs
The prompt input to use to generate text.
:::
:::::

[prompt]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[\"Generate a dad joke about
pirates\"]{style="--0:#032F62;--1:#9ECBFF"}[,]{style="--0:#24292E;--1:#E1E4E8"}
::::::
:::::::::

::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
74
:::
::::

:::::::: code
[[
]{style="--0:#24292E;--1:#E1E4E8"}]{.indent}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>toolkit: (Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt; &amp; Toolkit.WithHandler&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;) | (Toolkit.Toolkit&lt;...&gt; &amp; Effect.Effect&lt;...&gt;)</code></pre>
</figure>
:::

::: twoslash-popup-docs
A toolkit containing both the tools and the tool call handler to use to
augment text generation.
:::
:::::

[toolkit]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const DadJokeTools: Toolkit.Toolkit&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::
::::

[DadJokeTools]{style="--0:#24292E;--1:#E1E4E8"}
::::::::
:::::::::::

:::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
75
:::
::::

::::: code
[}).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;LanguageModel.GenerateTextResponse&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;, AiError, Tool.Handler&lt;&quot;GetDadJoke&quot;&gt; | LanguageModel.LanguageModel&gt;, Effect.Effect&lt;void, AiError, Tool.Handler&lt;&quot;GetDadJoke&quot;&gt; | LanguageModel.LanguageModel&gt;, Effect.Effect&lt;...&gt;&gt;(this: Effect.Effect&lt;...&gt;, ab: (_: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;, bc: (_: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt;): Effect.Effect&lt;...&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::
::::::::

::::::::::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
76
:::
::::

:::::::::::::::::::::::: code
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
<pre data-language="ts"><code>const flatMap: &lt;LanguageModel.GenerateTextResponse&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;, void, never, never&gt;(f: (a: LanguageModel.GenerateTextResponse&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;) =&gt; Effect.Effect&lt;...&gt;) =&gt; &lt;E, R&gt;(self: Effect.Effect&lt;...&gt;) =&gt; Effect.Effect&lt;...&gt; (+1 overload)</code></pre>
</figure>
:::

::::: twoslash-popup-docs
Chains effects to produce new `Effect` instances, useful for combining
operations that depend on previous results.

**Syntax**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const flatMappedEffect = pipe(myEffect, Effect.flatMap(transformation))// orconst flatMappedEffect = Effect.flatMap(myEffect, transformation)// orconst flatMappedEffect = myEffect.pipe(Effect.flatMap(transformation))</code></pre>
</figure>
:::

**Details**

`flatMap` lets you sequence effects so that the result of one effect can
be used in the next step. It is similar to `flatMap` used with arrays
but works specifically with `Effect` instances, allowing you to avoid
deeply nested effect structures.

Since effects are immutable, `flatMap` always returns a new effect
instead of changing the original one.

**When to Use**

Use `flatMap` when you need to chain multiple effects, ensuring that
each step produces a new `Effect` while flattening any nested effects
that may occur.

**Example**

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import { pipe, Effect } from &quot;effect&quot;
// Function to apply a discount safely to a transaction amountconst applyDiscount = (  total: number,  discountRate: number): Effect.Effect&lt;number, Error&gt; =&gt;  discountRate === 0    ? Effect.fail(new Error(&quot;Discount rate cannot be zero&quot;))    : Effect.succeed(total - (total * discountRate) / 100)
// Simulated asynchronous task to fetch a transaction amount from databaseconst fetchTransactionAmount = Effect.promise(() =&gt; Promise.resolve(100))
// Chaining the fetch and discount application using `flatMap`const finalAmount = pipe(  fetchTransactionAmount,  Effect.flatMap((amount) =&gt; applyDiscount(amount, 5)))
Effect.runPromise(finalAmount).then(console.log)// Output: 95</code></pre>
</figure>
:::
:::::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@see]{.twoslash-popup-docs-tag-name} ― [tap for a version that ignores
the result of the effect.]{.twoslash-popup-docs-tag-value}

[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::::

[flatMap]{style="--0:#6F42C1;--1:#B392F0"}[((]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#AE4B07;--1:#FFAB70"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>response: LanguageModel.GenerateTextResponse&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::
::::

[response]{style="--0:#AE4B07;--1:#FFAB70"}[)
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
<pre data-language="ts"><code>response: LanguageModel.GenerateTextResponse&lt;{    readonly GetDadJoke: Tool.Tool&lt;&quot;GetDadJoke&quot;, {        readonly parameters: Schema.Struct&lt;{            searchTerm: Schema.SchemaClass&lt;string, string, never&gt;;        }&gt;;        readonly success: typeof Schema.String;        readonly failure: typeof Schema.Never;    }, never&gt;;}&gt;</code></pre>
</figure>
:::
::::

[response]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>GenerateTextResponse&lt;{ readonly GetDadJoke: Tool&lt;&quot;GetDadJoke&quot;, { readonly parameters: Struct&lt;{ searchTerm: SchemaClass&lt;string, string, never&gt;; }&gt;; readonly success: typeof String$; readonly failure: typeof Never; }, never&gt;; }&gt;.text: string</code></pre>
</figure>
:::

::: twoslash-popup-docs
Extracts and concatenates all text parts from the response.
:::
:::::

[text]{style="--0:#24292E;--1:#E1E4E8"}[)),]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::::::::::
:::::::::::::::::::::::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
77
:::
::::

:::::::::::::::: code
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
<pre data-language="ts"><code>const provide: &lt;LanguageModel.LanguageModel | ProviderName, never, OpenAiClient.OpenAiClient&gt;(layer: Layer.Layer&lt;LanguageModel.LanguageModel | ProviderName, never, OpenAiClient.OpenAiClient&gt;) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, E, OpenAiClient.OpenAiClient | Exclude&lt;R, LanguageModel.LanguageModel | ProviderName&gt;&gt; (+9 overloads)</code></pre>
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
<pre data-language="ts"><code>import OpenAiLanguageModel</code></pre>
</figure>
:::
::::

[OpenAiLanguageModel]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const model: (model: (string &amp; {}) | OpenAiLanguageModel.Model, config?: Omit&lt;OpenAiLanguageModel.Config.Service, &quot;model&quot;&gt;) =&gt; Model&lt;&quot;openai&quot;, LanguageModel.LanguageModel, OpenAiClient.OpenAiClient&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[model]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"gpt-4o\"]{style="--0:#032F62;--1:#9ECBFF"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
78
:::
::::

::: code
[)]{style="--0:#24292E;--1:#E1E4E8"}
:::
::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
79
:::
::::

::: code
:::
::::::

::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
80
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
<pre data-language="ts"><code>const OpenAi: Layer.Layer&lt;OpenAiClient.OpenAiClient, ConfigError, never&gt;</code></pre>
</figure>
:::
::::

[OpenAi]{style="--0:#005CC5;--1:#79B8FF"}[
]{style="--0:#24292E;--1:#E1E4E8"}[=]{style="--0:#BF3441;--1:#F97583"}[
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import OpenAiClient</code></pre>
</figure>
:::
::::

[OpenAiClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const layerConfig: (options: {    readonly apiKey?: Config.Config&lt;Redacted | undefined&gt; | undefined;    readonly apiUrl?: Config.Config&lt;string | undefined&gt; | undefined;    readonly organizationId?: Config.Config&lt;Redacted | undefined&gt; | undefined;    readonly projectId?: Config.Config&lt;Redacted | undefined&gt; | undefined;    readonly transformClient?: (client: HttpClient.HttpClient) =&gt; HttpClient.HttpClient;}) =&gt; Layer.Layer&lt;OpenAiClient.OpenAiClient, ConfigError, HttpClient.HttpClient&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[layerConfig]{style="--0:#6F42C1;--1:#B392F0"}[({]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::
:::::::::::::

:::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
81
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
<pre data-language="ts"><code>apiKey?: Config.Config&lt;Redacted&lt;string&gt; | undefined&gt; | undefined</code></pre>
</figure>
:::
::::

[apiKey]{style="--0:#24292E;--1:#E1E4E8"}[:
]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import Config</code></pre>
</figure>
:::
::::

[Config]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const redacted: (name?: string) =&gt; Config.Config&lt;Redacted&gt; (+1 overload)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Constructs a config for a redacted value.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[redacted]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[\"OPENAI_API_KEY\"]{style="--0:#032F62;--1:#9ECBFF"}[)]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::
::::::::::::::

::::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
82
:::
::::

:::::::::::::::: code
[}).]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Layer.Layer&lt;OpenAiClient.OpenAiClient, ConfigError, HttpClient.HttpClient&gt;, Layer.Layer&lt;OpenAiClient.OpenAiClient, ConfigError, never&gt;&gt;(this: Layer.Layer&lt;OpenAiClient.OpenAiClient, ConfigError, HttpClient.HttpClient&gt;, ab: (_: Layer.Layer&lt;OpenAiClient.OpenAiClient, ConfigError, HttpClient.HttpClient&gt;) =&gt; Layer.Layer&lt;OpenAiClient.OpenAiClient, ConfigError, never&gt;): Layer.Layer&lt;...&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
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
<pre data-language="ts"><code>const provide: &lt;never, never, HttpClient.HttpClient&gt;(that: Layer.Layer&lt;HttpClient.HttpClient, never, never&gt;) =&gt; &lt;RIn2, E2, ROut2&gt;(self: Layer.Layer&lt;ROut2, E2, RIn2&gt;) =&gt; Layer.Layer&lt;ROut2, E2, Exclude&lt;RIn2, HttpClient.HttpClient&gt;&gt; (+3 overloads)</code></pre>
</figure>
:::

::: twoslash-popup-docs
Feeds the output services of this builder into the input of the
specified builder, resulting in a new builder with the inputs of this
builder as well as any leftover inputs, and the outputs of the specified
builder.
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[2.0.0]{.twoslash-popup-docs-tag-value}
:::
::::::

[provide]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>import NodeHttpClient</code></pre>
</figure>
:::
::::

[NodeHttpClient]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const layerUndici: Layer.Layer&lt;HttpClient.HttpClient, never, never&gt;</code></pre>
</figure>
:::

::: {.twoslash-popup-docs .twoslash-popup-docs-tags}
[\@since]{.twoslash-popup-docs-tag-name} ―
[1.0.0]{.twoslash-popup-docs-tag-value}
:::
:::::

[layerUndici]{style="--0:#24292E;--1:#E1E4E8"}[))]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::::::
:::::::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
83
:::
::::

::: code
:::
::::::

:::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
84
:::
::::

::::::: code
[[]{.twoslash-hover}]{.twoslash style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const program: Effect.Effect&lt;void, AiError, Tool.Handler&lt;&quot;GetDadJoke&quot;&gt; | OpenAiClient.OpenAiClient&gt;</code></pre>
</figure>
:::
::::

[program]{style="--0:#24292E;--1:#E1E4E8"}[.]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#6F42C1;--1:#B392F0"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>Pipeable.pipe&lt;Effect.Effect&lt;void, AiError, Tool.Handler&lt;&quot;GetDadJoke&quot;&gt; | OpenAiClient.OpenAiClient&gt;, Effect.Effect&lt;void, AiError | ConfigError, never&gt;, Promise&lt;void&gt;&gt;(this: Effect.Effect&lt;...&gt;, ab: (_: Effect.Effect&lt;void, AiError, Tool.Handler&lt;&quot;GetDadJoke&quot;&gt; | OpenAiClient.OpenAiClient&gt;) =&gt; Effect.Effect&lt;void, AiError | ConfigError, never&gt;, bc: (_: Effect.Effect&lt;void, AiError | ConfigError, never&gt;) =&gt; Promise&lt;...&gt;): Promise&lt;...&gt; (+21 overloads)</code></pre>
</figure>
:::
::::

[pipe]{style="--0:#6F42C1;--1:#B392F0"}[(]{style="--0:#24292E;--1:#E1E4E8"}
:::::::
::::::::::

:::::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
85
:::
::::

::::::::::::::: code
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
<pre data-language="ts"><code>const provide: &lt;readonly [Layer.Layer&lt;OpenAiClient.OpenAiClient, ConfigError, never&gt;, Layer.Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, never&gt;]&gt;(layers: readonly [Layer.Layer&lt;OpenAiClient.OpenAiClient, ConfigError, never&gt;, Layer.Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, never&gt;]) =&gt; &lt;A, E, R&gt;(self: Effect.Effect&lt;A, E, R&gt;) =&gt; Effect.Effect&lt;A, ConfigError | E, Exclude&lt;R, Tool.Handler&lt;&quot;GetDadJoke&quot;&gt; | OpenAiClient.OpenAiClient&gt;&gt; (+9 overloads)</code></pre>
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

[provide]{style="--0:#6F42C1;--1:#B392F0"}[(\[]{style="--0:#24292E;--1:#E1E4E8"}[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const OpenAi: Layer.Layer&lt;OpenAiClient.OpenAiClient, ConfigError, never&gt;</code></pre>
</figure>
:::
::::

[OpenAi]{style="--0:#24292E;--1:#E1E4E8"}[,
]{style="--0:#24292E;--1:#E1E4E8"}[[[]{.twoslash-hover}]{.twoslash
style="--0:#24292E;--1:#E1E4E8"}]{.mark}

:::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const DadJokeToolHandlers: Layer.Layer&lt;Tool.Handler&lt;&quot;GetDadJoke&quot;&gt;, never, never&gt;</code></pre>
</figure>
:::
::::

[DadJokeToolHandlers]{style="--0:#24292E;--1:#E1E4E8"}[\]),]{style="--0:#24292E;--1:#E1E4E8"}
:::::::::::::::
::::::::::::::::::

::::::::::::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
86
:::
::::

:::::::::::: code
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

:::::::: {.twoslash-popup-container .not-content}
[]{.twoslash-popup-code-type}

::: expressive-code
<figure class="frame">
<pre data-language="ts"><code>const runPromise: &lt;A, E&gt;(effect: Effect.Effect&lt;A, E, never&gt;, options?: {    readonly signal?: AbortSignal | undefined;} | undefined) =&gt; Promise&lt;A&gt;</code></pre>
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

[runPromise]{style="--0:#24292E;--1:#E1E4E8"}
::::::::::::
:::::::::::::::

:::::: ec-line
:::: gutter
::: {.ln aria-hidden="true"}
87
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

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Benefits

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#benefits){.anchor-link
aria-labelledby="benefits"}
:::

**Type Safe**

Every tool is fully described using Effect's `Schema`{dir="auto"},
including inputs, outputs, and descriptions.

**Effect Native**

Tool call behavior is defined using Effect, so they can leverage all the
power of Effect. This is especially useful when you need to access other
services to support the implementation of your tool call handlers.

**Injectable**

Because implementing the handlers for an `Toolkit`{dir="auto"} results
in a `Layer`{dir="auto"}, providing alternate implementation of tool
call handlers in different environments is as simple as providing a
different `Layer`{dir="auto"} to your program.

**Separation of Concerns**

The definition of a tool call request is cleanly separated from both the
implementation of the tool behavior, as well as the business logic that
calls the model.

::: {.meta .sl-flex .astro-lfnsiwle}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXF4bnlic3ZxIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuMmVtOyI+PHBhdGggZD0iTTIyIDcuMjRhMSAxIDAgMCAwLS4yOS0uNzFsLTQuMjQtNC4yNGExIDEgMCAwIDAtMS4xLS4yMiAxIDEgMCAwIDAtLjMyLjIybC0yLjgzIDIuODNMMi4yOSAxNi4wNWExIDEgMCAwIDAtLjI5LjcxVjIxYTEgMSAwIDAgMCAxIDFoNC4yNGExIDEgMCAwIDAgLjc2LS4yOWwxMC44Ny0xMC45M0wyMS43MSA4Yy4xLS4xLjE3LS4yLjIyLS4zM2ExIDEgMCAwIDAgMC0uMjR2LS4xNGwuMDctLjA1Wk02LjgzIDIwSDR2LTIuODNsOS45My05LjkzIDIuODMgMi44M0w2LjgzIDIwWk0xOC4xNyA4LjY2bC0yLjgzLTIuODMgMS40Mi0xLjQxIDIuODIgMi44Mi0xLjQxIDEuNDJaIiAvPjwvc3ZnPg==){.astro-qxnybsvq
.astro-4rgy7crp} Edit
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/ai/tool-use.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Execution Planning]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../planning-llm-interactions/index.html){.astro-u5aomj4k
rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[Getting Started]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../../micro/new-users/index.html){.astro-u5aomj4k
rel="next"}
:::
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
