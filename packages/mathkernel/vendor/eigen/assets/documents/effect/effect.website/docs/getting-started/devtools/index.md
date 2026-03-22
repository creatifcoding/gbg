:::::::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Devtools {#_top .astro-np5lzwrf}
:::
::::

::::::::::::::::::::::::::::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::::::::::::::::::::::::::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::::::::::::::::::::::::::: sl-markdown-content
Effect provides powerful development tools to enhance your coding
experience and help you write safer, more maintainable code. These tools
integrate directly into your editor, providing real-time feedback,
intelligent refactors, and helpful diagnostics.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Effect LSP

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#effect-lsp){.anchor-link
aria-labelledby="effect-lsp"}
:::

The Effect LSP extends your editor with Effect-specific features. It
analyzes your Effect code and provides intelligent assistance through
diagnostics, quick info, completions, and automated refactors.

It works in editors that supports the standard TypeScript LSP, such as
Code, Cursor, Zed, NVim, etc.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Installation

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#installation){.anchor-link
aria-labelledby="installation"}
:::

To install the Effect Language Service in your project:

1.  Install the package as a development dependency:

    For monorepos, we suggest to install the language service at the
    root level. For single-package projects, install it in the package
    directory.

    ::: {.tablist-wrapper .not-content .astro-5yo7dsk7}
    - [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0yNCA3LjI5NkwwIDcuMjk2TDAgMTUuMjk2TDYuODE2IDE1LjI5Nkw2LjgxNiAxNi43MDRMMTIuMDk2IDE2LjcwNEwxMi4wOTYgMTUuMzkyTDI0IDE1LjM5MkwyNCA3LjI5NlpNNi41OTIgOC43MDRMNi41OTIgMTMuOTg0TDUuMzEyIDEzLjk4NEw1LjMxMiAxMC4xMTJMNCAxMC4xMTJMNCAxMy45ODRMMS4zMTIgMTMuOTg0TDEuMzEyIDguNzA0TDYuNTkyIDguNzA0Wk0xMy4xODQgMTMuOTg0TDEzLjIxNiAxMy45ODRMMTAuNDk2IDEzLjk4NEwxMC40OTYgMTUuMzkyTDcuODA4IDE1LjM5Mkw3LjgwOCA4LjgwMEwxMy4wODggOC44MDBRMTMuMjE2IDEwLjQwMCAxMy4xODQgMTMuOTg0TDEzLjE4NCAxMy45ODRaTTIyLjU5MiA4LjcwNEwyMi41OTIgMTMuOTg0TDIxLjMxMiAxMy45ODRMMjEuMzEyIDEwLjExMkwyMCAxMC4xMTJMMjAgMTMuOTg0TDE4LjU5MiAxMy45ODRMMTguNTkyIDEwLjExMkwxNy4zMTIgMTAuMTEyTDE3LjMxMiAxMy45ODRMMTQuNTkyIDEzLjk4NEwxNC41OTIgOC43MDRMMjIuNTkyIDguNzA0Wk0xMS45MDQgMTIuNzA0TDExLjkwNCAxMC4xMTJMMTAuNTkyIDEwLjExMkwxMC41OTIgMTIuNzA0TDExLjkwNCAxMi43MDRaIiAvPjwvc3ZnPg==){.astro-5yo7dsk7
      .astro-4rgy7crp} npm](index.html#tab-panel-91){#tab-91
      .astro-5yo7dsk7 role="tab" aria-selected="true" tabindex="0"}
    - [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0wIDB2Ny41aDcuNVYwSDBabTguMjUgMHY3LjVoNy40OThWMEg4LjI1Wm04LjI1IDB2Ny41SDI0VjBoLTcuNVpNOC4yNSA4LjI1djcuNWg3LjQ5OHYtNy41SDguMjVabTguMjUgMHY3LjVIMjR2LTcuNWgtNy41Wk0wIDE2LjVWMjRoNy41di03LjVIMFptOC4yNSAwVjI0aDcuNDk4di03LjVIOC4yNVptOC4yNSAwVjI0SDI0di03LjVoLTcuNVoiIC8+PC9zdmc+){.astro-5yo7dsk7
      .astro-4rgy7crp} pnpm](index.html#tab-panel-92){#tab-92
      .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
    - [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik02LjcyOSAyMS41NDVMNi43MjkgMjEuNTQ1UTYuMzkzIDIxLjM3NyA2LjIyNSAyMS4wNDFMNi4yMjUgMjEuMDQxUTYuMDk5IDIwLjkxNSA2LjA3OCAyMC45MTVRNi4wNTcgMjAuOTE1IDUuOTczIDIxLjA0MVE1Ljg4OSAyMS4xNjcgNS44MjYgMjEuNDE5UTUuNzYzIDIxLjY3MSA1LjY3OSAyMS44MzlMNS42NzkgMjEuODM5UTUuMzg1IDIyLjgwNSA0LjgzOSAyMy4xNDFRNC4yOTMgMjMuNDc3IDMuMzI3IDIzLjI2N0wzLjMyNyAyMy4yNjdRMy4wNzUgMjMuMjY3IDIuNTI5IDIzLjAxNUwyLjUyOSAyMy4wMTVRMS43MzEgMjIuNTk1IDIuMTUxIDIxLjgzOUwyLjE1MSAyMS44MzlRMi4xNTEgMjEuNzU1IDIuMjE0IDIxLjYyOVEyLjI3NyAyMS41MDMgMi4yNzcgMjEuNDE5TDIuMjc3IDIxLjQxOVExLjU2MyAyMS40MTkgMS4zNTMgMjAuNzg5TDEuMzUzIDIwLjc4OVEwLjg0OSAxOS40NDUgMS4wMTcgMTguNDE2UTEuMTg1IDE3LjM4NyAyLjE1MSAxNi40MjFMMi4xNTEgMTYuNDIxTDIuMjM1IDE2LjI1M1EyLjQwMyAxNS45NTkgMi40MDMgMTUuNzkxTDIuNDAzIDE1Ljc5MVEyLjQwMyAxNC4zNjMgMi42OTcgMTMuMzEzTDIuNjk3IDEzLjMxM1EzLjAzMyAxMi4wNTMgMy44MzEgMTEuMDQ1TDMuODMxIDExLjA0NVE0LjUwMyAxMC4xNjMgNS40MjcgOS42MTdMNS40MjcgOS42MTdRNS41OTUgOS41MzMgNS42MTYgOS40MDdRNS42MzcgOS4yODEgNS41NTMgOS4wNzFMNS41NTMgOS4wNzFRNC44MzkgOC4xODkgNC42MjkgNi45NzFMNC42MjkgNi45NzFRNC41NDUgNi42MzUgNC42NzEgNi4yMTVMNC42NzEgNi4yMTVRNC43NTUgNS45MjEgNS4wMDcgNS40MTdMNS4wMDcgNS40MTdMNS4xNzUgNS4wMzlRNS40MjcgNC43NDUgNS41NTMgNC43NDVMNS41NTMgNC43NDVRNS45MzEgNC42NjEgNi41NjEgNC4xOTlMNi41NjEgNC4xOTlMNi44NTUgMy45ODlROC4xNTcgMi42NDUgMTAuMTMxIDIuNjQ1TDEwLjEzMSAyLjY0NVExMC4zNDEgMi42NDUgMTAuNDQ2IDIuNTgyUTEwLjU1MSAyLjUxOSAxMC41NTEgMi4zOTNMMTAuNTUxIDIuMzkzUTEwLjcxOSAxLjU5NSAxMS4zMDcgMC44MzlMMTEuMzA3IDAuODM5TDExLjcyNyAwLjQxOVExMS45MzcgMC4yMDkgMTIuMTY4IDAuMjMwUTEyLjM5OSAwLjI1MSAxMi41MjUgMC41NDVMMTIuNTI1IDAuNTQ1UTEyLjc3NyAxLjAwNyAxMy4xNTUgMS44NDdMMTMuMTU1IDEuODQ3TDEzLjQwNyAyLjM5M1ExMy42MTcgMi43MjkgMTMuODI3IDIuNTE5TDEzLjgyNyAyLjUxOVExNC4zMzEgMi4zMDkgMTQuNDk5IDIuMjg4UTE0LjY2NyAyLjI2NyAxNC43NTEgMi4zOTNRMTQuODM1IDIuNTE5IDE1LjAwMyAzLjA2NUwxNS4wMDMgMy4wNjVRMTYuMDExIDcuMjY1IDEzLjcwMSAxMC45MTlMMTMuNzAxIDEwLjkxOVExMy42MTcgMTEuMDQ1IDEzLjQyOCAxMS4zMThRMTMuMjM5IDExLjU5MSAxMy4xNTUgMTEuNzU5UTEzLjA3MSAxMS45MjcgMTMuMDkyIDEyLjA1M1ExMy4xMTMgMTIuMTc5IDEzLjI4MSAxMi4zODlMMTMuMjgxIDEyLjM4OVExNC4xNjMgMTMuMTQ1IDE0Ljc1MSAxNC4xOTVRMTUuMzM5IDE1LjI0NSAxNS41MDcgMTYuNDIxTDE1LjUwNyAxNi40MjFRMTUuNzE3IDE3Ljg5MSAxNS41MDcgMTkuMzE5TDE1LjUwNyAxOS4zMTlRMTUuNDIzIDE5LjY5NyAxNS41MDcgMTkuNzYwUTE1LjU5MSAxOS44MjMgMTUuOTI3IDE5LjczOUwxNS45MjcgMTkuNzM5UTE3LjM5NyAxOS4yNzcgMTguNTMxIDE4LjUyMUwxOC41MzEgMTguNTIxTDE4Ljg2NyAxOC4zNTNRMTkuNjIzIDE3Ljg5MSAyMC4wNDMgMTcuNzIzTDIwLjA0MyAxNy43MjNRMjAuNjczIDE3LjQyOSAyMS4zMDMgMTcuMzQ1TDIxLjMwMyAxNy4zNDVMMjEuNjgxIDE3LjM0NVEyMi4xMDEgMTcuMjYxIDIyLjM3NCAxNy4zNjZRMjIuNjQ3IDE3LjQ3MSAyMi44MzYgMTcuNzIzUTIzLjAyNSAxNy45NzUgMjMuMDI1IDE4LjI2OUwyMy4wMjUgMTguMjY5UTIzLjAyNSAxOC44NTcgMjIuMzUzIDE5LjA2N0wyMi4zNTMgMTkuMDY3UTIwLjYzMSAxOS40MDMgMTguODA0IDIwLjcyNlExNi45NzcgMjIuMDQ5IDE0LjQ1NyAyMi43MjFMMTQuNDU3IDIyLjcyMVExNC4zNzMgMjIuNzIxIDE0LjIwNSAyMi44MDVRMTQuMDM3IDIyLjg4OSAxMy45NTMgMjMuMDE1TDEzLjk1MyAyMy4wMTVRMTMuNjU5IDIzLjIyNSAxMy4zMjMgMjMuMzA5TDEzLjMyMyAyMy4zMDlRMTMuMTEzIDIzLjM5MyAxMi42NTEgMjMuNDM1TDEyLjY1MSAyMy40MzVMMTIuMjMxIDIzLjUxOUwxMS44OTUgMjMuNTYxUTkuMzc1IDIzLjc3MSA4LjAzMSAyMy43NzFMOC4wMzEgMjMuNzcxUTcuMjc1IDIzLjc3MSA2LjcyOSAyMy42NDVMNi43MjkgMjMuNjQ1UTUuOTczIDIzLjM5MyA1LjgwNSAyMi44ODlMNS44MDUgMjIuODg5UTUuNTk1IDIyLjA5MSA2LjIyNSAyMS42NzFMNi4yMjUgMjEuNjcxUTYuMzUxIDIxLjY3MSA2LjUxOSAyMS42MDhRNi42ODcgMjEuNTQ1IDYuNzI5IDIxLjU0NVoiIC8+PC9zdmc+){.astro-5yo7dsk7
      .astro-4rgy7crp} Yarn](index.html#tab-panel-93){#tab-93
      .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
    - [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0xMS45NjYgMjIuMTMyYzYuNjA5IDAgMTEuOTY2LTQuMzI2IDExLjk2Ni05LjY2MSAwLTMuMzA4LTIuMDUxLTYuMjMtNS4yMDQtNy45NjMtMS4yODMtLjcxMy0yLjI5MS0xLjM1My0zLjEzLTEuODg1QzE0LjAxOCAxLjYxOSAxMy4wNDMgMSAxMS45NjYgMWMtMS4wOTQgMC0yLjMyNy43ODMtMy45NTUgMS44MTZhNDkuNzggNDkuNzggMCAwIDEtMi44MDggMS42OTJDMi4wNTEgNi4yNDEgMCA5LjE2MyAwIDEyLjQ3MWMwIDUuMzM1IDUuMzU3IDkuNjYxIDExLjk2NiA5LjY2MVptLTEuMzk3LTE3LjgzYTUuODg1IDUuODg1IDAgMCAwIC40OTctMi40MDNjMC0uMTQ0LjIwMS0uMTg2LjIyOS0uMDI4LjY1NiAyLjc3NS0uOSA0LjE1LTIuMDUxIDQuNjEtLjEyNC4wNDgtLjE5OS0uMTItLjEwMy0uMjA4YTUuNzQ3IDUuNzQ3IDAgMCAwIDEuNDI4LTEuOTcxWm0yLjA1Mi0uMTAyYTUuNzk1IDUuNzk1IDAgMCAwLS43OC0yLjN2LS4wMTVjLS4wNjgtLjEyMy4wODYtLjI2My4xODUtLjE3MiAxLjk1NiAyLjEwNSAxLjMwMyA0LjA1NS41NTQgNS4wMzctLjA4Mi4xMDItLjIyOS0uMDAzLS4xODgtLjEyNmE1LjgzNyA1LjgzNyAwIDAgMCAuMjI5LTIuNDI0Wm0xLjc3MS0uNTU5YTUuNzA5IDUuNzA5IDAgMCAwLTEuNjA3LTEuODAxdi0uMDE0Yy0uMTEyLS4wODUtLjAyNC0uMjc0LjExMy0uMjE4IDIuNTg4IDEuMDg0IDIuNzY2IDMuMTcxIDIuNDUyIDQuMzk1YS4xMTYuMTE2IDAgMCAxLS4xMy4wOS4xMS4xMSAwIDAgMS0uMDcxLS4wNDUuMTE4LjExOCAwIDAgMS0uMDIyLS4wODMgNS44NjMgNS44NjMgMCAwIDAtLjczNS0yLjMyNFpNOS4zMiA0LjJjLS42MTYuNTQ0LTEuMjc5Ljc1OC0yLjA1OC45OTctLjExNiAwLS4xOTQtLjA3OC0uMTU1LS4xOCAxLjc0Ny0uOTA3IDIuMzY5LTEuNjQ1IDIuOTktMi43NzEgMCAwIC4xNTUtLjExNy4xODguMDg1IDAgLjMwMy0uMzQ4IDEuMzI1LS45NjUgMS44NjlabTQuOTMxIDExLjIwNWEyLjk1IDIuOTUgMCAwIDEtLjkzNSAxLjU0OSAyLjE2IDIuMTYgMCAwIDEtMS4yODIuNjE4IDIuMTY3IDIuMTY3IDAgMCAxLTEuMzIzLS42MTggMi45NSAyLjk1IDAgMCAxLS45MjMtMS41NDkuMjQzLjI0MyAwIDAgMSAuMDY0LS4xOTcuMjMuMjMgMCAwIDEgLjE5Mi0uMDY5aDMuOTU0YS4yMjcuMjI3IDAgMCAxIC4yNDQuMTZjLjAxLjAzNS4wMTQuMDcuMDA5LjEwNlptLTUuNDQzLTIuMTdhMS44NSAxLjg1IDAgMCAxLTIuMzc3LS4yNDQgMS45NjkgMS45NjkgMCAwIDEtLjIzMy0yLjQ0Yy4yMDctLjMxOC41MDItLjU2NS44NDYtLjcxMWExLjg0IDEuODQgMCAwIDEgMi4wNTMuNDJjLjI2NC4yNy40NDMuNjE2LjUxNS45OWExLjk4IDEuOTggMCAwIDEtLjEwOCAxLjExOGMtLjE0Mi4zNS0uMzg0LjY1My0uNjk2Ljg2N1ptOC40NzEuMDA1YTEuODUgMS44NSAwIDAgMS0yLjM3NC0uMjUyIDEuOTU2IDEuOTU2IDAgMCAxLS41NDYtMS4zNjJjMC0uMzgzLjExLS43NTguMzE5LTEuMDc2LjIwNy0uMzE4LjUwMi0uNTY2Ljg0Ny0uNzExYTEuODQgMS44NCAwIDAgMSAxLjA5LS4xMDhjLjM2Ni4wNzYuNzAyLjI2MS45NjUuNTMzcy40NC42MTcuNTEyLjk5M2ExLjk4IDEuOTggMCAwIDEtLjExMyAxLjExOCAxLjkyMiAxLjkyMiAwIDAgMS0uNy44NjVaIiAvPjwvc3ZnPg==){.astro-5yo7dsk7
      .astro-4rgy7crp} Bun](index.html#tab-panel-94){#tab-94
      .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
    :::

    :::: {#tab-panel-91 aria-labelledby="tab-91" role="tabpanel"}
    ::: expressive-code
    <figure class="frame is-terminal not-content">
    <pre data-language="sh"><code>npm install @effect/language-service --save-dev</code></pre>
    <div class="copy">
    <div>

    </div>
    </div>
    <figcaption><span class="title"></span><span class="sr-only">Terminal
    window</span></figcaption>
    </figure>
    :::
    ::::

    :::: {#tab-panel-92 aria-labelledby="tab-92" role="tabpanel" hidden=""}
    ::: expressive-code
    <figure class="frame is-terminal not-content">
    <pre data-language="sh"><code>pnpm add -D @effect/language-service</code></pre>
    <div class="copy">
    <div>

    </div>
    </div>
    <figcaption><span class="title"></span><span class="sr-only">Terminal
    window</span></figcaption>
    </figure>
    :::
    ::::

    :::: {#tab-panel-93 aria-labelledby="tab-93" role="tabpanel" hidden=""}
    ::: expressive-code
    <figure class="frame is-terminal not-content">
    <pre data-language="sh"><code>yarn add --dev @effect/language-service</code></pre>
    <div class="copy">
    <div>

    </div>
    </div>
    <figcaption><span class="title"></span><span class="sr-only">Terminal
    window</span></figcaption>
    </figure>
    :::
    ::::

    :::: {#tab-panel-94 aria-labelledby="tab-94" role="tabpanel" hidden=""}
    ::: expressive-code
    <figure class="frame is-terminal not-content">
    <pre data-language="sh"><code>bun add --dev @effect/language-service</code></pre>
    <div class="copy">
    <div>

    </div>
    </div>
    <figcaption><span class="title"></span><span class="sr-only">Terminal
    window</span></figcaption>
    </figure>
    :::
    ::::

2.  Add the plugin to your `tsconfig.json`{dir="auto"}:

    ::: expressive-code
    <figure class="frame has-title not-content">
    <pre data-language="json"><code>1{2  &quot;compilerOptions&quot;: {3    &quot;plugins&quot;: [4      {5        &quot;name&quot;: &quot;@effect/language-service&quot;6      }7    ]8  }9}</code></pre>
    <div class="copy">
    <div>

    </div>
    </div>
    <figcaption><span class="title">tsconfig.json</span></figcaption>
    </figure>
    :::

3.  Ensure your editor uses the workspace TypeScript version:

    This step is critical for the language service to function properly.
    The plugin must run on the TypeScript version installed in your
    project, not the one bundled with your editor.

    ![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9InN0YXJsaWdodC1hc2lkZV9faWNvbiBhc3Ryby00cmd5N2NycCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Ym94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciIgc3R5bGU9Ii0tc2wtaWNvbi1zaXplOiAxZW07Ij48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xLjQ0IDguODU1di0uMDAxbDMuNTI3LTMuNTE2Yy4zNC0uMzQ0LjgwMi0uNTQxIDEuMjg1LS41NDhoNi42NDlsLjk0Ny0uOTQ3YzMuMDctMy4wNyA2LjIwNy0zLjA3MiA3LjYyLTIuODY4YTEuODIxIDEuODIxIDAgMCAxIDEuNTU3IDEuNTU3Yy4yMDQgMS40MTMuMjAzIDQuNTUtMi44NjggNy42MmwtLjk0Ni45NDZ2Ni42NDlhMS44NDUgMS44NDUgMCAwIDEtLjU0OSAxLjI4NmwtMy41MTYgMy41MjhhMS44NDQgMS44NDQgMCAwIDEtMy4xMS0uOTQ0bC0uODU4LTQuMjc1LTQuNTItNC41Mi0yLjMxLS40NjMtMS45NjQtLjM5NEExLjg0NyAxLjg0NyAwIDAgMSAuOTggMTAuNjkzYTEuODQzIDEuODQzIDAgMCAxIC40Ni0xLjgzOFptNS4zNzkgMi4wMTctMy44NzMtLjc3Nkw2LjMyIDYuNzMzaDQuNjM4bC00LjE0IDQuMTRabTguNDAzLTUuNjU1YzIuNDU5LTIuNDYgNC44NTYtMi40NjMgNS44OS0yLjMzLjEzNCAxLjAzNS4xMyAzLjQzMi0yLjMyOSA1Ljg5MWwtNi43MSA2LjcxLTMuNTYxLTMuNTYgNi43MS02LjcxMVptLTEuMzE4IDE1LjgzNy0uNzc2LTMuODczIDQuMTQtNC4xNHY0LjYzOWwtMy4zNjQgMy4zNzRaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIC8+PHBhdGggZD0iTTkuMzE4IDE4LjM0NWEuOTcyLjk3MiAwIDAgMC0xLjg2LS41NjFjLS40ODIgMS40MzUtMS42ODcgMi4yMDQtMi45MzQgMi42MTlhOC4yMiA4LjIyIDAgMCAxLTEuMjMuMzAyYy4wNjItLjM2NS4xNTctLjc5LjMwMy0xLjIyOS40MTUtMS4yNDcgMS4xODQtMi40NTIgMi42Mi0yLjkzNWEuOTcxLjk3MSAwIDEgMC0uNjItMS44NDJjLS4xMi4wNC0uMjM2LjA4NC0uMzUuMTMtMi4wMi44MjgtMy4wMTIgMi41ODgtMy40OTMgNC4wMzNhMTAuMzgzIDEwLjM4MyAwIDAgMC0uNTEgMi44NDVsLS4wMDEuMDE2di4wNjNjMCAuNTM2LjQzNC45NzIuOTcuOTcySDIuMjRhNy4yMSA3LjIxIDAgMCAwIC44NzgtLjA2NWMuNTI3LS4wNjMgMS4yNDgtLjE5IDIuMDItLjQ0NyAxLjQ0NS0uNDggMy4yMDUtMS40NzIgNC4wMzMtMy40OTRhNS44MjggNS44MjggMCAwIDAgLjE0Ny0uNDA3WiIgLz48L3N2Zz4=){.starlight-aside__icon
    .astro-4rgy7crp} Tip

    ::: starlight-aside__content
    In VS Code or Cursor, you can select the workspace TypeScript
    version by opening a TypeScript file, clicking on the TypeScript
    version number in the status bar, and selecting "Use Workspace
    Version".
    :::

4.  You're ready to play!

    Writing the following code in a file.ts inside your project, should
    result in an error diagnostic appearing, saying that Effect's must
    be yielded or assigned to a variable:

    ::: expressive-code
    <figure class="frame not-content">
    <pre data-language="ts"><code>1import { Effect } from &quot;effect&quot;2
    3Effect.log(&quot;Hello world!&quot;)4// ^- should be run or assigned to a variable!</code></pre>
    <div class="copy">
    <div>

    </div>
    </div>
    </figure>
    :::

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Features

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#features){.anchor-link
aria-labelledby="features"}
:::

The Effect Language Service provides a comprehensive set of features to
enhance your development workflow:

::: {.autolink-heading-container .level-h4 tabindex="-1"}
#### Intelligent Quick Info

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#intelligent-quick-info){.anchor-link
aria-labelledby="intelligent-quick-info"}
:::

Hover over Effect values to see extended type information and detailed
insights:

- **Effect Types**: See comprehensive type information for Effect values
- **Generator Parameters**: When hovering over `yield*`{dir="auto"} in
  `Effect.gen`{dir="auto"}, view detailed information about the yielded
  value
- **Layer Composition**: Visualize layer dependencies with interactive
  graphs showing how layers compose together
- **Service Dependencies**: Understand service requirements and their
  relationships at a glance

::: {.autolink-heading-container .level-h4 tabindex="-1"}
#### Real-time Diagnostics

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#real-time-diagnostics){.anchor-link
aria-labelledby="real-time-diagnostics"}
:::

Catch common mistakes and potential issues as you write code:

- **Floating Effects**: Detect Effect values that aren't assigned or
  yielded, preventing silent bugs
- **Layer Issues**: Catch layer requirement leaks and scope violations
  before runtime
- **Unnecessary Code**: Identify redundant `Effect.gen`{dir="auto"} or
  `pipe()`{dir="auto"} calls
- **Error Handling**: Detect misuse of catch functions on Effects that
  cannot fail
- **Version Conflicts**: Detect when multiple Effect versions are
  present in your project

::: {.autolink-heading-container .level-h4 tabindex="-1"}
#### Smart Completions

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#smart-completions){.anchor-link
aria-labelledby="smart-completions"}
:::

Speed up your coding with context-aware suggestions:

- **Generator Boilerplate**: Quickly scaffold `Effect.gen`{dir="auto"}
  functions
- **Scaffolds**: For `Effect.Service`{dir="auto"},
  `Data.TaggedError`{dir="auto"} and friends.
- **Self Parameters**: Auto-complete for `Self`{dir="auto"} parameters
  in service declarations

::: {.autolink-heading-container .level-h4 tabindex="-1"}
#### Powerful Refactors

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#powerful-refactors){.anchor-link
aria-labelledby="powerful-refactors"}
:::

Transform your code with intelligent automated refactors:

- **Async to Effect**: Convert async functions to Effect using
  `gen`{dir="auto"} or `fn`{dir="auto"} syntax
- **Error Generation**: Generate tagged errors from promise-based code
- **Service Accessors**: Automatically implement service accessor
  functions
- **Pipe Conversion**: Transform function calls to pipe syntax
- **Pipe Styles**: Toggle between different pipe style formats
- **Layer Magic**: Automatically compose layers with correct
  dependencies

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Configuration

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#configuration){.anchor-link
aria-labelledby="configuration"}
:::

The Effect LSP provides also lots of configuration options such as
changing severity or disabling diagnostic messages.

To see the full list of options and features, please visit the [README
from the LSP repository](https://github.com/Effect-TS/language-service).

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Build-Time Diagnostics

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#build-time-diagnostics){.anchor-link
aria-labelledby="build-time-diagnostics"}
:::

While LSPs only activate during editing sessions, you may want to catch
diagnostics during your build process.

Usually that's done through linting rules, but since almost all of the
Effect diagnostics relies on types, that would mean enabling type-aware
linting, which means performing type checking again on the project
files.

To solve this, the Effect Language Service allows you to patch your
local TypeScript installation, so diagnostics are emitted while
performing type checking.

To enable it run the following command to modify your local TypeScript
installation:

::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code>effect-language-service patch</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::

To make this automatic for all developers, add it to your
`package.json`{dir="auto"}:

::: expressive-code
<figure class="frame has-title not-content">
<pre data-language="json"><code>1{2  &quot;scripts&quot;: {3    &quot;prepare&quot;: &quot;effect-language-service patch&quot;4  }5}</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title">package.json</span></figcaption>
</figure>
:::

This ensures the language service runs during compilation with the
standard `tsc`{dir="auto"} command.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## VS Code / Cursor Extension {#vs-code--cursor-extension}

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#vs-code--cursor-extension){.anchor-link
aria-labelledby="vs-code--cursor-extension"}
:::

![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9InN0YXJsaWdodC1hc2lkZV9faWNvbiBhc3Ryby00cmd5N2NycCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Ym94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciIgc3R5bGU9Ii0tc2wtaWNvbi1zaXplOiAxZW07Ij48cGF0aCBkPSJNMTIgMTZhMSAxIDAgMSAwIDAgMiAxIDEgMCAwIDAgMC0yWm0xMC42NyAxLjQ3LTguMDUtMTRhMyAzIDAgMCAwLTUuMjQgMGwtOCAxNEEzIDMgMCAwIDAgMy45NCAyMmgxNi4xMmEzIDMgMCAwIDAgMi42MS00LjUzWm0tMS43MyAyYTEgMSAwIDAgMS0uODguNTFIMy45NGExIDEgMCAwIDEtLjg4LS41MSAxIDEgMCAwIDEgMC0xbDgtMTRhMSAxIDAgMCAxIDEuNzggMGw4LjA1IDE0YTEgMSAwIDAgMSAuMDUgMS4wMnYtLjAyWk0xMiA4YTEgMSAwIDAgMC0xIDF2NGExIDEgMCAwIDAgMiAwVjlhMSAxIDAgMCAwLTEtMVoiIC8+PC9zdmc+){.starlight-aside__icon
.astro-4rgy7crp} Caution

::: starlight-aside__content
The editor extension does not include the Effect LSP! Installation of
that should be performed per-project, this allows fine grained control
on when to load it, for which projects and with a version pinned with
your repository lockfile.
:::

The editor extension provides utilities in helping you debug your Effect
applications.

At the moment only Code and Code forks like Cursor are supported.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Installation

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#installation-1){.anchor-link
aria-labelledby="installation-1"}
:::

The extension can be installed by searching directly in your editor
extension page or from the [Code
Marketplace](https://marketplace.visualstudio.com/items?itemName=effectful-tech.effect-vscode)
or the [Open VSX
Marketplace](https://open-vsx.org/extension/effectful-tech/effect-vscode).

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Debugger Features

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#debugger-features){.anchor-link
aria-labelledby="debugger-features"}
:::

With the Effect Extension, you'll find couple of new sections inside the
Debug section of your editor that, once you pause execution, will .

- **Context**: Allows you to inspect the context of the currently paused
  Effect Fiber.
- **Span Stack**: Shows you the stack of telemetry spans that lead you
  into the execution of the currently paused Effect.
- **Fibers**: List all the Effect Fibers running in your application,
  allows you to inspect informations such as interrupt-ability and
  allows to request interruption of them.
- **Breakpoints**: Allows to enable "pause on defect"; letting your
  debugger pause when a Effect Fiber fails with a defect.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Built-in Tracer and Metrics

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#built-in-tracer-and-metrics){.anchor-link
aria-labelledby="built-in-tracer-and-metrics"}
:::

The built-in tracer and metrics view allows to quickly see Effect Spans
and Metrics of your app without spinning up an entire telemetry service.

To enable it, you need to install the following dependency in your
project:

::: {.tablist-wrapper .not-content .astro-5yo7dsk7}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0yNCA3LjI5NkwwIDcuMjk2TDAgMTUuMjk2TDYuODE2IDE1LjI5Nkw2LjgxNiAxNi43MDRMMTIuMDk2IDE2LjcwNEwxMi4wOTYgMTUuMzkyTDI0IDE1LjM5MkwyNCA3LjI5NlpNNi41OTIgOC43MDRMNi41OTIgMTMuOTg0TDUuMzEyIDEzLjk4NEw1LjMxMiAxMC4xMTJMNCAxMC4xMTJMNCAxMy45ODRMMS4zMTIgMTMuOTg0TDEuMzEyIDguNzA0TDYuNTkyIDguNzA0Wk0xMy4xODQgMTMuOTg0TDEzLjIxNiAxMy45ODRMMTAuNDk2IDEzLjk4NEwxMC40OTYgMTUuMzkyTDcuODA4IDE1LjM5Mkw3LjgwOCA4LjgwMEwxMy4wODggOC44MDBRMTMuMjE2IDEwLjQwMCAxMy4xODQgMTMuOTg0TDEzLjE4NCAxMy45ODRaTTIyLjU5MiA4LjcwNEwyMi41OTIgMTMuOTg0TDIxLjMxMiAxMy45ODRMMjEuMzEyIDEwLjExMkwyMCAxMC4xMTJMMjAgMTMuOTg0TDE4LjU5MiAxMy45ODRMMTguNTkyIDEwLjExMkwxNy4zMTIgMTAuMTEyTDE3LjMxMiAxMy45ODRMMTQuNTkyIDEzLjk4NEwxNC41OTIgOC43MDRMMjIuNTkyIDguNzA0Wk0xMS45MDQgMTIuNzA0TDExLjkwNCAxMC4xMTJMMTAuNTkyIDEwLjExMkwxMC41OTIgMTIuNzA0TDExLjkwNCAxMi43MDRaIiAvPjwvc3ZnPg==){.astro-5yo7dsk7
  .astro-4rgy7crp} npm](index.html#tab-panel-95){#tab-95 .astro-5yo7dsk7
  role="tab" aria-selected="true" tabindex="0"}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0wIDB2Ny41aDcuNVYwSDBabTguMjUgMHY3LjVoNy40OThWMEg4LjI1Wm04LjI1IDB2Ny41SDI0VjBoLTcuNVpNOC4yNSA4LjI1djcuNWg3LjQ5OHYtNy41SDguMjVabTguMjUgMHY3LjVIMjR2LTcuNWgtNy41Wk0wIDE2LjVWMjRoNy41di03LjVIMFptOC4yNSAwVjI0aDcuNDk4di03LjVIOC4yNVptOC4yNSAwVjI0SDI0di03LjVoLTcuNVoiIC8+PC9zdmc+){.astro-5yo7dsk7
  .astro-4rgy7crp} pnpm](index.html#tab-panel-96){#tab-96
  .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik02LjcyOSAyMS41NDVMNi43MjkgMjEuNTQ1UTYuMzkzIDIxLjM3NyA2LjIyNSAyMS4wNDFMNi4yMjUgMjEuMDQxUTYuMDk5IDIwLjkxNSA2LjA3OCAyMC45MTVRNi4wNTcgMjAuOTE1IDUuOTczIDIxLjA0MVE1Ljg4OSAyMS4xNjcgNS44MjYgMjEuNDE5UTUuNzYzIDIxLjY3MSA1LjY3OSAyMS44MzlMNS42NzkgMjEuODM5UTUuMzg1IDIyLjgwNSA0LjgzOSAyMy4xNDFRNC4yOTMgMjMuNDc3IDMuMzI3IDIzLjI2N0wzLjMyNyAyMy4yNjdRMy4wNzUgMjMuMjY3IDIuNTI5IDIzLjAxNUwyLjUyOSAyMy4wMTVRMS43MzEgMjIuNTk1IDIuMTUxIDIxLjgzOUwyLjE1MSAyMS44MzlRMi4xNTEgMjEuNzU1IDIuMjE0IDIxLjYyOVEyLjI3NyAyMS41MDMgMi4yNzcgMjEuNDE5TDIuMjc3IDIxLjQxOVExLjU2MyAyMS40MTkgMS4zNTMgMjAuNzg5TDEuMzUzIDIwLjc4OVEwLjg0OSAxOS40NDUgMS4wMTcgMTguNDE2UTEuMTg1IDE3LjM4NyAyLjE1MSAxNi40MjFMMi4xNTEgMTYuNDIxTDIuMjM1IDE2LjI1M1EyLjQwMyAxNS45NTkgMi40MDMgMTUuNzkxTDIuNDAzIDE1Ljc5MVEyLjQwMyAxNC4zNjMgMi42OTcgMTMuMzEzTDIuNjk3IDEzLjMxM1EzLjAzMyAxMi4wNTMgMy44MzEgMTEuMDQ1TDMuODMxIDExLjA0NVE0LjUwMyAxMC4xNjMgNS40MjcgOS42MTdMNS40MjcgOS42MTdRNS41OTUgOS41MzMgNS42MTYgOS40MDdRNS42MzcgOS4yODEgNS41NTMgOS4wNzFMNS41NTMgOS4wNzFRNC44MzkgOC4xODkgNC42MjkgNi45NzFMNC42MjkgNi45NzFRNC41NDUgNi42MzUgNC42NzEgNi4yMTVMNC42NzEgNi4yMTVRNC43NTUgNS45MjEgNS4wMDcgNS40MTdMNS4wMDcgNS40MTdMNS4xNzUgNS4wMzlRNS40MjcgNC43NDUgNS41NTMgNC43NDVMNS41NTMgNC43NDVRNS45MzEgNC42NjEgNi41NjEgNC4xOTlMNi41NjEgNC4xOTlMNi44NTUgMy45ODlROC4xNTcgMi42NDUgMTAuMTMxIDIuNjQ1TDEwLjEzMSAyLjY0NVExMC4zNDEgMi42NDUgMTAuNDQ2IDIuNTgyUTEwLjU1MSAyLjUxOSAxMC41NTEgMi4zOTNMMTAuNTUxIDIuMzkzUTEwLjcxOSAxLjU5NSAxMS4zMDcgMC44MzlMMTEuMzA3IDAuODM5TDExLjcyNyAwLjQxOVExMS45MzcgMC4yMDkgMTIuMTY4IDAuMjMwUTEyLjM5OSAwLjI1MSAxMi41MjUgMC41NDVMMTIuNTI1IDAuNTQ1UTEyLjc3NyAxLjAwNyAxMy4xNTUgMS44NDdMMTMuMTU1IDEuODQ3TDEzLjQwNyAyLjM5M1ExMy42MTcgMi43MjkgMTMuODI3IDIuNTE5TDEzLjgyNyAyLjUxOVExNC4zMzEgMi4zMDkgMTQuNDk5IDIuMjg4UTE0LjY2NyAyLjI2NyAxNC43NTEgMi4zOTNRMTQuODM1IDIuNTE5IDE1LjAwMyAzLjA2NUwxNS4wMDMgMy4wNjVRMTYuMDExIDcuMjY1IDEzLjcwMSAxMC45MTlMMTMuNzAxIDEwLjkxOVExMy42MTcgMTEuMDQ1IDEzLjQyOCAxMS4zMThRMTMuMjM5IDExLjU5MSAxMy4xNTUgMTEuNzU5UTEzLjA3MSAxMS45MjcgMTMuMDkyIDEyLjA1M1ExMy4xMTMgMTIuMTc5IDEzLjI4MSAxMi4zODlMMTMuMjgxIDEyLjM4OVExNC4xNjMgMTMuMTQ1IDE0Ljc1MSAxNC4xOTVRMTUuMzM5IDE1LjI0NSAxNS41MDcgMTYuNDIxTDE1LjUwNyAxNi40MjFRMTUuNzE3IDE3Ljg5MSAxNS41MDcgMTkuMzE5TDE1LjUwNyAxOS4zMTlRMTUuNDIzIDE5LjY5NyAxNS41MDcgMTkuNzYwUTE1LjU5MSAxOS44MjMgMTUuOTI3IDE5LjczOUwxNS45MjcgMTkuNzM5UTE3LjM5NyAxOS4yNzcgMTguNTMxIDE4LjUyMUwxOC41MzEgMTguNTIxTDE4Ljg2NyAxOC4zNTNRMTkuNjIzIDE3Ljg5MSAyMC4wNDMgMTcuNzIzTDIwLjA0MyAxNy43MjNRMjAuNjczIDE3LjQyOSAyMS4zMDMgMTcuMzQ1TDIxLjMwMyAxNy4zNDVMMjEuNjgxIDE3LjM0NVEyMi4xMDEgMTcuMjYxIDIyLjM3NCAxNy4zNjZRMjIuNjQ3IDE3LjQ3MSAyMi44MzYgMTcuNzIzUTIzLjAyNSAxNy45NzUgMjMuMDI1IDE4LjI2OUwyMy4wMjUgMTguMjY5UTIzLjAyNSAxOC44NTcgMjIuMzUzIDE5LjA2N0wyMi4zNTMgMTkuMDY3UTIwLjYzMSAxOS40MDMgMTguODA0IDIwLjcyNlExNi45NzcgMjIuMDQ5IDE0LjQ1NyAyMi43MjFMMTQuNDU3IDIyLjcyMVExNC4zNzMgMjIuNzIxIDE0LjIwNSAyMi44MDVRMTQuMDM3IDIyLjg4OSAxMy45NTMgMjMuMDE1TDEzLjk1MyAyMy4wMTVRMTMuNjU5IDIzLjIyNSAxMy4zMjMgMjMuMzA5TDEzLjMyMyAyMy4zMDlRMTMuMTEzIDIzLjM5MyAxMi42NTEgMjMuNDM1TDEyLjY1MSAyMy40MzVMMTIuMjMxIDIzLjUxOUwxMS44OTUgMjMuNTYxUTkuMzc1IDIzLjc3MSA4LjAzMSAyMy43NzFMOC4wMzEgMjMuNzcxUTcuMjc1IDIzLjc3MSA2LjcyOSAyMy42NDVMNi43MjkgMjMuNjQ1UTUuOTczIDIzLjM5MyA1LjgwNSAyMi44ODlMNS44MDUgMjIuODg5UTUuNTk1IDIyLjA5MSA2LjIyNSAyMS42NzFMNi4yMjUgMjEuNjcxUTYuMzUxIDIxLjY3MSA2LjUxOSAyMS42MDhRNi42ODcgMjEuNTQ1IDYuNzI5IDIxLjU0NVoiIC8+PC9zdmc+){.astro-5yo7dsk7
  .astro-4rgy7crp} Yarn](index.html#tab-panel-97){#tab-97
  .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0xMS45NjYgMjIuMTMyYzYuNjA5IDAgMTEuOTY2LTQuMzI2IDExLjk2Ni05LjY2MSAwLTMuMzA4LTIuMDUxLTYuMjMtNS4yMDQtNy45NjMtMS4yODMtLjcxMy0yLjI5MS0xLjM1My0zLjEzLTEuODg1QzE0LjAxOCAxLjYxOSAxMy4wNDMgMSAxMS45NjYgMWMtMS4wOTQgMC0yLjMyNy43ODMtMy45NTUgMS44MTZhNDkuNzggNDkuNzggMCAwIDEtMi44MDggMS42OTJDMi4wNTEgNi4yNDEgMCA5LjE2MyAwIDEyLjQ3MWMwIDUuMzM1IDUuMzU3IDkuNjYxIDExLjk2NiA5LjY2MVptLTEuMzk3LTE3LjgzYTUuODg1IDUuODg1IDAgMCAwIC40OTctMi40MDNjMC0uMTQ0LjIwMS0uMTg2LjIyOS0uMDI4LjY1NiAyLjc3NS0uOSA0LjE1LTIuMDUxIDQuNjEtLjEyNC4wNDgtLjE5OS0uMTItLjEwMy0uMjA4YTUuNzQ3IDUuNzQ3IDAgMCAwIDEuNDI4LTEuOTcxWm0yLjA1Mi0uMTAyYTUuNzk1IDUuNzk1IDAgMCAwLS43OC0yLjN2LS4wMTVjLS4wNjgtLjEyMy4wODYtLjI2My4xODUtLjE3MiAxLjk1NiAyLjEwNSAxLjMwMyA0LjA1NS41NTQgNS4wMzctLjA4Mi4xMDItLjIyOS0uMDAzLS4xODgtLjEyNmE1LjgzNyA1LjgzNyAwIDAgMCAuMjI5LTIuNDI0Wm0xLjc3MS0uNTU5YTUuNzA5IDUuNzA5IDAgMCAwLTEuNjA3LTEuODAxdi0uMDE0Yy0uMTEyLS4wODUtLjAyNC0uMjc0LjExMy0uMjE4IDIuNTg4IDEuMDg0IDIuNzY2IDMuMTcxIDIuNDUyIDQuMzk1YS4xMTYuMTE2IDAgMCAxLS4xMy4wOS4xMS4xMSAwIDAgMS0uMDcxLS4wNDUuMTE4LjExOCAwIDAgMS0uMDIyLS4wODMgNS44NjMgNS44NjMgMCAwIDAtLjczNS0yLjMyNFpNOS4zMiA0LjJjLS42MTYuNTQ0LTEuMjc5Ljc1OC0yLjA1OC45OTctLjExNiAwLS4xOTQtLjA3OC0uMTU1LS4xOCAxLjc0Ny0uOTA3IDIuMzY5LTEuNjQ1IDIuOTktMi43NzEgMCAwIC4xNTUtLjExNy4xODguMDg1IDAgLjMwMy0uMzQ4IDEuMzI1LS45NjUgMS44NjlabTQuOTMxIDExLjIwNWEyLjk1IDIuOTUgMCAwIDEtLjkzNSAxLjU0OSAyLjE2IDIuMTYgMCAwIDEtMS4yODIuNjE4IDIuMTY3IDIuMTY3IDAgMCAxLTEuMzIzLS42MTggMi45NSAyLjk1IDAgMCAxLS45MjMtMS41NDkuMjQzLjI0MyAwIDAgMSAuMDY0LS4xOTcuMjMuMjMgMCAwIDEgLjE5Mi0uMDY5aDMuOTU0YS4yMjcuMjI3IDAgMCAxIC4yNDQuMTZjLjAxLjAzNS4wMTQuMDcuMDA5LjEwNlptLTUuNDQzLTIuMTdhMS44NSAxLjg1IDAgMCAxLTIuMzc3LS4yNDQgMS45NjkgMS45NjkgMCAwIDEtLjIzMy0yLjQ0Yy4yMDctLjMxOC41MDItLjU2NS44NDYtLjcxMWExLjg0IDEuODQgMCAwIDEgMi4wNTMuNDJjLjI2NC4yNy40NDMuNjE2LjUxNS45OWExLjk4IDEuOTggMCAwIDEtLjEwOCAxLjExOGMtLjE0Mi4zNS0uMzg0LjY1My0uNjk2Ljg2N1ptOC40NzEuMDA1YTEuODUgMS44NSAwIDAgMS0yLjM3NC0uMjUyIDEuOTU2IDEuOTU2IDAgMCAxLS41NDYtMS4zNjJjMC0uMzgzLjExLS43NTguMzE5LTEuMDc2LjIwNy0uMzE4LjUwMi0uNTY2Ljg0Ny0uNzExYTEuODQgMS44NCAwIDAgMSAxLjA5LS4xMDhjLjM2Ni4wNzYuNzAyLjI2MS45NjUuNTMzcy40NC42MTcuNTEyLjk5M2ExLjk4IDEuOTggMCAwIDEtLjExMyAxLjExOCAxLjkyMiAxLjkyMiAwIDAgMS0uNy44NjVaIiAvPjwvc3ZnPg==){.astro-5yo7dsk7
  .astro-4rgy7crp} Bun](index.html#tab-panel-98){#tab-98 .astro-5yo7dsk7
  role="tab" aria-selected="false" tabindex="-1"}
:::

:::: {#tab-panel-95 aria-labelledby="tab-95" role="tabpanel"}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code>npm install @effect/experimental</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

:::: {#tab-panel-96 aria-labelledby="tab-96" role="tabpanel" hidden=""}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code>pnpm install @effect/experimental</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

:::: {#tab-panel-97 aria-labelledby="tab-97" role="tabpanel" hidden=""}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code>yarn add @effect/experimental</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

:::: {#tab-panel-98 aria-labelledby="tab-98" role="tabpanel" hidden=""}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code>bun add @effect/experimental</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

You can then import and use the DevTools module in your Effect app:

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>1import { DevTools } from &quot;@effect/experimental&quot;2import { NodeRuntime, NodeSocket } from &quot;@effect/platform-node&quot;3import { Effect, Layer } from &quot;effect&quot;4
5const program = Effect.log(&quot;Hello!&quot;).pipe(6  Effect.delay(2000),7  Effect.withSpan(&quot;Hi&quot;, { attributes: { foo: &quot;bar&quot; } }),8  Effect.forever,9)10const DevToolsLive = DevTools.layer()11
12program.pipe(Effect.provide(DevToolsLive), NodeRuntime.runMain)</code></pre>
<div class="copy">
<div>

</div>
</div>
</figure>
:::

If you are using `@effect/opentelemetry`{dir="auto"} in your project,
then it is important that you provide the DevTools layer before your
tracing layers, so the tracer is patched correctly.

Now start both your editor and your app. Inside the Effect panel, in the
clients section you'll see a newly connected client.

In the bottom of your editor, near your terminal, a new tab "Effect
Tracer" will appear as well, showing visually your spans as they happen
in real time.
:::::::::::::::::::::::::::::

::: {.meta .sl-flex .astro-lfnsiwle}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXF4bnlic3ZxIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuMmVtOyI+PHBhdGggZD0iTTIyIDcuMjRhMSAxIDAgMCAwLS4yOS0uNzFsLTQuMjQtNC4yNGExIDEgMCAwIDAtMS4xLS4yMiAxIDEgMCAwIDAtLjMyLjIybC0yLjgzIDIuODNMMi4yOSAxNi4wNWExIDEgMCAwIDAtLjI5LjcxVjIxYTEgMSAwIDAgMCAxIDFoNC4yNGExIDEgMCAwIDAgLjc2LS4yOWwxMC44Ny0xMC45M0wyMS43MSA4Yy4xLS4xLjE3LS4yLjIyLS4zM2ExIDEgMCAwIDAgMC0uMjR2LS4xNGwuMDctLjA1Wk02LjgzIDIwSDR2LTIuODNsOS45My05LjkzIDIuODMgMi44M0w2LjgzIDIwWk0xOC4xNyA4LjY2bC0yLjgzLTIuODMgMS40Mi0xLjQxIDIuODIgMi44Mi0xLjQxIDEuNDJaIiAvPjwvc3ZnPg==){.astro-qxnybsvq
.astro-4rgy7crp} Edit
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/getting-started/devtools.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Installation]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../installation/index.html){.astro-u5aomj4k
rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[Create Effect App]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../create-effect-app/index.html){.astro-u5aomj4k
rel="next"}
:::
::::::::::::::::::::::::::::::::
:::::::::::::::::::::::::::::::::
::::::::::::::::::::::::::::::::::::
