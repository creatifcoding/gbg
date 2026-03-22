TRANSITION PROPAGATION CHAIN (MORPHCARD / DYNAMICISLANDCARD)

SOURCE: DYNAMICISLANDCARD TAB / VIEW CHANGE

SEQUENCE DIAGRAM (EXTENDED ASCII)

    ┌───────────────────┐      ┌─────────────────────────────┐
    │   USER / UI       │      │   DYNAMICISLANDCARD         │
    └─────────┬─────────┘      └──────────────┬──────────────┘
              │                                │
              │  CLICK TAB / CHANGE VIEW       │
              │──────────────────────────────▶ │
              │                                │
              │                                │  RESOLVE VIEW GRAMMAR
              │                                │  - VIEW.TRANSITION OVERRIDE?
              │                                │  - ELSE TRANSITIONSTRATEGY()
              │                                │  RESOLVE SIZEKEY / RETICLE / COMPLEXITY
              │                                │
              │                                │  SENDISLANDEVENT(TRANSITION)
              │                                │──────────────────────────────▶
              │                                │                               ┌───────────────────────┐
              │                                │                               │   ISLAND MACHINE      │
              │                                │                               └──────────┬────────────┘
              │                                │                                          │
              │                                │                                          │  APPLYTRANSITION
              │                                │                                          │  - ACTIVE_TRANSITION = GRAMMAR
              │                                │                                          │  - SIZEKEY / RETICLE / COMPLEXITY
              │                                │                                          │
              │                                │                                          │  UPDATE ATOMS
              │                                │                                          └──────────┬────────────┘
              │                                │                                                     │
              │                                │                                                     │  CARDSTATEFAMILY.TRANSITION
              │                                │                                                     │  CARDSTATEFAMILY.SIZEKEY
              │                                │                                                     │  CARDSTATEFAMILY.RETICLE
              │                                │                                                     │  CARDSTATEFAMILY.COMPLEXITY
              │                                │                                                     │
              │                                │                                                     ▼
              │                                │                               ┌───────────────────────┐
              │                                │                               │   MORPHCARD           │
              │                                │                               └──────────┬────────────┘
              │                                │                                          │
              │                                │                                          │  READ MACHINE TRANSITION
              │                                │                                          │  transition = PROP ?? MACHINE ?? CONTEXT ?? DEFAULT
              │                                │                                          │  variants = GRAMMARTOVARIANTS(transition)
              │                                │                                          │
              │                                │                                          │  ANIMATEPRESENCE + MOTION.DIV
              │                                │                                          └──────────┬────────────┘
              │                                │                                                     │
              │                                │                                                     ▼
              │                                │                               ┌───────────────────────┐
              │                                │                               │   FRAMER MOTION       │
              │                                │                               └───────────────────────┘
              │                                │
              │  VISUAL TRANSITION             │
              │◀────────────────────────────── │

VERBOSE EXPLANATION

1) A TAB CHANGE OR VIEW SWITCH IN DYNAMICISLANDCARD TRIGGERS ITS EFFECT.
2) THE EFFECT RESOLVES THE TARGET SIZEKEY AND THE TRANSITION GRAMMAR:
   - IF THE VIEW DEFINES A TRANSITION OVERRIDE, THAT WINS.
   - OTHERWISE, IT CALLS THE TRANSITIONSTRATEGY WITH FROM/TO/CURRENT/SIZES.
3) DYNAMICISLANDCARD DISPATCHES THE TRANSITION TO THE ISLAND MACHINE VIA SENDISLANDEVENT.
4) THE ISLAND MACHINE APPLIES THE TRANSITION AND WRITES STATE INTO ATOMS:
   - ACTIVE TRANSITION GRAMMAR
   - SIZEKEY / RETICLE / COMPLEXITY
5) MORPHCARD SUBSCRIBES TO CARDSTATEFAMILY.TRANSITION AND RESOLVES THE FINAL TRANSITION:
   TRANSITION PROP > MACHINE TRANSITION > CONTEXT TRANSITION > DEFAULT_TRANSITION
6) MORPHCARD FEEDS THAT TRANSITION INTO GRAMMARTOVARIANTS, WHICH PRODUCES INITIAL/ANIMATE/EXIT.
7) FRAMER MOTION ANIMATEPRESENCE + MOTION.DIV USE THOSE VARIANTS TO RENDER THE VISUAL ANIMATION.

NOTES
- IF YOU LOG THE CORRECT GRAMMAR BUT STILL SEE THE WRONG MOTION, THE FAILURE IS AFTER STEP 5.
- PRIMARY SUSPECTS: GRAMMARTOVARIANTS OUTPUT OR MOTION WRAPPER BEHAVIOR / KEYS.
