# Chart Integration Q&A

> Generative UI + Chart Discriminator integration documentation

---

## Overview

### Q: What is the Chart Discriminator?

**A:** The Chart Discriminator is an LLM-augmented agent that selects the optimal chart type for data visualization. Given a natural language prompt like "show me sales trends over time", it:

1. Analyzes user intent
2. Searches through 35 available chart types
3. Scores candidates against the data context
4. Returns ranked recommendations with confidence scores

It uses internal tools (search_charts, analyze_intent, score_chart_fit) to reason about chart selection.

### Q: What is the AI SDK Tool Wrapper?

**A:** The `createChartDiscriminatorTool()` function wraps the discriminator as an AI SDK tool, allowing **any external AI agent** to call it:

```typescript
import { createChartDiscriminatorTool } from '@/lib/charts'

const tools = {
  chart_discriminator: createChartDiscriminatorTool()
}

// Use with any AI SDK compatible agent
const result = await generateText({
  model: yourModel,
  tools,
  prompt: "Show me a chart of quarterly revenue"
})
```

### Q: How does json-render fit in?

**A:** json-render is our stream-first component rendering system. When an AI emits JSON describing a UI tree, json-render:

1. Validates against registered component schemas
2. Renders the appropriate React components
3. Handles streaming updates with animations

Charts are registered in the `chartDomainCatalog` and can be rendered via json-render.

---

## Architecture

### Q: What's the end-to-end flow when a user asks for a chart?

**A:**

```
USER: "Show me how sales changed over the last year"
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI AGENT                                                        │
│  - Detects visualization intent                                  │
│  - Calls chart_discriminator tool                                │
│  - Receives: { chartType: "Line", config: {...}, confidence: 0.9 }│
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  JSON-RENDER STREAMING                                           │
│  Agent emits JSON patch:                                         │
│  {                                                               │
│    "op": "add",                                                  │
│    "path": "/elements/chart1",                                   │
│    "value": {                                                    │
│      "type": "Line",                                             │
│      "props": {                                                  │
│        "data": [...],                                            │
│        "xField": "date",                                         │
│        "yField": "sales"                                         │
│      }                                                           │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  CHART DOMAIN CATALOG                                            │
│  - Looks up "Line" in registered components                      │
│  - Validates props against LineSchema                            │
│  - Calls ChartRenderer with chartType="Line"                     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  CHART RENDERER                                                  │
│  - Lazy-loads @ant-design/charts Line component                  │
│  - Renders with data and config                                  │
│  - Handles streaming updates with debouncing                     │
└─────────────────────────────────────────────────────────────────┘
```

### Q: How are charts registered in the catalog?

**A:** Charts are registered **by their individual type names** (Line, Bar, Pie), not as a single "Chart" component:

```typescript
// In chartDomainCatalog (registry/factory.tsx)
components: {
  Line: {
    schema: LineSchema,
    renderer: (props) => <ChartRenderer chartType="Line" {...props} />,
    description: "Time-series trends, continuous data",
    defaultEntrance: { property: 'opacity+scale', easing: 'out-cubic' }
  },
  Bar: {
    schema: BarSchema,
    renderer: (props) => <ChartRenderer chartType="Bar" {...props} />,
    // ...
  },
  // ... 35 total chart types
}
```

This means the JSON tree uses the chart type directly:

```json
{
  "type": "Line",
  "props": { "data": [...], "xField": "x", "yField": "y" }
}
```

NOT:

```json
{
  "type": "Chart",
  "props": { "chartType": "Line", ... }
}
```

---

## Tool Usage

### Q: What does the discriminator tool return?

**A:** A `ChartDiscriminatorToolResult` with:

```typescript
interface ChartDiscriminatorToolResult {
  chartType: string        // "Line", "Bar", "Pie", etc.
  config: {
    xField?: string        // Field for X axis
    yField?: string        // Field for Y axis
    seriesField?: string   // Field for multiple series
    colorField?: string    // Field for color encoding
    angleField?: string    // For pie/donut charts
    valueField?: string    // For gauges, etc.
    sourceField?: string   // For flow charts
    targetField?: string   // For flow charts
    additional?: unknown   // Extra config
  }
  confidence: number       // 0-1 confidence score
  rationale: string        // Why this chart was selected
  expectedInsight: string  // What insight the chart reveals
  alternatives: Array<{    // Other good options
    chartType: string
    confidence: number
  }>
  wasAmbiguous: boolean    // Whether request needed assumptions
  reasoning: string        // Overall selection reasoning
}
```

### Q: What errors can the tool return?

**A:** Four error types:

| Error Type | When |
|------------|------|
| `NoSuitableChart` | No chart type fits the data/request |
| `InvalidInput` | Malformed input (missing prompt, etc.) |
| `AmbiguousRequest` | Request too vague, needs clarification |
| `LLMError` | Internal LLM failure |

```typescript
interface ChartDiscriminatorToolError {
  error: true
  errorType: 'NoSuitableChart' | 'InvalidInput' | 'AmbiguousRequest' | 'LLMError'
  message: string
  details?: unknown
}
```

### Q: Can I provide data context to improve selection?

**A:** Yes! The `dataContext` parameter helps the discriminator understand your data:

```typescript
await tools.chart_discriminator.execute({
  userPrompt: "Show me how categories compare",
  dataContext: {
    fields: ["category", "value", "date"],
    shape: "categorical",  // or "time-series", "hierarchical", etc.
    rowCount: 150,
    sampleValues: {
      category: ["Electronics", "Clothing", "Food"],
      value: [1200, 800, 600]
    }
  }
})
```

### Q: Can I constrain which charts are considered?

**A:** Yes, use `constraints`:

```typescript
await tools.chart_discriminator.execute({
  userPrompt: "Visualize the breakdown",
  constraints: {
    // Only consider these charts
    allowedChartTypes: ["Pie", "Treemap", "Sunburst"],

    // Or exclude certain charts
    excludedChartTypes: ["Gauge", "Liquid"],

    // Or filter by category
    allowedCategories: ["part-to-whole", "hierarchical"]
  }
})
```

---

## Streaming

### Q: How does streaming work with charts?

**A:** The `ChartRenderer` supports an `isStreaming` prop that enables smooth progressive rendering:

```tsx
<ChartRenderer
  chartType="Line"
  config={{ xField: "date", yField: "value" }}
  data={streamingData}
  isStreaming={true}
/>
```

When `isStreaming=true`:
- Updates are debounced at ~60fps (16ms)
- Shows loading state when data is empty
- Adds fade-in animation for smooth appearance

### Q: Why debounce streaming updates?

**A:** Without debouncing, rapid data updates (e.g., from SSE/WebSocket) cause:
- Excessive re-renders
- Janky animations
- Browser performance issues

The 16ms debounce (~60fps) ensures smooth visual updates without hammering React.

### Q: What does the loading state look like?

**A:** When streaming with no data yet:
- Component renders at 50% opacity
- Shows the chart skeleton/placeholder
- Transitions to full opacity when data arrives

---

## Available Charts

### Q: What chart types are available?

**A:** 35 chart types across categories:

| Category | Charts |
|----------|--------|
| **Trend** | Line, Area, Stock |
| **Comparison** | Bar, Column, Radar, Rose, BidirectionalBar |
| **Part-to-Whole** | Pie, Treemap, Sunburst, CirclePacking |
| **Distribution** | Scatter, Histogram, Box, Violin |
| **Ranking** | Funnel, Bullet, RadialBar |
| **Flow** | Sankey, Waterfall |
| **Correlation** | DualAxes, Heatmap, Venn |
| **KPI** | Gauge, Liquid |
| **Text** | WordCloud |
| **Hierarchical** | OrganizationChart, MindMap, IndentedTree, Dendrogram, Fishbone |
| **Network** | FlowGraph, NetworkGraph, FlowDirectionGraph |

### Q: Which library renders these?

**A:**
- Statistical charts: `@ant-design/charts`
- Graph/network charts: `@ant-design/graphs`

All components are lazy-loaded on first use to minimize bundle size.

---

## Integration Examples

### Q: How do I add the discriminator to my agent?

**A:**

```typescript
import { createChartDiscriminatorTool } from '@/lib/charts'
import { generateText } from 'ai'

const tools = {
  chart_discriminator: createChartDiscriminatorTool({
    // Optional: provide your own model for the discriminator's internal reasoning
    model: anthropic('claude-3-5-sonnet-20241022')
  })
}

const result = await generateText({
  model: myAgentModel,
  tools,
  system: "You help users visualize data. Use chart_discriminator to select the best chart type.",
  prompt: userMessage
})
```

### Q: How do I render the discriminator's output via json-render?

**A:** After the discriminator returns, emit a JSON patch:

```typescript
// Discriminator returns:
// { chartType: "Line", config: { xField: "date", yField: "sales" }, ... }

// Emit to json-render:
const patch = {
  op: "add",
  path: "/elements/salesChart",
  value: {
    type: discriminatorResult.chartType,  // "Line"
    props: {
      data: yourData,
      ...discriminatorResult.config,      // { xField, yField }
      isStreaming: isDataStreaming
    }
  }
}

streamPatch(patch)
```

### Q: Can the discriminator work server-side?

**A:** Yes. The discriminator uses Effect.runPromise internally, which works in any JS runtime (Node, Bun, Deno). No React or browser APIs required.

```typescript
// Server-side usage
import { createChartDiscriminatorTool } from '@/lib/charts'

const tool = createChartDiscriminatorTool()

// In your API route / server action
const result = await tool.execute({
  userPrompt: "Show quarterly trends",
  dataContext: { fields: ["quarter", "revenue"], shape: "time-series" }
})

return { chartType: result.chartType, config: result.config }
```

---

## Troubleshooting

### Q: The discriminator times out. What's wrong?

**A:** The discriminator uses LLM reasoning internally. Common causes:
- No model configured (uses default)
- Model API rate limiting
- Very complex/ambiguous requests

Try:
1. Provide a more specific `userPrompt`
2. Add `dataContext` to help narrow options
3. Use `constraints` to limit search space

### Q: Charts don't render. How do I debug?

**A:** Check in order:

1. **Is the chart type registered?**
   ```typescript
   import { CHART_DEFINITIONS_BY_TYPE } from '@/lib/charts'
   console.log(CHART_DEFINITIONS_BY_TYPE['Line'])  // Should exist
   ```

2. **Is the data valid?**
   ```typescript
   // Charts need arrays with the right fields
   const data = [{ date: "2025-01", value: 100 }]  // ✓
   const data = { date: "2025-01", value: 100 }    // ✗ Not an array
   ```

3. **Are field names correct?**
   ```typescript
   // xField/yField must match data keys
   config={{ xField: "date", yField: "value" }}
   data={[{ date: "...", value: 100 }]}  // ✓ Keys match
   ```

### Q: How do I see what the discriminator is thinking?

**A:** The `reasoning` field in the result contains the discriminator's thought process:

```typescript
const result = await tool.execute({ userPrompt: "..." })
console.log(result.reasoning)
// "User wants to compare categories. Bar chart is ideal for
//  discrete categorical comparisons. Confidence high because
//  prompt explicitly mentions 'compare' and data has categories."
```

---

## File Locations

| File | Purpose |
|------|---------|
| `src/lib/charts/discriminator/ai-tool.ts` | AI SDK tool wrapper |
| `src/lib/charts/discriminator/agent.ts` | Core discriminator service |
| `src/lib/charts/discriminator/tools.ts` | Internal reasoning tools |
| `src/lib/charts/registry/factory.tsx` | Chart domain catalog |
| `src/lib/charts/components/ChartRenderer.tsx` | Universal chart renderer |
| `src/lib/charts/schemas/` | Effect schemas for each chart |
| `src/lib/charts/index.ts` | Main exports |

---

*Last updated: 2026-01-18*
*Author: Val (Vigilant Architecture Layer)*
