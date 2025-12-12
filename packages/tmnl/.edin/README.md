# EDIN Cycle Tracking

Operational documentation for the **Experiment → Design → Implement → Negotiate** cycle.

## Directory Structure

```
.edin/
├── README.md              # This file
├── epochs/
│   └── EPOCH-NNNN.md      # Epoch documents (open → close)
└── archive/               # Completed epochs (for reference)
```

## Epoch Document Format

Each epoch file tracks one EDIN cycle:

```markdown
# EPOCH-NNNN: [Brief Title]

## Status: OPEN | CLOSED

## Phase: EXPERIMENT | DESIGN | IMPLEMENT | NEGOTIATE

---

## Brief
[What are we solving? 2-3 sentences max.]

---

## Experiment Phase
### Hypotheses
- [ ] H1: ...
- [ ] H2: ...

### Probes
- P1: [minimal test to validate H1]
- P2: ...

### Findings
[What did we learn?]

---

## Design Phase
### Architecture
[Decisions made, diagrams, key files]

### Operations
- OP1: [decomposed task]
- OP2: ...

---

## Implement Phase
### Tasks
- [ ] Task 1
- [ ] Task 2

### Artifacts
[Files created/modified]

---

## Negotiate Phase
### Debrief
[What worked? What didn't?]

### Learnings
[Patterns to carry forward]

### Next Epoch Seeds
[What does the next cycle need to address?]

---

## Timestamps
- Opened: YYYY-MM-DD HH:MM
- Closed: YYYY-MM-DD HH:MM
```

## Usage

### Opening an Epoch

When starting a new EDIN cycle:

1. Create `epochs/EPOCH-NNNN.md` (increment from last)
2. Fill in **Brief** and **Hypotheses**
3. Set `Status: OPEN`, `Phase: EXPERIMENT`
4. Val announces: "Epoch NNNN opened: [title]"

### Phase Transitions

Update `Phase:` as you progress:
- EXPERIMENT → DESIGN when hypotheses validated
- DESIGN → IMPLEMENT when architecture locked
- IMPLEMENT → NEGOTIATE when tasks complete

### Closing an Epoch

1. Complete **Negotiate Phase** section
2. Set `Status: CLOSED`
3. Record close timestamp
4. Move to `archive/` if desired
5. Val announces: "Epoch NNNN closed. Seeds: [next topics]"

## Current Epoch

See `epochs/` for active cycles.
