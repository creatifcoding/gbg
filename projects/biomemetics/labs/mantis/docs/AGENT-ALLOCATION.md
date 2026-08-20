# Agent and tool allocation

This is a risk-weighted operating budget, not a claim about vendor pricing.
Relative intelligence units make task allocation reviewable before a swarm is
started.

## Relative reasoning cost

| Worker | Relative unit | Use | Do not use for |
| --- | ---: | --- | --- |
| Deterministic command, schema validator, solver run, or exporter | 0.05 | Generation, transforms, sweeps, hashes, checks | Ambiguous requirements or evidence admission |
| Focused domain script/notebook | 0.20 | Repeatable calculations and parameter studies | Cross-domain arbitration |
| Grok 4.5 bounded implementer | 1.00 | One issue, one write-set, one acceptance test | Changing workspace locks |
| Grok 4.5 independent reviewer | 0.75 | Read-only failure-mode and evidence review | Quietly editing the implementation it reviews |
| Grok 4.6 xhigh root architect | 3.00 | Safety boundary, architecture, disputed evidence, integration decisions | Bulk file generation or routine fixes |

Suggested budget for a milestone: 15% root architecture, 45% bounded
implementation, 20% independent review, and 20% deterministic tools/solver
time. Escalate to the root only when a decision crosses at least two domain
authorities, changes a lock, or alters the evidence-admission boundary.

## Concurrency

Run at most three write-capable implementers in parallel:

1. EE/channel coupon and electrical protection;
2. mechanical/CAD carriage and latch; and
3. data/tooling/SpecimenDB workflow.

Each owns one issue and disjoint write-set. Review begins from raw artifacts
after the implementer stops. The root integrates; it does not become a fourth
implementer. Cursor routing is Grok-only: Grok 4.6 xhigh for root work and Grok
4.5 for implementation/review, all non-fast. Sol, Auto, and Fast Mode are
forbidden by `AGENTS.md` and `.agents/control/workstreams.json`.

## Right tool for each claim

| Claim or artifact | Authority/tool | Required independent gate |
| --- | --- | --- |
| Fast printable concept | OpenSCAD | Render/manifold inspection; never call it released STEP |
| Released solid geometry and STEP | FreeCAD/OCCT, CadQuery, or build123d | Neutral STEP re-import plus dimensional/interface checks |
| Circuit and PCB | KiCad | ERC/DRC, source review, and bench evidence |
| Power transient/control behavior | ngspice plus Python analysis | Scope captures, current-limit/fuse, thermal, and fault tests |
| Structural/fit screening | Gmsh + CalculiX or a documented equivalent | Printed coupon and measured fit/load test |
| Motion/explanatory view | Blender | Visual inspection only; CAD remains dimensional authority |
| Vector sheets/cut paths | SVG/DXF + Inkscape | Scale, layer, text, projection, and kerf review |
| Scientific sweeps/data reduction | Python | Contract-valid inputs, units, provenance, and independent verifier |
| Artifact integrity/verification report | Rust verifier | Re-run from clean environment; wrap the digested report in a reviewed EvidenceRecord; no self-repair |
| Workflow and SpecimenDB mapping | TypeScript/Effect | Governed API only; no direct PGlite bypass |
| Environment/task graph | Nix + Nx | Locked environment and CI smoke test |

GMSL2 simulation can reject a bad geometry, but it cannot qualify the novel
pogo interface. The release gate needs the selected contact model, ADI channel
requirements, a representative coupon, TDR/S-parameters, eye/BER, contact
bounce, ESD, thermal, contamination, and wear evidence.
