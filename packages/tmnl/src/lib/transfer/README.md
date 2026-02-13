# Transfer

Schema-first cross-surface reference transfer for TMNL.

## Purpose

`src/lib/transfer` enables a component to emit a **reference token** (drag or copy), and another component to accept it through a **trait + hook contract**.

- Source remains immutable (copy/reference semantics)
- Targets decide rendering behavior (inline chip vs structured block)
- Validation is schema + guard based
- Runtime state is stx-backed (active drag, hover decision, clipboard)

## Core Pieces

- `types.ts` — Effect Schema contracts
- `traits.ts` — capability traits (`TransferSourceTrait`, `TransferTargetTrait`)
- `transfer-stx.ts` — runtime state + operations
- `hooks/` — `useTransferDraggable`, `useTransferDroppable`, `useTransferClipboard`
- `overlay/TransferOverlay.tsx` — optional drag feedback overlay

## Minimal Flow

1. Build token with `createTaskReferenceToken(...)`
2. Source uses `useTransferDraggable({ token })`
3. Target uses `useTransferDroppable({ intent, onDropToken })`
4. Target resolves token into inline chip / block renderer

## Keyboard Path

- `useTransferClipboard().copySelection(...)` for shift-select copy
- `useTransferDroppable().onPaste` for paste-to-target

## MIME + Text

- MIME: `application/x.tmnl.reference+json`
- Text fallback: `@ref:<base64-json>`
