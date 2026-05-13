# GetByShell.Bar — Calendar System Architecture

> **Codename**: CHRONOS  
> **Surface**: Fullscreen overlay, holographic projection entrance  
> **Stack**: Effect-TS, effect-atom, motion/react, collaborative editor (y-sweet + TipTap), morph cards  
> **Status**: Design spec — entrance shell + scaffolding

---

## 1. Vision

The calendar is not a widget. It's a **temporal operating surface** — a fullscreen overlay that projects from the bar like a holographic display powering on. Each day is a rich entity containing notes, morph cards, events, tasks, knowledge links, mood/status, and media. Days are backed by the collaborative editor's document storage (y-sweet), cards are morph cards with the full dynamic island state machine, and everything is linked by **MELANIE** — the knowledge agent.

### What Makes This Different

| Traditional Calendar | CHRONOS |
|---------------------|---------|
| Static