::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Guidelines {#_top .astro-np5lzwrf}
:::
::::

:::::::::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::::::::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::::::: sl-markdown-content
::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Using runMain

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#using-runmain){.anchor-link
aria-labelledby="using-runmain"}
:::

In Effect, `runMain`{dir="auto"} is the primary entry point for
executing an Effect application on Node.js.

**Example** (Running an Effect Application with Graceful Teardown)

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { Effect, Console, Schedule, pipe } from &quot;effect&quot;2import { NodeRuntime } from &quot;@effect/platform-node&quot;3
4const program = pipe(5  Effect.addFinalizer(() =&gt; Console.log(&quot;Application is about to exit!&quot;)),6  Effect.andThen(Console.log(&quot;Application started!&quot;)),7  Effect.andThen(8    Effect.repeat(Console.log(&quot;still alive...&quot;), {9      schedule: Schedule.spaced(&quot;1 second&quot;)10    })11  ),12  Effect.scoped13)14
15// No graceful teardown on CTRL+C16// Effect.runPromise(program)17
18// Use NodeRuntime.runMain for graceful teardown on CTRL+C19NodeRuntime.runMain(program)20/*21Output:22Application started!23still alive...24still alive...25still alive...26still alive...27^C &lt;-- CTRL+C28Application is about to exit!29*/</code></pre>
<div class="copy">
<div>

</div>
</div>
</figure>
:::

The `runMain`{dir="auto"} function handles finding and interrupting all
fibers. Internally, it observes the fiber and listens for
`sigint`{dir="auto"} signals, ensuring a graceful shutdown of the
application when interrupted (e.g., using CTRL+C).

![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9InN0YXJsaWdodC1hc2lkZV9faWNvbiBhc3Ryby00cmd5N2NycCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Ym94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciIgc3R5bGU9Ii0tc2wtaWNvbi1zaXplOiAxZW07Ij48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xLjQ0IDguODU1di0uMDAxbDMuNTI3LTMuNTE2Yy4zNC0uMzQ0LjgwMi0uNTQxIDEuMjg1LS41NDhoNi42NDlsLjk0Ny0uOTQ3YzMuMDctMy4wNyA2LjIwNy0zLjA3MiA3LjYyLTIuODY4YTEuODIxIDEuODIxIDAgMCAxIDEuNTU3IDEuNTU3Yy4yMDQgMS40MTMuMjAzIDQuNTUtMi44NjggNy42MmwtLjk0Ni45NDZ2Ni42NDlhMS44NDUgMS44NDUgMCAwIDEtLjU0OSAxLjI4NmwtMy41MTYgMy41MjhhMS44NDQgMS44NDQgMCAwIDEtMy4xMS0uOTQ0bC0uODU4LTQuMjc1LTQuNTItNC41Mi0yLjMxLS40NjMtMS45NjQtLjM5NEExLjg0NyAxLjg0NyAwIDAgMSAuOTggMTAuNjkzYTEuODQzIDEuODQzIDAgMCAxIC40Ni0xLjgzOFptNS4zNzkgMi4wMTctMy44NzMtLjc3Nkw2LjMyIDYuNzMzaDQuNjM4bC00LjE0IDQuMTRabTguNDAzLTUuNjU1YzIuNDU5LTIuNDYgNC44NTYtMi40NjMgNS44OS0yLjMzLjEzNCAxLjAzNS4xMyAzLjQzMi0yLjMyOSA1Ljg5MWwtNi43MSA2LjcxLTMuNTYxLTMuNTYgNi43MS02LjcxMVptLTEuMzE4IDE1LjgzNy0uNzc2LTMuODczIDQuMTQtNC4xNHY0LjYzOWwtMy4zNjQgMy4zNzRaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIC8+PHBhdGggZD0iTTkuMzE4IDE4LjM0NWEuOTcyLjk3MiAwIDAgMC0xLjg2LS41NjFjLS40ODIgMS40MzUtMS42ODcgMi4yMDQtMi45MzQgMi42MTlhOC4yMiA4LjIyIDAgMCAxLTEuMjMuMzAyYy4wNjItLjM2NS4xNTctLjc5LjMwMy0xLjIyOS40MTUtMS4yNDcgMS4xODQtMi40NTIgMi42Mi0yLjkzNWEuOTcxLjk3MSAwIDEgMC0uNjItMS44NDJjLS4xMi4wNC0uMjM2LjA4NC0uMzUuMTMtMi4wMi44MjgtMy4wMTIgMi41ODgtMy40OTMgNC4wMzNhMTAuMzgzIDEwLjM4MyAwIDAgMC0uNTEgMi44NDVsLS4wMDEuMDE2di4wNjNjMCAuNTM2LjQzNC45NzIuOTcuOTcySDIuMjRhNy4yMSA3LjIxIDAgMCAwIC44NzgtLjA2NWMuNTI3LS4wNjMgMS4yNDgtLjE5IDIuMDItLjQ0NyAxLjQ0NS0uNDggMy4yMDUtMS40NzIgNC4wMzMtMy40OTRhNS44MjggNS44MjggMCAwIDAgLjE0Ny0uNDA3WiIgLz48L3N2Zz4=){.starlight-aside__icon
.astro-4rgy7crp} Graceful Teardown

::: starlight-aside__content
Ensure the teardown logic is placed in the main effect. If the fiber
running the application or server is interrupted, `runMain`{dir="auto"}
ensures that all resources are properly released.
:::

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Versions for Different Platforms

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#versions-for-different-platforms){.anchor-link
aria-labelledby="versions-for-different-platforms"}
:::

Effect provides versions of `runMain`{dir="auto"} tailored for different
platforms:

  Platform   Runtime Version                        Import Path
  ---------- -------------------------------------- ----------------------------------------
  Node.js    `NodeRuntime.runMain`{dir="auto"}      `@effect/platform-node`{dir="auto"}
  Bun        `BunRuntime.runMain`{dir="auto"}       `@effect/platform-bun`{dir="auto"}
  Browser    `BrowserRuntime.runMain`{dir="auto"}   `@effect/platform-browser`{dir="auto"}

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Avoid Tacit Usage

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#avoid-tacit-usage){.anchor-link
aria-labelledby="avoid-tacit-usage"}
:::

Avoid using tacit (point-free) function calls, such as
`Effect.map(fn)`{dir="auto"}, or using `flow`{dir="auto"} from the
`effect/Function`{dir="auto"} module.

In Effect, it's generally safer to write functions explicitly:

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>Effect.map((x) =&gt; fn(x))</code></pre>
<div class="copy">
<div>

</div>
</div>
</figure>
:::

rather than in a point-free style:

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>Effect.map(fn)</code></pre>
<div class="copy">
<div>

</div>
</div>
</figure>
:::

While tacit functions may be appealing for their brevity, they can
introduce a number of problems:

- Using tacit functions, particularly when dealing with optional
  parameters, can be unsafe. For example, if a function has overloads,
  writing it in a tacit style may erase all generics, resulting in bugs.
  Check out this X thread for more details: [link to
  thread](https://twitter.com/MichaelArnaldi/status/1670715270845935616).

- Tacit usage can also compromise TypeScript's ability to infer types,
  potentially causing unexpected errors. This isn't just a matter of
  style but a way to avoid subtle mistakes that can arise from type
  inference issues.

- Additionally, stack traces might not be as clear when tacit usage is
  employed.

Avoiding tacit usage is a simple precaution that makes your code more
reliable.
::::::::::

::: {.meta .sl-flex .astro-lfnsiwle}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXF4bnlic3ZxIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuMmVtOyI+PHBhdGggZD0iTTIyIDcuMjRhMSAxIDAgMCAwLS4yOS0uNzFsLTQuMjQtNC4yNGExIDEgMCAwIDAtMS4xLS4yMiAxIDEgMCAwIDAtLjMyLjIybC0yLjgzIDIuODNMMi4yOSAxNi4wNWExIDEgMCAwIDAtLjI5LjcxVjIxYTEgMSAwIDAgMCAxIDFoNC4yNGExIDEgMCAwIDAgLjc2LS4yOWwxMC44Ny0xMC45M0wyMS43MSA4Yy4xLS4xLjE3LS4yLjIyLS4zM2ExIDEgMCAwIDAgMC0uMjR2LS4xNGwuMDctLjA1Wk02LjgzIDIwSDR2LTIuODNsOS45My05LjkzIDIuODMgMi44M0w2LjgzIDIwWk0xOC4xNyA4LjY2bC0yLjgzLTIuODMgMS40Mi0xLjQxIDIuODIgMi44Mi0xLjQxIDEuNDJaIiAvPjwvc3ZnPg==){.astro-qxnybsvq
.astro-4rgy7crp} Edit
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/code-style/guidelines.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[TestClock]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../../testing/testclock/index.html){.astro-u5aomj4k
rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[Dual APIs]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../dual/index.html){.astro-u5aomj4k rel="next"}
:::
:::::::::::::
::::::::::::::
:::::::::::::::::
