import { describe, it, expect } from "vitest";
import { createLayerActor, layerMachine } from "../layerMachine";
import { createActor } from "xstate";

describe("Layer State Machine", () => {
  /**
   * Hypothesis 1: Machine starts in "visible" state by default
   * Proves: Default initial state
   */
  it("starts in visible state by default", () => {
    const actor = createLayerActor();
    actor.start();

    const snapshot = actor.getSnapshot();

    expect(snapshot.status).toBe("active");
    expect(snapshot.value).toBe("visible");

    actor.stop();
  });

  /**
   * Hypothesis 2: Machine starts in custom state if provided
   * Proves: Initial state customization
   */
  it("starts in custom initial state (hidden)", () => {
    const actor = createLayerActor("hidden");
    actor.start();

    const snapshot = actor.getSnapshot();

    expect(snapshot.value).toBe("hidden");

    actor.stop();
  });

  it("starts in custom initial state (locked)", () => {
    const actor = createLayerActor("locked");
    actor.start();

    const snapshot = actor.getSnapshot();

    expect(snapshot.value).toBe("locked");

    actor.stop();
  });

  /**
   * Hypothesis 3: SHOW transitions hidden → visible
   * Proves: Show transition
   */
  it("SHOW transitions from hidden to visible", () => {
    const actor = createLayerActor("hidden");
    actor.start();

    expect(actor.getSnapshot().value).toBe("hidden");

    actor.send({ type: "SHOW" });

    expect(actor.getSnapshot().value).toBe("visible");

    actor.stop();
  });

  /**
   * Hypothesis 4: HIDE transitions visible → hidden
   * Proves: Hide transition
   */
  it("HIDE transitions from visible to hidden", () => {
    const actor = createLayerActor("visible");
    actor.start();

    expect(actor.getSnapshot().value).toBe("visible");

    actor.send({ type: "HIDE" });

    expect(actor.getSnapshot().value).toBe("hidden");

    actor.stop();
  });

  /**
   * Hypothesis 5: LOCK transitions visible → locked
   * Proves: Lock transition
   */
  it("LOCK transitions from visible to locked", () => {
    const actor = createLayerActor("visible");
    actor.start();

    actor.send({ type: "LOCK" });

    expect(actor.getSnapshot().value).toBe("locked");

    actor.stop();
  });

  /**
   * Hypothesis 6: UNLOCK transitions locked → visible
   * Proves: Unlock transition
   */
  it("UNLOCK transitions from locked to visible", () => {
    const actor = createLayerActor("locked");
    actor.start();

    actor.send({ type: "UNLOCK" });

    expect(actor.getSnapshot().value).toBe("visible");

    actor.stop();
  });

  /**
   * Hypothesis 7: BRING_TO_FRONT doesn't change state
   * Proves: Self-transition
   */
  it("BRING_TO_FRONT keeps visible state", () => {
    const actor = createLayerActor("visible");
    actor.start();

    expect(actor.getSnapshot().value).toBe("visible");

    actor.send({ type: "BRING_TO_FRONT" });

    expect(actor.getSnapshot().value).toBe("visible");

    actor.stop();
  });

  it("SEND_TO_BACK keeps visible state", () => {
    const actor = createLayerActor("visible");
    actor.start();

    expect(actor.getSnapshot().value).toBe("visible");

    actor.send({ type: "SEND_TO_BACK" });

    expect(actor.getSnapshot().value).toBe("visible");

    actor.stop();
  });

  /**
   * Hypothesis 8: Invalid transitions are ignored
   * Proves: Transition guards (or lack thereof)
   */
  it("LOCK from hidden state is ignored (no transition)", () => {
    const actor = createLayerActor("hidden");
    actor.start();

    expect(actor.getSnapshot().value).toBe("hidden");

    actor.send({ type: "LOCK" });

    // Should remain in hidden state (transition not defined)
    expect(actor.getSnapshot().value).toBe("hidden");

    actor.stop();
  });

  it("UNLOCK from hidden state is ignored", () => {
    const actor = createLayerActor("hidden");
    actor.start();

    actor.send({ type: "UNLOCK" });

    expect(actor.getSnapshot().value).toBe("hidden");

    actor.stop();
  });

  it("SHOW from locked state is ignored", () => {
    const actor = createLayerActor("locked");
    actor.start();

    actor.send({ type: "SHOW" });

    expect(actor.getSnapshot().value).toBe("locked");

    actor.stop();
  });

  /**
   * Hypothesis 9: Machine can transition locked → hidden
   * Proves: Hidden state accessible from locked
   */
  it("HIDE transitions from locked to hidden", () => {
    const actor = createLayerActor("locked");
    actor.start();

    actor.send({ type: "HIDE" });

    expect(actor.getSnapshot().value).toBe("hidden");

    actor.stop();
  });

  /**
   * Additional: Complex transition sequences
   * Proves: State machine behaves correctly across multiple transitions
   */
  it("handles complex transition sequence: visible → locked → hidden → visible", () => {
    const actor = createLayerActor("visible");
    actor.start();

    // visible → locked
    actor.send({ type: "LOCK" });
    expect(actor.getSnapshot().value).toBe("locked");

    // locked → hidden
    actor.send({ type: "HIDE" });
    expect(actor.getSnapshot().value).toBe("hidden");

    // hidden → visible
    actor.send({ type: "SHOW" });
    expect(actor.getSnapshot().value).toBe("visible");

    actor.stop();
  });

  /**
   * Additional: Machine definition test
   * Proves: Machine has expected states and transitions
   */
  it("machine definition has correct states", () => {
    const states = Object.keys(layerMachine.states);

    expect(states).toContain("hidden");
    expect(states).toContain("visible");
    expect(states).toContain("locked");
  });

  it("machine definition has correct initial state", () => {
    expect(layerMachine.initial).toBe("visible");
  });
});
