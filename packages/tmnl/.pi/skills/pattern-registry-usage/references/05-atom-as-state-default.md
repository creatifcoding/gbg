# Atom-as-State Default (Policy)

## Policy Statement

Default to **Atoms-as-State** when state is plausibly derivable, shareable, or likely to become cross-surface.

Use:

- `Atom.make(...)` for state authority
- `useAtomValue(...)` for read
- `useAtomSet(...)` for write

## Why

- Derivations become trivial (selectors/projections) without tree rewiring.
- Shared consumers can subscribe without prop drilling or refactor churn.
- Transition from local state to service/state graph is smooth.
- Avoids expensive `useState` → atom migrations later.

## `useState` Exception (Allowed)

Use `useState` only for **strictly ephemeral UI microstate**, e.g.:

- hover flags
- transient text input draft
- local dialog open/close that never needs derivations or sharing

If uncertain, choose atom.

## Examples

### Preferred

```ts
const countAtom = Atom.make(0)

function Counter() {
  const count = useAtomValue(countAtom)
  const setCount = useAtomSet(countAtom)
  return <button onClick={() => setCount((n) => n + 1)}>{count}</button>
}
```

### Caution

```ts
// If this will be derived/shared later, do NOT start with useState
const [results, setResults] = useState([])
```

## Registry Hook

When implementing stateful features:

1. Query registry for policy and precedent (`effect-atom`, `state`, `policy` tags).
2. Annotate decision if you intentionally use `useState` exception.
