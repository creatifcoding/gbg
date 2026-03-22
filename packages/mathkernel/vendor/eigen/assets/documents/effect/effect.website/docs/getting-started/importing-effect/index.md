::::::::::::::::::::::::::::::: {.astro-f44q3k6v role="main" pagefind-body="" lang="en" dir="ltr"}
:::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
# Importing Effect {#_top .astro-np5lzwrf}
:::
::::

:::::::::::::::::::::::::::: {.content-panel .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
::::::::::::::::::::::::::: {.sl-container .astro-2wc2n45z style="--borderTop: initial;--pageTitleDisplay: block;"}
:::::::::::::::::::::::: sl-markdown-content
If you're just getting started, you might feel overwhelmed by the
variety of modules and functions that Effect offers.

However, rest assured that you don't need to worry about all of them
right away.

This page will provide a simple introduction on how to import modules
and functions, and explain that installing the `effect`{dir="auto"}
package is generally all you need to begin.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Installing Effect

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#installing-effect){.anchor-link
aria-labelledby="installing-effect"}
:::

If you haven't already installed the `effect`{dir="auto"} package, you
can do so by running the following command in your terminal:

::: {.tablist-wrapper .not-content .astro-5yo7dsk7}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0yNCA3LjI5NkwwIDcuMjk2TDAgMTUuMjk2TDYuODE2IDE1LjI5Nkw2LjgxNiAxNi43MDRMMTIuMDk2IDE2LjcwNEwxMi4wOTYgMTUuMzkyTDI0IDE1LjM5MkwyNCA3LjI5NlpNNi41OTIgOC43MDRMNi41OTIgMTMuOTg0TDUuMzEyIDEzLjk4NEw1LjMxMiAxMC4xMTJMNCAxMC4xMTJMNCAxMy45ODRMMS4zMTIgMTMuOTg0TDEuMzEyIDguNzA0TDYuNTkyIDguNzA0Wk0xMy4xODQgMTMuOTg0TDEzLjIxNiAxMy45ODRMMTAuNDk2IDEzLjk4NEwxMC40OTYgMTUuMzkyTDcuODA4IDE1LjM5Mkw3LjgwOCA4LjgwMEwxMy4wODggOC44MDBRMTMuMjE2IDEwLjQwMCAxMy4xODQgMTMuOTg0TDEzLjE4NCAxMy45ODRaTTIyLjU5MiA4LjcwNEwyMi41OTIgMTMuOTg0TDIxLjMxMiAxMy45ODRMMjEuMzEyIDEwLjExMkwyMCAxMC4xMTJMMjAgMTMuOTg0TDE4LjU5MiAxMy45ODRMMTguNTkyIDEwLjExMkwxNy4zMTIgMTAuMTEyTDE3LjMxMiAxMy45ODRMMTQuNTkyIDEzLjk4NEwxNC41OTIgOC43MDRMMjIuNTkyIDguNzA0Wk0xMS45MDQgMTIuNzA0TDExLjkwNCAxMC4xMTJMMTAuNTkyIDEwLjExMkwxMC41OTIgMTIuNzA0TDExLjkwNCAxMi43MDRaIiAvPjwvc3ZnPg==){.astro-5yo7dsk7
  .astro-4rgy7crp} npm](index.html#tab-panel-99){#tab-99 .astro-5yo7dsk7
  role="tab" aria-selected="true" tabindex="0"}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0wIDB2Ny41aDcuNVYwSDBabTguMjUgMHY3LjVoNy40OThWMEg4LjI1Wm04LjI1IDB2Ny41SDI0VjBoLTcuNVpNOC4yNSA4LjI1djcuNWg3LjQ5OHYtNy41SDguMjVabTguMjUgMHY3LjVIMjR2LTcuNWgtNy41Wk0wIDE2LjVWMjRoNy41di03LjVIMFptOC4yNSAwVjI0aDcuNDk4di03LjVIOC4yNVptOC4yNSAwVjI0SDI0di03LjVoLTcuNVoiIC8+PC9zdmc+){.astro-5yo7dsk7
  .astro-4rgy7crp} pnpm](index.html#tab-panel-100){#tab-100
  .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik02LjcyOSAyMS41NDVMNi43MjkgMjEuNTQ1UTYuMzkzIDIxLjM3NyA2LjIyNSAyMS4wNDFMNi4yMjUgMjEuMDQxUTYuMDk5IDIwLjkxNSA2LjA3OCAyMC45MTVRNi4wNTcgMjAuOTE1IDUuOTczIDIxLjA0MVE1Ljg4OSAyMS4xNjcgNS44MjYgMjEuNDE5UTUuNzYzIDIxLjY3MSA1LjY3OSAyMS44MzlMNS42NzkgMjEuODM5UTUuMzg1IDIyLjgwNSA0LjgzOSAyMy4xNDFRNC4yOTMgMjMuNDc3IDMuMzI3IDIzLjI2N0wzLjMyNyAyMy4yNjdRMy4wNzUgMjMuMjY3IDIuNTI5IDIzLjAxNUwyLjUyOSAyMy4wMTVRMS43MzEgMjIuNTk1IDIuMTUxIDIxLjgzOUwyLjE1MSAyMS44MzlRMi4xNTEgMjEuNzU1IDIuMjE0IDIxLjYyOVEyLjI3NyAyMS41MDMgMi4yNzcgMjEuNDE5TDIuMjc3IDIxLjQxOVExLjU2MyAyMS40MTkgMS4zNTMgMjAuNzg5TDEuMzUzIDIwLjc4OVEwLjg0OSAxOS40NDUgMS4wMTcgMTguNDE2UTEuMTg1IDE3LjM4NyAyLjE1MSAxNi40MjFMMi4xNTEgMTYuNDIxTDIuMjM1IDE2LjI1M1EyLjQwMyAxNS45NTkgMi40MDMgMTUuNzkxTDIuNDAzIDE1Ljc5MVEyLjQwMyAxNC4zNjMgMi42OTcgMTMuMzEzTDIuNjk3IDEzLjMxM1EzLjAzMyAxMi4wNTMgMy44MzEgMTEuMDQ1TDMuODMxIDExLjA0NVE0LjUwMyAxMC4xNjMgNS40MjcgOS42MTdMNS40MjcgOS42MTdRNS41OTUgOS41MzMgNS42MTYgOS40MDdRNS42MzcgOS4yODEgNS41NTMgOS4wNzFMNS41NTMgOS4wNzFRNC44MzkgOC4xODkgNC42MjkgNi45NzFMNC42MjkgNi45NzFRNC41NDUgNi42MzUgNC42NzEgNi4yMTVMNC42NzEgNi4yMTVRNC43NTUgNS45MjEgNS4wMDcgNS40MTdMNS4wMDcgNS40MTdMNS4xNzUgNS4wMzlRNS40MjcgNC43NDUgNS41NTMgNC43NDVMNS41NTMgNC43NDVRNS45MzEgNC42NjEgNi41NjEgNC4xOTlMNi41NjEgNC4xOTlMNi44NTUgMy45ODlROC4xNTcgMi42NDUgMTAuMTMxIDIuNjQ1TDEwLjEzMSAyLjY0NVExMC4zNDEgMi42NDUgMTAuNDQ2IDIuNTgyUTEwLjU1MSAyLjUxOSAxMC41NTEgMi4zOTNMMTAuNTUxIDIuMzkzUTEwLjcxOSAxLjU5NSAxMS4zMDcgMC44MzlMMTEuMzA3IDAuODM5TDExLjcyNyAwLjQxOVExMS45MzcgMC4yMDkgMTIuMTY4IDAuMjMwUTEyLjM5OSAwLjI1MSAxMi41MjUgMC41NDVMMTIuNTI1IDAuNTQ1UTEyLjc3NyAxLjAwNyAxMy4xNTUgMS44NDdMMTMuMTU1IDEuODQ3TDEzLjQwNyAyLjM5M1ExMy42MTcgMi43MjkgMTMuODI3IDIuNTE5TDEzLjgyNyAyLjUxOVExNC4zMzEgMi4zMDkgMTQuNDk5IDIuMjg4UTE0LjY2NyAyLjI2NyAxNC43NTEgMi4zOTNRMTQuODM1IDIuNTE5IDE1LjAwMyAzLjA2NUwxNS4wMDMgMy4wNjVRMTYuMDExIDcuMjY1IDEzLjcwMSAxMC45MTlMMTMuNzAxIDEwLjkxOVExMy42MTcgMTEuMDQ1IDEzLjQyOCAxMS4zMThRMTMuMjM5IDExLjU5MSAxMy4xNTUgMTEuNzU5UTEzLjA3MSAxMS45MjcgMTMuMDkyIDEyLjA1M1ExMy4xMTMgMTIuMTc5IDEzLjI4MSAxMi4zODlMMTMuMjgxIDEyLjM4OVExNC4xNjMgMTMuMTQ1IDE0Ljc1MSAxNC4xOTVRMTUuMzM5IDE1LjI0NSAxNS41MDcgMTYuNDIxTDE1LjUwNyAxNi40MjFRMTUuNzE3IDE3Ljg5MSAxNS41MDcgMTkuMzE5TDE1LjUwNyAxOS4zMTlRMTUuNDIzIDE5LjY5NyAxNS41MDcgMTkuNzYwUTE1LjU5MSAxOS44MjMgMTUuOTI3IDE5LjczOUwxNS45MjcgMTkuNzM5UTE3LjM5NyAxOS4yNzcgMTguNTMxIDE4LjUyMUwxOC41MzEgMTguNTIxTDE4Ljg2NyAxOC4zNTNRMTkuNjIzIDE3Ljg5MSAyMC4wNDMgMTcuNzIzTDIwLjA0MyAxNy43MjNRMjAuNjczIDE3LjQyOSAyMS4zMDMgMTcuMzQ1TDIxLjMwMyAxNy4zNDVMMjEuNjgxIDE3LjM0NVEyMi4xMDEgMTcuMjYxIDIyLjM3NCAxNy4zNjZRMjIuNjQ3IDE3LjQ3MSAyMi44MzYgMTcuNzIzUTIzLjAyNSAxNy45NzUgMjMuMDI1IDE4LjI2OUwyMy4wMjUgMTguMjY5UTIzLjAyNSAxOC44NTcgMjIuMzUzIDE5LjA2N0wyMi4zNTMgMTkuMDY3UTIwLjYzMSAxOS40MDMgMTguODA0IDIwLjcyNlExNi45NzcgMjIuMDQ5IDE0LjQ1NyAyMi43MjFMMTQuNDU3IDIyLjcyMVExNC4zNzMgMjIuNzIxIDE0LjIwNSAyMi44MDVRMTQuMDM3IDIyLjg4OSAxMy45NTMgMjMuMDE1TDEzLjk1MyAyMy4wMTVRMTMuNjU5IDIzLjIyNSAxMy4zMjMgMjMuMzA5TDEzLjMyMyAyMy4zMDlRMTMuMTEzIDIzLjM5MyAxMi42NTEgMjMuNDM1TDEyLjY1MSAyMy40MzVMMTIuMjMxIDIzLjUxOUwxMS44OTUgMjMuNTYxUTkuMzc1IDIzLjc3MSA4LjAzMSAyMy43NzFMOC4wMzEgMjMuNzcxUTcuMjc1IDIzLjc3MSA2LjcyOSAyMy42NDVMNi43MjkgMjMuNjQ1UTUuOTczIDIzLjM5MyA1LjgwNSAyMi44ODlMNS44MDUgMjIuODg5UTUuNTk1IDIyLjA5MSA2LjIyNSAyMS42NzFMNi4yMjUgMjEuNjcxUTYuMzUxIDIxLjY3MSA2LjUxOSAyMS42MDhRNi42ODcgMjEuNTQ1IDYuNzI5IDIxLjU0NVoiIC8+PC9zdmc+){.astro-5yo7dsk7
  .astro-4rgy7crp} Yarn](index.html#tab-panel-101){#tab-101
  .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0xMS45NjYgMjIuMTMyYzYuNjA5IDAgMTEuOTY2LTQuMzI2IDExLjk2Ni05LjY2MSAwLTMuMzA4LTIuMDUxLTYuMjMtNS4yMDQtNy45NjMtMS4yODMtLjcxMy0yLjI5MS0xLjM1My0zLjEzLTEuODg1QzE0LjAxOCAxLjYxOSAxMy4wNDMgMSAxMS45NjYgMWMtMS4wOTQgMC0yLjMyNy43ODMtMy45NTUgMS44MTZhNDkuNzggNDkuNzggMCAwIDEtMi44MDggMS42OTJDMi4wNTEgNi4yNDEgMCA5LjE2MyAwIDEyLjQ3MWMwIDUuMzM1IDUuMzU3IDkuNjYxIDExLjk2NiA5LjY2MVptLTEuMzk3LTE3LjgzYTUuODg1IDUuODg1IDAgMCAwIC40OTctMi40MDNjMC0uMTQ0LjIwMS0uMTg2LjIyOS0uMDI4LjY1NiAyLjc3NS0uOSA0LjE1LTIuMDUxIDQuNjEtLjEyNC4wNDgtLjE5OS0uMTItLjEwMy0uMjA4YTUuNzQ3IDUuNzQ3IDAgMCAwIDEuNDI4LTEuOTcxWm0yLjA1Mi0uMTAyYTUuNzk1IDUuNzk1IDAgMCAwLS43OC0yLjN2LS4wMTVjLS4wNjgtLjEyMy4wODYtLjI2My4xODUtLjE3MiAxLjk1NiAyLjEwNSAxLjMwMyA0LjA1NS41NTQgNS4wMzctLjA4Mi4xMDItLjIyOS0uMDAzLS4xODgtLjEyNmE1LjgzNyA1LjgzNyAwIDAgMCAuMjI5LTIuNDI0Wm0xLjc3MS0uNTU5YTUuNzA5IDUuNzA5IDAgMCAwLTEuNjA3LTEuODAxdi0uMDE0Yy0uMTEyLS4wODUtLjAyNC0uMjc0LjExMy0uMjE4IDIuNTg4IDEuMDg0IDIuNzY2IDMuMTcxIDIuNDUyIDQuMzk1YS4xMTYuMTE2IDAgMCAxLS4xMy4wOS4xMS4xMSAwIDAgMS0uMDcxLS4wNDUuMTE4LjExOCAwIDAgMS0uMDIyLS4wODMgNS44NjMgNS44NjMgMCAwIDAtLjczNS0yLjMyNFpNOS4zMiA0LjJjLS42MTYuNTQ0LTEuMjc5Ljc1OC0yLjA1OC45OTctLjExNiAwLS4xOTQtLjA3OC0uMTU1LS4xOCAxLjc0Ny0uOTA3IDIuMzY5LTEuNjQ1IDIuOTktMi43NzEgMCAwIC4xNTUtLjExNy4xODguMDg1IDAgLjMwMy0uMzQ4IDEuMzI1LS45NjUgMS44NjlabTQuOTMxIDExLjIwNWEyLjk1IDIuOTUgMCAwIDEtLjkzNSAxLjU0OSAyLjE2IDIuMTYgMCAwIDEtMS4yODIuNjE4IDIuMTY3IDIuMTY3IDAgMCAxLTEuMzIzLS42MTggMi45NSAyLjk1IDAgMCAxLS45MjMtMS41NDkuMjQzLjI0MyAwIDAgMSAuMDY0LS4xOTcuMjMuMjMgMCAwIDEgLjE5Mi0uMDY5aDMuOTU0YS4yMjcuMjI3IDAgMCAxIC4yNDQuMTZjLjAxLjAzNS4wMTQuMDcuMDA5LjEwNlptLTUuNDQzLTIuMTdhMS44NSAxLjg1IDAgMCAxLTIuMzc3LS4yNDQgMS45NjkgMS45NjkgMCAwIDEtLjIzMy0yLjQ0Yy4yMDctLjMxOC41MDItLjU2NS44NDYtLjcxMWExLjg0IDEuODQgMCAwIDEgMi4wNTMuNDJjLjI2NC4yNy40NDMuNjE2LjUxNS45OWExLjk4IDEuOTggMCAwIDEtLjEwOCAxLjExOGMtLjE0Mi4zNS0uMzg0LjY1My0uNjk2Ljg2N1ptOC40NzEuMDA1YTEuODUgMS44NSAwIDAgMS0yLjM3NC0uMjUyIDEuOTU2IDEuOTU2IDAgMCAxLS41NDYtMS4zNjJjMC0uMzgzLjExLS43NTguMzE5LTEuMDc2LjIwNy0uMzE4LjUwMi0uNTY2Ljg0Ny0uNzExYTEuODQgMS44NCAwIDAgMSAxLjA5LS4xMDhjLjM2Ni4wNzYuNzAyLjI2MS45NjUuNTMzcy40NC42MTcuNTEyLjk5M2ExLjk4IDEuOTggMCAwIDEtLjExMyAxLjExOCAxLjkyMiAxLjkyMiAwIDAgMS0uNy44NjVaIiAvPjwvc3ZnPg==){.astro-5yo7dsk7
  .astro-4rgy7crp} Bun](index.html#tab-panel-102){#tab-102
  .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
- [![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLTV5bzdkc2s3IGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDFlbTsiPjxwYXRoIGQ9Ik0xMiAwYTEyIDEyIDAgMSAxIDAgMjQgMTIgMTIgMCAwIDEgMC0yNG0tLjQ3IDYuOGMtMy40OSAwLTYuMiAyLjE5LTYuMiA0LjkyIDAgMi41OCAyLjUgNC4yMyA2LjM3IDQuMTVoLjEybC40Mi0uMDItLjEuMjh2LjAzbC4wOS4yMnYuMDNsLjAyLjA0LjAyLjA3LjAyLjA0LjAxLjA1LjAyLjA1LjAyLjA3LjAyLjA4LjAyLjA2LjAyLjA4LjAyLjA5LjAyLjA5LjAzLjEuMDEuMDYuMDMuMS4wMi4xLjAzLjE1LjAyLjA3LjAyLjExLjAzLjEyLjAyLjEyLjA0LjE3LjAyLjE1LjA0LjIuMDIuMS4wMy4xNS4wMy4xNS4wNC4yMi4wNC4yMy4wNC4yMy4wNC4yNC4wNC4yNC4wNC4yNi4wNC4yNi4wNC4yLjA1LjM0LjAyLjE0LjA2LjM2LjA0LjMuMDQuMjIuMDQuMzEuMDMuMTZhMTAuNzYgMTAuNzYgMCAwIDAgNi41My0zLjQxbC4wNS0uMDYtLjI0LS44OS0uNjQtMi4zNy0uMzktMS40Ny0uMzUtMS4zLS4yMS0uNzgtLjE0LS41LS4wOC0uMy0uMDctLjI2LS4wMy0uMTEtLjAyLS4wNy0uMDEtLjAzdi0uMDNhNi4wNCA2LjA0IDAgMCAwLTIuMDUtMi45NyA2Ljc1IDYuNzUgMCAwIDAtNC4yNS0xLjM1TTguNDcgMTkuM2EuNTkuNTkgMCAwIDAtLjcyLjR2LjAxbC0uNTMgMS45NnEuNS4yNCAxLjAxLjQzbC4wOC4wMy41Ny0yLjExVjIwYS41OS41OSAwIDAgMC0uNDEtLjdtMy4yNi0xLjQzYS41OS41OSAwIDAgMC0uNzEuNHYuMDFsLS44IDIuOTZ2LjAxYS41OS41OSAwIDAgMCAxLjEyLjNsLjgtMi45NnYtLjAybC4wMi0uMDZ2LS4wMmwtLjAyLS4xLS4wMi0uMTQtLjAyLS4wOGEuNTguNTggMCAwIDAtLjM3LS4zWm0tNS41NS0zLjA0YTEgMSAwIDAgMC0uMDQuMDl2LjAybC0uOCAyLjk1di4wMmEuNTkuNTkgMCAwIDAgMS4xMy4zdi0uMDFsLjcyLTIuNjhhNS4zIDUuMyAwIDAgMS0xLjAxLS43Wm0tMS45LTMuNGEuNTkuNTkgMCAwIDAtLjcyLjR2LjAybC0uOCAyLjk1di4wMWEuNTkuNTkgMCAwIDAgMS4xMy4zbC44LTIuOTZ2LS4wMWEuNTkuNTkgMCAwIDAtLjQxLS43bTE3Ljg3LS42OGEuNTkuNTkgMCAwIDAtLjcyLjR2LjAybC0uOCAyLjk1di4wMWEuNTkuNTkgMCAwIDAgMS4xMy4zbC44LTIuOTZ2LS4wMWEuNTkuNTkgMCAwIDAtLjQxLS43TTIuNTUgNi44MWExMC43IDEwLjcgMCAwIDAtMS4yNiAzLjkzLjU5LjU5IDAgMCAwIDEtLjIydi0uMDJsLjgtMi45NXYtLjAxYS41OS41OSAwIDAgMC0uNTUtLjczbTE3LjU5LjAyYS41OS41OSAwIDAgMC0uNzIuNHYuMDFsLS44IDIuOTZ2LjAxYS41OS41OSAwIDAgMCAxLjEzLjNsLjgtMi45NnYtLjAxYS41OS41OSAwIDAgMC0uNDEtLjdabS03Ljg1IDEuOTNhLjc1Ljc1IDAgMSAxIDAgMS41Ljc1Ljc1IDAgMCAxIDAtMS41TTYuMDEgNC4wM2EuNTkuNTkgMCAwIDAtLjcxLjR2LjAyTDQuNSA3LjR2LjAxYS41OS41OSAwIDAgMCAxLjEyLjNsLjgtMi45NnYtLjAxYS41OS41OSAwIDAgMC0uNDEtLjdabTEwLjI0LjU2YS41OS41OSAwIDAgMC0uNzEuNFY1TDE1IDdxLjUyLjI2Ljk5LjZsLjA1LjA0LjYyLTIuMzJWNS4zYS41OS41OSAwIDAgMC0uNDEtLjdtLTUuMjEtMy4zNGExMSAxMSAwIDAgMC0xLjEyLjE2bC0uMDcuMDFMOS4xIDQuMnYuMDFhLjU5LjU5IDAgMCAwIDEuMTMuM2wuOC0yLjk2di0uMDFhLjYuNiAwIDAgMCAwLS4yN203LjM0IDIuMDQtLjE2LjU4di4wMmEuNTkuNTkgMCAwIDAgMS4xMy4zVjQuMmwuMDItLjA3YTExIDExIDAgMCAwLS45Mi0uNzd6bS00LjY0LTEuOTQtLjI4IDEuMDVhLjU5LjU5IDAgMCAwIDEuMTMuMzF2LS4wMWwuMy0xLjFxLS41Mi0uMTUtMS4wNi0uMjR6IiAvPjwvc3ZnPg==){.astro-5yo7dsk7
  .astro-4rgy7crp} Deno](index.html#tab-panel-103){#tab-103
  .astro-5yo7dsk7 role="tab" aria-selected="false" tabindex="-1"}
:::

:::: {#tab-panel-99 aria-labelledby="tab-99" role="tabpanel"}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code>npm install effect</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

:::: {#tab-panel-100 aria-labelledby="tab-100" role="tabpanel" hidden=""}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code>pnpm add effect</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

:::: {#tab-panel-101 aria-labelledby="tab-101" role="tabpanel" hidden=""}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code>yarn add effect</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

:::: {#tab-panel-102 aria-labelledby="tab-102" role="tabpanel" hidden=""}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code>bun add effect</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

:::: {#tab-panel-103 aria-labelledby="tab-103" role="tabpanel" hidden=""}
::: expressive-code
<figure class="frame is-terminal not-content">
<pre data-language="sh"><code>deno add npm:effect</code></pre>
<div class="copy">
<div>

</div>
</div>
<figcaption><span class="title"></span><span class="sr-only">Terminal
window</span></figcaption>
</figure>
:::
::::

By installing this package, you get access to the core functionality of
Effect.

For detailed installation instructions for platforms like Deno or Bun,
refer to the [Installation](../installation/index.html) guide, which
provides step-by-step guidance.

You can also start a new Effect app using
[`create-effect-app`{dir="auto"}](../create-effect-app/index.html),
which automatically sets up everything for you.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Importing Modules and Functions

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#importing-modules-and-functions){.anchor-link
aria-labelledby="importing-modules-and-functions"}
:::

Once you have installed the `effect`{dir="auto"} package, you can start
using its modules and functions in your projects. Importing modules and
functions is straightforward and follows the standard
JavaScript/TypeScript import syntax.

To import a module or a function from the `effect`{dir="auto"} package,
simply use the `import`{dir="auto"} statement at the top of your file.
Here's how you can import the `Effect`{dir="auto"} module:

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;</code></pre>
<div class="copy">
<div>

</div>
</div>
</figure>
:::

Now, you have access to the Effect module, which is the heart of the
Effect library. It provides various functions to create, compose, and
manipulate effectful computations.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Namespace imports

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#namespace-imports){.anchor-link
aria-labelledby="namespace-imports"}
:::

In addition to importing the `Effect`{dir="auto"} module with a named
import, as shown previously:

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>import { Effect } from &quot;effect&quot;</code></pre>
<div class="copy">
<div>

</div>
</div>
</figure>
:::

You can also import it using a namespace import like this:

::: expressive-code
<figure class="frame not-content">
<pre data-language="ts"><code>import * as Effect from &quot;effect/Effect&quot;</code></pre>
<div class="copy">
<div>

</div>
</div>
</figure>
:::

Both forms of import allow you to access the functionalities provided by
the `Effect`{dir="auto"} module.

However an important consideration is **tree shaking**, which refers to
a process that eliminates unused code during the bundling of your
application. Named imports may generate tree shaking issues when a
bundler doesn't support deep scope analysis.

Here are some bundlers that support deep scope analysis and thus don't
have issues with named imports:

- Rollup
- Webpack 5+

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Functions vs Methods

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#functions-vs-methods){.anchor-link
aria-labelledby="functions-vs-methods"}
:::

In the Effect ecosystem, libraries often expose functions rather than
methods. This design choice is important for two key reasons: tree
shakeability and extendibility.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Tree Shakeability

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#tree-shakeability){.anchor-link
aria-labelledby="tree-shakeability"}
:::

Tree shakeability refers to the ability of a build system to eliminate
unused code during the bundling process. Functions are tree shakeable,
while methods are not.

When functions are used in the Effect ecosystem, only the functions that
are actually imported and used in your application will be included in
the final bundled code. Unused functions are automatically removed,
resulting in a smaller bundle size and improved performance.

On the other hand, methods are attached to objects or prototypes, and
they cannot be easily tree shaken. Even if you only use a subset of
methods, all methods associated with an object or prototype will be
included in the bundle, leading to unnecessary code bloat.

::: {.autolink-heading-container .level-h3 tabindex="-1"}
### Extendibility

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#extendibility){.anchor-link
aria-labelledby="extendibility"}
:::

Another important advantage of using functions in the Effect ecosystem
is the ease of extendibility. With methods, extending the functionality
of an existing API often requires modifying the prototype of the object,
which can be complex and error-prone.

In contrast, with functions, extending the functionality is much
simpler. You can define your own "extension methods" as plain old
functions without the need to modify the prototypes of objects. This
promotes cleaner and more modular code, and it also allows for better
compatibility with other libraries and modules.

::: {.autolink-heading-container .level-h2 tabindex="-1"}
## Commonly Used Functions

[[![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iY3VycmVudGNvbG9yIiBkPSJtMTIuMTEgMTUuMzktMy44OCAzLjg4YTIuNTIgMi41MiAwIDAgMS0zLjUgMCAyLjQ3IDIuNDcgMCAwIDEgMC0zLjVsMy44OC0zLjg4YTEgMSAwIDAgMC0xLjQyLTEuNDJsLTMuODggMy44OWE0LjQ4IDQuNDggMCAwIDAgNi4zMyA2LjMzbDMuODktMy44OGExIDEgMCAxIDAtMS40Mi0xLjQyWm04LjU4LTEyLjA4YTQuNDkgNC40OSAwIDAgMC02LjMzIDBsLTMuODkgMy44OGExIDEgMCAwIDAgMS40MiAxLjQybDMuODgtMy44OGEyLjUyIDIuNTIgMCAwIDEgMy41IDAgMi40NyAyLjQ3IDAgMCAxIDAgMy41bC0zLjg4IDMuODhhMSAxIDAgMSAwIDEuNDIgMS40MmwzLjg4LTMuODlhNC40OSA0LjQ5IDAgMCAwIDAtNi4zM1pNOC44MyAxNS4xN2ExIDEgMCAwIDAgMS4xLjIyIDEgMSAwIDAgMCAuMzItLjIybDQuOTItNC45MmExIDEgMCAwIDAtMS40Mi0xLjQybC00LjkyIDQuOTJhMSAxIDAgMCAwIDAgMS40MloiIC8+PC9zdmc+)]{.anchor-icon
aria-hidden="true"}](index.html#commonly-used-functions){.anchor-link
aria-labelledby="commonly-used-functions"}
:::

As you start your adventure with Effect, you don't need to dive into
every function in the `effect`{dir="auto"} package right away. Instead,
focus on some commonly used functions that will provide a solid
foundation for your journey into the world of Effect.

In the upcoming guides, we will explore some of these essential
functions, specifically those for creating and running
`Effect`{dir="auto"}s and building pipelines.

But before we dive into those, let's start from the very heart of
Effect: understanding the `Effect`{dir="auto"} type. This will lay the
groundwork for your understanding of how Effect brings composability,
type safety, and error handling into your applications.

So, let's take the first step and explore the fundamental concepts of
the [The Effect Type](../the-effect-type.html).
::::::::::::::::::::::::

::: {.meta .sl-flex .astro-lfnsiwle}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXF4bnlic3ZxIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuMmVtOyI+PHBhdGggZD0iTTIyIDcuMjRhMSAxIDAgMCAwLS4yOS0uNzFsLTQuMjQtNC4yNGExIDEgMCAwIDAtMS4xLS4yMiAxIDEgMCAwIDAtLjMyLjIybC0yLjgzIDIuODNMMi4yOSAxNi4wNWExIDEgMCAwIDAtLjI5LjcxVjIxYTEgMSAwIDAgMCAxIDFoNC4yNGExIDEgMCAwIDAgLjc2LS4yOWwxMC44Ny0xMC45M0wyMS43MSA4Yy4xLS4xLjE3LS4yLjIyLS4zM2ExIDEgMCAwIDAgMC0uMjR2LS4xNGwuMDctLjA1Wk02LjgzIDIwSDR2LTIuODNsOS45My05LjkzIDIuODMgMi44M0w2LjgzIDIwWk0xOC4xNyA4LjY2bC0yLjgzLTIuODMgMS40Mi0xLjQxIDIuODIgMi44Mi0xLjQxIDEuNDJaIiAvPjwvc3ZnPg==){.astro-qxnybsvq
.astro-4rgy7crp} Edit
page](https://github.com/Effect-TS/website/edit/main/content/src/content/docs/docs/getting-started/importing-effect.mdx){.sl-flex
.print:hidden .astro-qxnybsvq}
:::

::: {.pagination-links .print:hidden .astro-u5aomj4k dir="ltr"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNyAxMUg5LjQxbDMuMy0zLjI5YTEuMDA0IDEuMDA0IDAgMSAwLTEuNDItMS40MmwtNSA1YTEgMSAwIDAgMC0uMjEuMzMgMSAxIDAgMCAwIDAgLjc2IDEgMSAwIDAgMCAuMjEuMzNsNSA1YTEuMDAyIDEuMDAyIDAgMCAwIDEuNjM5LS4zMjUgMSAxIDAgMCAwLS4yMTktMS4wOTVMOS40MSAxM0gxN2ExIDEgMCAwIDAgMC0yWiIgLz48L3N2Zz4=){.astro-u5aomj4k
.astro-4rgy7crp} [ Previous\
[Create Effect App]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../create-effect-app/index.html){.astro-u5aomj4k
rel="prev"}
[![](data:image/svg+xml;base64,PHN2ZyBhcmlhLWhpZGRlbj0idHJ1ZSIgY2xhc3M9ImFzdHJvLXU1YW9tajRrIGFzdHJvLTRyZ3k3Y3JwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIiBzdHlsZT0iLS1zbC1pY29uLXNpemU6IDEuNXJlbTsiPjxwYXRoIGQ9Ik0xNy45MiAxMS42MmExLjAwMSAxLjAwMSAwIDAgMC0uMjEtLjMzbC01LTVhMS4wMDMgMS4wMDMgMCAxIDAtMS40MiAxLjQybDMuMyAzLjI5SDdhMSAxIDAgMCAwIDAgMmg3LjU5bC0zLjMgMy4yOWExLjAwMiAxLjAwMiAwIDAgMCAuMzI1IDEuNjM5IDEgMSAwIDAgMCAxLjA5NS0uMjE5bDUtNWExIDEgMCAwIDAgLjIxLS4zMyAxIDEgMCAwIDAgMC0uNzZaIiAvPjwvc3ZnPg==){.astro-u5aomj4k
.astro-4rgy7crp} [ Next\
[The Effect Type]{.link-title .astro-u5aomj4k}
]{.astro-u5aomj4k}](../the-effect-type.html){.astro-u5aomj4k rel="next"}
:::
:::::::::::::::::::::::::::
::::::::::::::::::::::::::::
:::::::::::::::::::::::::::::::
