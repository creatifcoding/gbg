# Genifer Mathematical Foundations — Bibliography

```
Maintained by: Val (architectural conscience)
Created:       2026-02-19
Status:        LIVING DOCUMENT
```

---

## Differential Dataflow & Incremental Computation

| Key | Citation | URL | Notes |
|-----|----------|-----|-------|
| [MCSHERRY-CIDR2013] | McSherry, F., Murray, D.G., Isaacs, R., Isard, M. "Differential Dataflow." CIDR 2013. | https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf | Foundational paper. Introduces differential computation with partially ordered versions. |
| [ABADI-FOSSACS2015] | Abadi, M., McSherry, F., Plotkin, G.D. "Foundations of Differential Dataflow." FoSSaCS 2015. LNCS 9034, pp. 71–83. | https://homepages.inf.ed.ac.uk/gdp/publications/differentialweb.pdf | Formal denotational semantics. Types as Abelian groups, Möbius inversion. **Core theory for patch algebra.** |
| [MURRAY-SOSP2013] | Murray, D.G., McSherry, F., Isaacs, R., Isard, M., Barham, P., Abadi, M. "Naiad: A Timely Dataflow System." SOSP 2013. | https://dl.acm.org/doi/10.1145/2517349.2522738 | Timely dataflow execution substrate for differential dataflow. |
| [MATERIALIZE-FORMALISM] | Materialize Inc. "Platform Formalism." 2024. | https://github.com/MaterializeInc/materialize | Production-grade formal specification of collections, traces, and compaction. |
| [D2TS-REPO] | Willis, S. / Electric SQL. "@electric-sql/d2ts: Differential Dataflow in TypeScript." 2024. | https://github.com/electric-sql/d2ts | TypeScript implementation. MultiSet, Version, Antichain, D2 graph, operators. **Our implementation target.** |
| [MCSHERRY-SCRATCH] | McSherry, F. "Differential Dataflow from Scratch." Blog post, 2020. | https://github.com/TimelyDataflow/differential-dataflow/blob/master/mdbook/src/chapter_0/chapter_0.md | Accessible reconstruction of the mathematical model. d2ts is ported from this. |
| [MCSHERRY-SHARED2020] | McSherry, F., Lattuada, A., Schwarzkopf, M., Roscoe, T. "Shared Arrangements: practical inter-query sharing for streaming dataflows." PVLDB 13(10), 2020. | http://www.vldb.org/pvldb/vol13/p1793-mcsherry.pdf | Shared indexed state for concurrent queries. Relevant to multi-component streaming. |

## Tree Automata & Regular Tree Grammars

| Key | Citation | URL | Notes |
|-----|----------|-----|-------|
| [COMON-TATA2007] | Comon, H., Dauchet, M., Gilleron, R., Löding, C., Jacquemard, F., Lugiez, D., Tison, S., Tommasi, M. "Tree Automata Techniques and Applications." 2007. | https://www.eecs.harvard.edu/~shieber/Projects/Transducers/Papers/comon-tata.pdf | **Primary reference.** Chapters 1–2: finite tree automata, regular tree grammars, recognizable tree languages. |
| [BRAINERD1968] | Brainerd, W.S. "The Minimalization of Tree Automata." Information and Control 13(5), pp. 484–491, 1968. | https://doi.org/10.1016/s0019-9958(68)90917-0 | First description of regular tree grammars. |
| [THATCHER-WRIGHT1968] | Thatcher, J.W., Wright, J.B. "Generalized Finite Automata Theory with an Application to a Decision Problem of Second-Order Logic." Mathematical Systems Theory 2(1), pp. 57–81, 1968. | https://doi.org/10.1007/BF01691346 | Independent co-discovery of tree automata. |
| [ALUR-VPL2004] | Alur, R., Madhusudan, P. "Visibly Pushdown Languages." STOC 2004, pp. 202–211. | http://www.cis.upenn.edu/~alur/Stoc04.pdf | Relates regular binary tree languages to nested words. **Relevant to streaming JSON parsing** — JSON is a visibly pushdown language. |
| [NIVAT-PODELSKI1992] | Nivat, M., Podelski, A. "Tree Automata and Languages." Studies in Computer Science and AI, Vol. 10. North-Holland, 1992. | — | Book on tree grammars (library reference). |

## Category Theory for Generative AI

| Key | Citation | URL | Notes |
|-----|----------|-----|-------|
| [MAHADEVAN-GAIA2024] | Mahadevan, S. "GAIA: Categorical Foundations of Generative AI." arXiv:2402.18732, 2024. | https://arxiv.org/abs/2402.18732 | Simplicial sets, horn extensions, Kan extensions for generative AI. **Core theory for categorical composition.** |
| [MAHADEVAN-TOPOS2025] | Mahadevan, S. "Topos Theory for Generative AI and LLMs." arXiv:2508.08293, 2025. | https://arxiv.org/abs/2508.08293 | Category of LLMs as a topos. Pullback, pushout, exponential compositions. |
| [RIEHL2017] | Riehl, E. "Category Theory in Context." Dover, 2017. | https://math.jhu.edu/~eriehl/context/ | Standard reference for category theory. Functors, natural transformations, Kan extensions. |

## Fixed-Point Theory & Lattices

| Key | Citation | URL | Notes |
|-----|----------|-----|-------|
| [KLEENE-FPT] | Kleene, S.C. Fixed-point theorem. Via: Wikipedia summary + IU lecture notes. | https://en.wikipedia.org/wiki/Kleene_fixed-point_theorem | Ascending Kleene chain: ⊥ ⊑ F(⊥) ⊑ F²(⊥) ⊑ ... converges to lfp(F). **Core theorem for streaming convergence proof.** |
| [TARSKI1955] | Tarski, A. "A Lattice-Theoretical Fixpoint Theorem and its Applications." Pacific J. Math. 5(2), pp. 285–309, 1955. | https://doi.org/10.2140/pjm.1955.5.285 | Fixed-point theorem for monotone functions on complete lattices. |
| [DAVEY-PRIESTLEY2002] | Davey, B.A., Priestley, H.A. "Introduction to Lattices and Order." 2nd ed. Cambridge University Press, 2002. | — | Standard reference for lattice theory (library reference). |

## Algebraic Data Types & UI Composition

| Key | Citation | URL | Notes |
|-----|----------|-----|-------|
| [ADT-WIKI] | Wikipedia. "Algebraic data type." | https://en.wikipedia.org/wiki/Algebraic_data_type | Sum types (tagged unions) + product types (records). Type-theoretic notation: λα.μβ.1+α×β |
| [MANNU-COMPOSABLE2024] | Mannu, D. "Composable UI Contracts: An Algebraic Approach to Layout, Style and Interaction." dev.to, 2024. | https://dev.to/dariomannu/composable-ui-contracts-an-algebraic-approach-to-layout-style-and-interaction-3jh9 | Product types for nested components, sum types for layouts/states. Applied ADT theory. |
| [RTG-WIKI] | Wikipedia. "Regular tree grammar." | https://en.wikipedia.org/wiki/Regular_tree_grammar | G = (N, Σ, Z, P). Nonterminals, ranked alphabet, start symbol, productions. Language closure properties. |

## Information Theory

| Key | Citation | URL | Notes |
|-----|----------|-----|-------|
| [SHANNON1948] | Shannon, C.E. "A Mathematical Theory of Communication." Bell System Technical Journal 27, pp. 379–423, 623–656, 1948. | https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf | Entropy, channel capacity, source coding theorem. |
| [KULLBACK1951] | Kullback, S., Leibler, R.A. "On Information and Sufficiency." Annals of Mathematical Statistics 22(1), pp. 79–86, 1951. | https://doi.org/10.1214/aoms/1177729694 | KL divergence — relative entropy. |
| [LIN1991] | Lin, J. "Divergence Measures Based on the Shannon Entropy." IEEE Trans. Information Theory 37(1), pp. 145–151, 1991. | https://doi.org/10.1109/18.61115 | Jensen-Shannon divergence (symmetric, bounded). |

## Tsingou Internal Research (Extrapolation Sources)

| Key | Location | Notes |
|-----|----------|-------|
| [TSG-DIFF-DATAFLOW] | `docs/tsingou/research/research-differential-dataflow.md` | Lattice theory, partial orders, antichains, Möbius inversion. **Primary extrapolation source for d2ts theory.** |
| [TSG-GRAPH-THEORY] | `docs/tsingou/research/research-graph-theory.md` | Centrality, spectral methods, community detection. Applicable to component dependency graphs. |
| [TSG-INFO-THEORY] | `docs/tsingou/research/research-information-theory.md` | Entropy, divergence, mutual information. **Primary extrapolation source for prompt optimization.** |
| [TSG-DATA-FUSION] | `docs/tsingou/research/research-data-fusion-math.md` | JDL model, Bayesian inference, Dempster-Shafer. Fusion ontology → catalog ontology mapping. |
| [TSG-ADR001] | `docs/tsingou/adr/ADR-001-d2ts-as-signal-pipeline.md` | d2ts as core computation engine. Version semantics, MultiSet model, output path. **Direct template for genifer d2ts integration.** |
| [TSG-FUSION-ONTOLOGY] | `docs/tsingou/concepts/fusion-ontology.md` | Entity-class/signal-kind mapping. Structural analogy to component-type/prop-schema mapping. |

## Competitor Systems (Analysis Sources)

| Key | Citation | URL | Notes |
|-----|----------|-----|-------|
| [TAMBO] | tambo-ai/tambo. "Tambo: Generative UI for React." | https://github.com/tambo-ai/tambo | Submodule at `../../submodules/tambo`. Bidirectional state, tool calling, Standard Schema, conversation threads. |
| [HASHBROWN] | liveloveapp/hashbrown. "Hashbrown: Generative UI Framework." | https://github.com/liveloveapp/hashbrown | Streaming JSON parser, Skillet schema language, prompt composition with `<ui>` blocks, component tree lowering. |
