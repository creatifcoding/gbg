/**
 * SIOS Primitives Test Page
 *
 * Visual verification of all 23 primitives across all variants.
 * Route: /sios/primitives
 */

import { useState } from 'react'
import {
  color, space,
  Text, Flex, Grid, Surface, Divider,
  Dot, Badge, Skeleton,
  Indicator, Ring, Gauge, Counter, Countdown, Timestamp,
  TextInput, NumberInput, TextArea, Select, RadioGroup, FileInput,
  Button, ToggleGroup, Overlay,
} from './primitives'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Surface padding={5} style={{ marginBottom: space[4] }}>
      <Text variant="display" size="xl" style={{ marginBottom: space[2] }}>{title}</Text>
      <Divider accent color="jckBlue" spacing={3} />
      <Flex gap={4}>{children}</Flex>
    </Surface>
  )
}

export function SiosPrimitivesTestPage() {
  const [text, setText] = useState('')
  const [num, setNum] = useState(42)
  const [area, setArea] = useState('')
  const [sel, setSel] = useState('mechanical')
  const [radio, setRadio] = useState('pass')
  const [toggle, setToggle] = useState('all')
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [counterVal, setCounterVal] = useState(100000)

  return (
    <div style={{ background: color.bg, minHeight: '100vh', padding: space[6], fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Flex gap={6} style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <Flex gap={1}>
          <Text variant="display" size="4xl">SIOS Primitives</Text>
          <Text variant="caption">23 primitives · 3 fonts · JCK brand-aligned · Dark-first</Text>
        </Flex>

        {/* Typography */}
        <Section title="Typography — Text">
          <Text variant="display">Display — Krona One</Text>
          <Text variant="heading">Heading — Inter Semibold</Text>
          <Text variant="label">Label — JetBrains Mono Uppercase</Text>
          <Text variant="value" color="green">Value — 1,234.56</Text>
          <Text variant="body">Body — Inter Regular, the default reading voice.</Text>
          <Text variant="caption">Caption — smaller secondary info, timestamps, meta.</Text>
          <Flex direction="row" gap={2} wrap>
            <Text variant="value" color="green">Green</Text>
            <Text variant="value" color="cyan">Cyan</Text>
            <Text variant="value" color="amber">Amber</Text>
            <Text variant="value" color="red">Red</Text>
            <Text variant="value" color="gold">Gold</Text>
            <Text variant="value" color="jckBlue">JCK Blue</Text>
          </Flex>
        </Section>

        {/* Layout */}
        <Section title="Layout — Flex / Grid / Surface / Divider">
          <Grid cols={3} gap={3}>
            <Surface padding={3} variant="default"><Text variant="caption">Default surface</Text></Surface>
            <Surface padding={3} variant="inset"><Text variant="caption">Inset surface</Text></Surface>
            <Surface padding={3} variant="elevated"><Text variant="caption">Elevated surface</Text></Surface>
          </Grid>
          <Grid cols={3} gap={3}>
            <Surface padding={3} accent="green" accentSide="bottom" accentWeight="thick"><Text variant="label">Passed</Text></Surface>
            <Surface padding={3} accent="red" accentSide="left"><Text variant="label">Failed</Text></Surface>
            <Surface padding={3} accent="jckBlue" accentSide="top"><Text variant="label">Active</Text></Surface>
          </Grid>
          <Divider />
          <Divider accent color="gold" />
        </Section>

        {/* Feedback */}
        <Section title="Feedback — Dot / Badge / Skeleton">
          <Flex direction="row" gap={3} align="center">
            <Dot color="green" pulse /> <Text variant="caption">Active</Text>
            <Dot color="amber" /> <Text variant="caption">Warning</Text>
            <Dot color="red" /> <Text variant="caption">Error</Text>
            <Dot color="cyan" pulse size="lg" /> <Text variant="caption">Pulsing</Text>
          </Flex>
          <Flex direction="row" gap={2} wrap>
            <Badge color="green">PASSED</Badge>
            <Badge color="red" variant="solid">CRITICAL</Badge>
            <Badge color="amber" variant="outline">⚠ EXPIRING</Badge>
            <Badge color="cyan">ACTIVE</Badge>
            <Badge color="jckBlue">P1</Badge>
            <Badge color="muted">CLOSED</Badge>
          </Flex>
          <Grid cols={2} gap={3}>
            <Skeleton variant="text" lines={3} />
            <Skeleton variant="rect" height={60} />
          </Grid>
        </Section>

        {/* Data Display */}
        <Section title="Data Display — Indicator / Ring / Gauge / Counter / Countdown / Timestamp">
          <Flex direction="row" gap={4} align="center" wrap>
            <Flex gap={2} style={{ width: 200 }}>
              <Text variant="label">Progress</Text>
              <Indicator value={0.72} color="green" />
              <Indicator value={0.41} color="amber" />
              <Indicator value={0.15} color="red" />
            </Flex>
            <Ring value={0.72} color="green" size={80}>
              <Text variant="value" size="lg" color="green">72%</Text>
            </Ring>
            <Gauge
              value={1.11} min={0} max={2}
              thresholds={[{ at: 0, color: 'red' }, { at: 0.85, color: 'amber' }, { at: 1.0, color: 'green' }]}
              label="CPI" size={120}
            />
          </Flex>
          <Flex direction="row" gap={4} align="center" wrap>
            <Flex gap={1} align="center">
              <Counter value={counterVal} prefix="$" format="currency" color="cyan" />
              <Button size="sm" variant="ghost" onClick={() => setCounterVal(v => v + 50000)}>+$50K</Button>
            </Flex>
            <Countdown deadline={new Date(Date.now() + 3600000 * 2.5)} format="hms" />
            <Timestamp date={new Date()} variant="datetime" />
          </Flex>
        </Section>

        {/* Inputs */}
        <Section title="Inputs — TextInput / NumberInput / TextArea / Select / RadioGroup / FileInput">
          <Grid cols={2} gap={3}>
            <TextInput label="Project Name" value={text} onChange={setText} placeholder="DFW Terminal B" />
            <NumberInput label="Budget" value={num} onChange={setNum} unit="$K" min={0} />
            <TextArea label="Description" value={area} onChange={setArea} placeholder="Enter project description..." />
            <Select label="Discipline" value={sel} onChange={setSel} options={[
              { value: 'mechanical', label: 'Mechanical' },
              { value: 'electrical', label: 'Electrical' },
              { value: 'controls', label: 'Controls' },
            ]} />
          </Grid>
          <Flex direction="row" gap={6}>
            <RadioGroup label="Inspection Result" value={radio} onChange={setRadio} options={[
              { value: 'pass', label: 'Pass', description: 'All criteria met' },
              { value: 'fail', label: 'Fail', description: 'Rework required' },
              { value: 'waive', label: 'Waive', description: 'Client accepted deficiency' },
            ]} />
            <FileInput label="Evidence Photo" accept="image/*" onSelect={(f) => console.log(f.name)} />
          </Flex>
          <TextInput label="With Error" value="" onChange={() => {}} error="This field is required" required />
        </Section>

        {/* Interactive */}
        <Section title="Interactive — Button / ToggleGroup / Overlay">
          <Flex direction="row" gap={2} wrap>
            <Button color="jckBlue" arrow>Award Project</Button>
            <Button color="green" arrow>Complete Task</Button>
            <Button color="red" variant="outline">✗ Block</Button>
            <Button color="amber" variant="ghost">⏸ Hold</Button>
            <Button disabled>Disabled</Button>
            <Button loading color="cyan">Processing</Button>
          </Flex>
          <ToggleGroup
            options={[
              { key: 'all', label: 'Show All' },
              { key: 'deployable', label: 'Deployable', color: 'cyan' },
              { key: 'expiring', label: 'Expiring (30d)', color: 'amber', count: 3 },
            ]}
            active={toggle}
            onChange={setToggle}
          />
          <Button variant="outline" color="gold" onClick={() => setOverlayOpen(true)}>Open Overlay →</Button>
          <Overlay open={overlayOpen} onClose={() => setOverlayOpen(false)}>
            <Flex gap={4} style={{ padding: space[5] }}>
              <Text variant="heading">Complete Task</Text>
              <Text variant="caption">Record actual work performed on this task.</Text>
              <NumberInput label="Actual Qty" value={400} onChange={() => {}} unit="LM" />
              <NumberInput label="Actual Hours" value={180} onChange={() => {}} unit="h" />
              <Flex direction="row" gap={2} justify="end">
                <Button variant="ghost" onClick={() => setOverlayOpen(false)}>Cancel</Button>
                <Button color="green" arrow onClick={() => setOverlayOpen(false)}>Submit</Button>
              </Flex>
            </Flex>
          </Overlay>
        </Section>

      </Flex>
    </div>
  )
}
