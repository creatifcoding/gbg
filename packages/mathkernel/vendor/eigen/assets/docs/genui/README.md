# Generative UI Documentation

> Stream-first, AI-native component rendering system

## Documents

| Document | Description |
|----------|-------------|
| [Chart Integration Q&A](./chart-integration-qa.md) | Chart discriminator + genifer integration |

## Quick Start

```typescript
import { createChartDiscriminatorTool } from '@/lib/charts'

// 1. Create the tool
const tools = {
  chart_discriminator: createChartDiscriminatorTool()
}

// 2. AI agent uses the tool
const result = await tools.chart_discriminator.execute({
  userPrompt: "Show me sales trends over time",
  dataContext: {
    fields: ["date", "sales", "region"],
    shape: "time-series"
  }
})

// 3. Result
// {
//   chartType: "Line",
//   config: { xField: "date", yField: "sales", seriesField: "region" },
//   confidence: 0.92,
//   rationale: "Time-series data with multiple regions → multi-line chart"
// }

// 4. Render via genifer
const uiTree = {
  root: "chart1",
  elements: {
    chart1: {
      type: result.chartType,  // "Line"
      props: {
        data: yourData,
        ...result.config
      }
    }
  }
}
```

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│    AI Agent         │────▶│ Chart Discriminator │────▶│    genifer      │
│  (any AI SDK)       │     │  (tool wrapper)     │     │  (streaming UI)     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
         │                           │                           │
         │ "visualize sales"         │ chartType: "Line"         │ <Line ... />
         │                           │ config: {...}             │
         ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              35 Chart Types                                  │
│  Line · Area · Bar · Pie · Scatter · Radar · Gauge · Sankey · ...           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

- **Chart Discriminator**: LLM-augmented agent that selects optimal chart types
- **AI SDK Tool**: `createChartDiscriminatorTool()` wraps discriminator for any agent
- **genifer**: Stream-first component rendering from AI-generated JSON
- **Chart Catalog**: 35 chart types registered by name (Line, Bar, not "Chart")
- **Streaming**: `isStreaming` prop enables 60fps debounced updates

## Related Code

```
src/lib/charts/
├── discriminator/
│   ├── ai-tool.ts      # External tool wrapper
│   ├── agent.ts        # Core discriminator service
│   ├── tools.ts        # Internal reasoning tools
│   └── schemas.ts      # Input/output schemas
├── registry/
│   └── factory.tsx     # Chart domain catalog
├── components/
│   └── ChartRenderer.tsx  # Universal renderer
└── index.ts            # Main exports
```
