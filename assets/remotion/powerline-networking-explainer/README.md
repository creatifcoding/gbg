# Powerline Networking Explainer

A Remotion composition explaining the physics and architecture of Powerline networking:

- mains AC vs MHz data carrier frequency separation
- why a powerline adapter is a modem, filter, bridge, and safety isolation device
- PoE vs Powerline distinction
- why the transceiver can be embedded even if the physical device disappears

## Composition

```text
PowerlineExplainer
1280x720 · 30fps · 640 frames (~21.3s)
```

## Commands

```bash
bun install
bun run lint
bunx remotion studio
bunx remotion still PowerlineExplainer out/frame-120.png --frame=120 --scale=0.25
bunx remotion render PowerlineExplainer out/powerline-networking-explainer.mp4
```

## Notes

Animations are frame-driven with `useCurrentFrame()` and `interpolate()`. No CSS transitions or CSS animations are used, per Remotion rendering discipline.
