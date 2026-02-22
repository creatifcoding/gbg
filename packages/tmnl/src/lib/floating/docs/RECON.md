# Floating System — Surgical Recon

Generated: 2026-02-21T20:30:34-05:00
Target: `src/lib/floating`

```
LINES  EXP   IMP   §§   FANS  FILE                                       CONCERNS
-----  ---   ---   --   ----  ----                                       --------
1152   46    8     30   26    stx/actions.ts                              stx logic ██
467    24    1     16   8     layout/split-tree.ts                        logic types ██
362    2     9     12   2     layout/TiledPanel.tsx                       hooks stx ui logic types ██
329    32    0     26   93    index.ts                                    ██
318    34    1     24   501   types.ts                                    logic types ██
290    9     1     18   53    utils/position.ts                           logic types ▓▓
281    6     7     12   3     layout/SplitContainer.tsx                   hooks stx ui logic types ▓▓
273    3     5     6    10    layout/TabBar.tsx                           hooks ui logic types ▓▓
273    12    3     12   5     PanelRegistry.tsx                           hooks ui logic types ▓▓
255    1     6     4    2     hooks/useKeyboardNav.ts                     hooks stx logic ▓▓
250    14    1     8    2     utils/snap-engine.ts                        logic types ▓▓
249    3     4     8    3     components/PanelContextMenu.tsx             hooks stx ui logic types ▓▓
240    4     2     10   2     components/AccordionPanel.tsx               hooks ui logic types ▓▓
236    3     14    8    11    FloatingPanel.tsx                           hooks ui logic types ▓▓
234    2     5     8    5     ResizeHandles.tsx                           hooks stx ui logic ▓▓
234    2     4     4    2     hooks/useResize.ts                          hooks stx logic types ▓▓
220    5     7     4    1     withDraggable.tsx                           hooks stx ui logic types ▓▓
198    2     2     2    3     machines/panel-machine.ts                   logic types ▒▒
187    3     4     4    5     hooks/useFloatingPanel.ts                   hooks stx logic ▒▒
172    3     5     8    2     layout/EdgeDropZone.tsx                     hooks stx ui logic types ▒▒
159    5     3     6    3     context/FloatingBoundsContext.tsx           hooks stx ui logic types ▒▒
157    8     2     6    14    context/bounds.ts                           stx logic types ▒▒
147    3     2     8    3     context/FloatingDimensionContext.tsx        hooks ui logic
142    4     19    4    1     FloatingPanelProvider.tsx                   hooks stx logic types
140    3     8     0    4     hooks/useDragHandlers.ts                    hooks stx logic types
136    2     1     6    5     layout/Separator.tsx                        hooks ui logic types
136    1     6     6    1     visitors/morphchat-visitor.tsx              hooks ui logic
130    4     1     6    4     layout/columns.ts                           logic types
119    4     3     0    40    dock/layout.ts                              logic
110    2     4     0    2     modifiers/magneticSnap.ts                   hooks logic types
108    1     4     0    13    stx/effects.ts                              stx
107    1     6     0    2     hooks/useWorkspaceBounds.ts                 hooks stx logic
105    3     1     4    4     panel-registry.ts                           types
100    1     1     0    4     stx/computed.ts                             stx
99     3     0     4    307   tokens.ts                                   logic types
96     6     2     10   21    context/PanelContext.ts                     stx logic types
92     5     4     0    4     components/CollapsedStrip.tsx               hooks ui logic types
91     2     1     0    3     components/DragGuideOverlay.tsx             ui logic types
91     1     4     0    2     hooks/useKeyboardNudge.ts                   hooks stx logic
85     1     0     0    21    floating-stx.ts                            
83     2     5     0    4     components/PanelContentRenderer.tsx         stx ui logic types
80     1     0     0    1     utils/raf-throttle.ts                       logic
76     6     0     0    92    stx/index.ts                                types
75     7     1     0    4     components/PanelIcons.tsx                   logic
70     2     6     0    4     components/PanelContent.tsx                 hooks ui logic types
70     2     6     0    2     hooks/useFloatingModifiers.ts               hooks stx logic types
68     1     5     0    3     components/CollapsedStripStack.tsx          hooks stx ui logic
67     3     2     0    5     components/ChromeBtn.tsx                    ui logic types
67     1     6     0    1     modifiers/dockPreview.ts                    hooks logic
66     2     5     0    2     components/atoms/PanelTitleTab.tsx          ui logic types
64     3     2     6    5     context/FloatingPanelContext.ts             logic types
63     2     3     0    2     hooks/usePanelPersistence.ts                hooks stx logic types
60     1     5     0    2     components/atoms/PanelModeToggle.tsx        hooks logic
58     2     6     0    3     components/PanelHeader.tsx                  hooks ui logic types
54     3     5     2    13    stx/instance.ts                             logic
54     1     4     0    2     hooks/useDockPreview.ts                     hooks logic
54     1     3     0    2     hooks/useSnapGuides.ts                      hooks logic
53     3     2     4    1     FloatingDragOverlay.tsx                     logic types
50     1     3     0    3     hooks/usePanelState.ts                      stx logic
48     7     0     0    93    layout/index.ts                            
45     2     6     4    11    stx/initial.ts                              types
43     1     3     0    2     hooks/useFloatingActions.ts                 hooks logic
43     12    0     0    93    components/index.ts                        
41     5     0     0    93    context/index.ts                           
40     1     3     0    2     components/atoms/PanelTabClose.tsx          ui logic
37     1     2     0    1     modifiers/restrictToWorkspace.ts            hooks logic
36     2     3     0    2     components/atoms/PanelControls.tsx          ui logic types
33     1     3     0    3     components/atoms/PanelTitle.tsx             ui logic
28     1     3     0    1     components/atoms/PanelResize.tsx            ui logic
23     1     4     0    1     components/atoms/PanelMinimize.tsx          logic
21     1     4     0    1     components/atoms/PanelMaxToggle.tsx         logic
20     2     0     0    501   dock/types.ts                               types
17     2     1     0    93    visitors/index.ts                           logic
17     12    0     0    93    hooks/index.ts                             
15     8     0     0    93    components/atoms/index.ts                  
15     7     0     0    28    stx/constants.ts                           
11     3     0     0    93    modifiers/index.ts                         
8      2     0     0    93    dock/index.ts                              
```

## Legend

- **██** >300 lines — decomposition candidate
- **▓▓** 200–300 lines — watch list
- **▒▒** 150–200 lines — borderline
- **EXP** = exported symbols, **IMP** = import statements
- **§§** = section separators (`// ===`), **FANS** = consumer files
- **Concerns**: hooks, stx (legend-state), ui (styles/classes), logic (functions), types
