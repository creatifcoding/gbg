/**
 * RVN Component Library Testbed
 *
 * Visual gallery showcasing all RVN components in the brutalist design system.
 * Uses TestbedProvider for design mode and component registration.
 */

import * as React from 'react'
import {
  RvnProvider,
  RvnButton,
  RvnIconButton,
  RvnInput,
  RvnTextarea,
  RvnCheckbox,
  RvnDropdown,
  RvnBadge,
  RvnStatusDot,
  RvnTelemetryBar,
  RvnThreatMeter,
  RvnIndicator,
  RvnParameterTag,
  RvnPanel,
  RvnCard,
  RvnModal,
  RvnHeader,
  RvnNavItem,
  RvnTabBar,
  RvnTabButton,
  RvnBreadcrumb,
  RvnFooter,
  RvnTable,
  RvnEquipmentCard,
  RvnUnitCard,
  RvnObjectiveItem,
  RvnThreatStat,
  RvnLogEntry,
  RvnIntelCard,
  RvnThreatCard,
} from '@/lib/rvn'
import { TmnlDataGrid, rvnBrutalist } from '@/lib/data-grid'
import type { ColDef } from 'ag-grid-community'
import {
  TestbedProvider,
  ComponentBox as EnhancedComponentBox,
  useDesignMode,
} from '@/lib/testbed'

// Sample data for the data grid
interface UnitData {
  id: string
  unitCode: string
  status: string
  sector: string
  powerLevel: number
  lastContact: string
}

const SAMPLE_UNIT_DATA: UnitData[] = [
  { id: '1', unitCode: 'TX-99', status: 'NOMINAL', sector: 'S07', powerLevel: 85, lastContact: '14:32:00' },
  { id: '2', unitCode: 'RX-47', status: 'ALERT', sector: 'S12', powerLevel: 42, lastContact: '14:28:15' },
  { id: '3', unitCode: 'AX-01', status: 'OFFLINE', sector: 'S03', powerLevel: 0, lastContact: '12:00:00' },
  { id: '4', unitCode: 'BX-88', status: 'NOMINAL', sector: 'S07', powerLevel: 91, lastContact: '14:31:45' },
  { id: '5', unitCode: 'CX-12', status: 'NOMINAL', sector: 'S09', powerLevel: 78, lastContact: '14:30:22' },
]

const UNIT_COLUMN_DEFS: ColDef<UnitData>[] = [
  { field: 'unitCode', headerName: 'UNIT', width: 100 },
  { field: 'status', headerName: 'STATUS', width: 100 },
  { field: 'sector', headerName: 'SECTOR', width: 80 },
  { field: 'powerLevel', headerName: 'POWER %', width: 100 },
  { field: 'lastContact', headerName: 'LAST CONTACT', width: 120 },
]

// -----------------------------------------------------------------------------
// Section Component
// -----------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '60px' }}>
      <h2
        style={{
          fontFamily: "'Helvetica Neue', sans-serif",
          fontSize: '24px',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '-0.02em',
          borderBottom: '3px solid #000',
          paddingBottom: '10px',
          marginBottom: '30px',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px',
          alignItems: 'flex-start',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Simple ComponentBox for testbed display.
 * For enhanced features (source code, isolation, design mode),
 * use EnhancedComponentBox from @/lib/testbed
 */
function ComponentBox({
  label,
  children,
  id,
  description,
}: {
  label: string
  children: React.ReactNode
  id?: string
  description?: string
}) {
  return (
    <EnhancedComponentBox
      id={id}
      label={label}
      description={description}
      showSource={true}
      isolatable={true}
    >
      {children}
    </EnhancedComponentBox>
  )
}

// -----------------------------------------------------------------------------
// Design Mode Toolbar
// -----------------------------------------------------------------------------

function DesignModeToolbar() {
  const { isActive, toggleActive, selectedComponentId, resetAllOverrides, allStyleOverrides } =
    useDesignMode()

  const overrideCount = allStyleOverrides.size

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        padding: '8px 12px',
        background: isActive ? '#1e293b' : '#fff',
        border: '2px solid #000',
        boxShadow: '4px 4px 0 #000',
        fontFamily: "'Courier New', monospace",
        fontSize: '12px',
      }}
    >
      <button
        onClick={toggleActive}
        style={{
          background: isActive ? '#3b82f6' : '#e5e5e5',
          color: isActive ? '#fff' : '#000',
          border: '1px solid #000',
          padding: '4px 8px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        {isActive ? 'DESIGN: ON' : 'DESIGN: OFF'}
      </button>

      {isActive && (
        <>
          <span style={{ color: '#94a3b8' }}>|</span>
          <span style={{ color: isActive ? '#94a3b8' : '#666' }}>
            {selectedComponentId ? `SELECTED: ${selectedComponentId}` : 'CLICK TO SELECT'}
          </span>

          {overrideCount > 0 && (
            <>
              <span style={{ color: '#94a3b8' }}>|</span>
              <span style={{ color: '#f59e0b' }}>{overrideCount} OVERRIDES</span>
              <button
                onClick={resetAllOverrides}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: '1px solid #000',
                  padding: '2px 6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                RESET ALL
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Main Testbed
// -----------------------------------------------------------------------------

function RvnTestbedContent() {
  const [modalOpen, setModalOpen] = React.useState(false)
  const [checkboxChecked, setCheckboxChecked] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState(0)
  const [inputValue, setInputValue] = React.useState('')
  const [dropdownValue, setDropdownValue] = React.useState('option1')

  // Animation demo state
  const [animatedValue, setAnimatedValue] = React.useState(25)
  const [threatLevel, setThreatLevel] = React.useState<'low' | 'moderate' | 'high' | 'critical'>('low')

  // Cycle through values for demo
  const cycleValue = () => {
    setAnimatedValue((v) => (v >= 100 ? 0 : v + 25))
  }
  const cycleThreat = () => {
    const levels: Array<'low' | 'moderate' | 'high' | 'critical'> = ['low', 'moderate', 'high', 'critical']
    setThreatLevel((l) => levels[(levels.indexOf(l) + 1) % 4])
  }
  const randomValue = () => {
    setAnimatedValue(Math.floor(Math.random() * 101))
  }

  return (
    <RvnProvider>
      <div
        style={{
          padding: '60px',
          background: '#e6e6e6',
          minHeight: '100vh',
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      >
        <h1
          style={{
            fontSize: '80px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            marginBottom: '60px',
          }}
        >
          RVN
          <br />
          <span style={{ fontSize: '24px', fontWeight: 400 }}>
            COMPONENT LIBRARY
          </span>
        </h1>

        {/* PRIMITIVES */}
        <Section title="Primitives">
          <ComponentBox label="Button">
            <RvnButton>DEPLOY</RvnButton>
          </ComponentBox>
          <ComponentBox label="Button Ghost">
            <RvnButton variant="ghost">CANCEL</RvnButton>
          </ComponentBox>
          <ComponentBox label="Button Disabled">
            <RvnButton disabled>DISABLED</RvnButton>
          </ComponentBox>
          <ComponentBox label="Icon Button">
            <RvnIconButton title="Close">✕</RvnIconButton>
          </ComponentBox>
          <ComponentBox label="Input">
            <RvnInput
              placeholder="UNIT ID"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </ComponentBox>
          <ComponentBox label="Textarea">
            <RvnTextarea placeholder="Notes..." rows={3} />
          </ComponentBox>
          <ComponentBox label="Checkbox">
            <RvnCheckbox
              label="ACTIVE ONLY"
              checked={checkboxChecked}
              onChange={(e) => setCheckboxChecked(e.target.checked)}
            />
          </ComponentBox>
          <ComponentBox label="Dropdown">
            <RvnDropdown
              value={dropdownValue}
              onChange={(e) => setDropdownValue(e.target.value)}
              options={[
                { value: 'option1', label: 'Option 1' },
                { value: 'option2', label: 'Option 2' },
                { value: 'option3', label: 'Option 3' },
              ]}
            />
          </ComponentBox>
        </Section>

        {/* DISPLAY */}
        <Section title="Display">
          <ComponentBox label="Badge">
            <RvnBadge>NOMINAL</RvnBadge>
          </ComponentBox>
          <ComponentBox label="Badge Filled">
            <RvnBadge variant="filled">ALERT</RvnBadge>
          </ComponentBox>
          <ComponentBox label="Status Dots">
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <RvnStatusDot status="active" />
              <RvnStatusDot status="alert" />
              <RvnStatusDot status="offline" />
            </div>
          </ComponentBox>
          <ComponentBox label="Telemetry Bar">
            <RvnTelemetryBar percentage={75} showLabel />
          </ComponentBox>
          <ComponentBox label="Telemetry Bar Critical">
            <RvnTelemetryBar percentage={15} criticalThreshold={30} showLabel />
          </ComponentBox>
          <ComponentBox label="Threat Meter">
            <RvnThreatMeter level="moderate" />
          </ComponentBox>
          <ComponentBox label="Indicator">
            <div style={{ display: 'flex', gap: '15px' }}>
              <RvnIndicator status="active" label="Online" />
              <RvnIndicator status="offline" label="Offline" />
            </div>
          </ComponentBox>
          <ComponentBox label="Parameter Tag">
            <RvnParameterTag>TX-99-ALPHA</RvnParameterTag>
          </ComponentBox>
        </Section>

        {/* ANIMATED BARS - Anime.js Powered */}
        <Section title="Animated Bars (Anime.js)">
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <RvnButton onClick={cycleValue}>CYCLE +25%</RvnButton>
              <RvnButton onClick={randomValue}>RANDOM</RvnButton>
              <RvnButton onClick={cycleThreat}>CYCLE THREAT</RvnButton>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', alignSelf: 'center' }}>
                VALUE: {animatedValue}% | THREAT: {threatLevel.toUpperCase()}
              </span>
            </div>

            {/* Smooth Easings */}
            <ComponentBox label="Smooth (easeOutQuart)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} />
            </ComponentBox>

            <ComponentBox label="Fast (easeOutQuart 200ms)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} animation="fast" />
            </ComponentBox>

            <ComponentBox label="Slow (easeOutQuint 600ms)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} animation="slow" />
            </ComponentBox>

            {/* Spring Physics */}
            <ComponentBox label="Spring Physics (organic)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} animation="spring" />
            </ComponentBox>

            <ComponentBox label="Spring Snappy (quick settle)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} animation="springSnappy" />
            </ComponentBox>

            <ComponentBox label="Spring Bouncy (playful)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} animation="springBouncy" />
            </ComponentBox>

            {/* Elastic / Bounce / Back */}
            <ComponentBox label="Elastic (rubberband)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} animation="elastic" />
            </ComponentBox>

            <ComponentBox label="Bounce (ball drop)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} animation="bounce" />
            </ComponentBox>

            <ComponentBox label="Back (overshoot)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} animation="back" />
            </ComponentBox>

            {/* Stepped */}
            <ComponentBox label="Stepped Coarse (4 steps)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} animation="steppedCoarse" />
            </ComponentBox>

            <ComponentBox label="Stepped Fine (20 steps)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} animation="steppedFine" />
            </ComponentBox>

            {/* Custom Spring Config */}
            <ComponentBox label="Custom Spring (stiff)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={200}
                animation={{ spring: [1, 200, 15, 0] }}
              />
            </ComponentBox>

            {/* Threat Meters */}
            <ComponentBox label="Threat Meter (Spring)">
              <RvnThreatMeter level={threatLevel} showLabel animation="spring" />
            </ComponentBox>

            <ComponentBox label="Threat Meter (Elastic)">
              <RvnThreatMeter level={threatLevel} showLabel animation="elastic" />
            </ComponentBox>

            {/* Cinematic */}
            <ComponentBox label="Cinematic (slow dramatic)">
              <RvnTelemetryBar percentage={animatedValue} showLabel width={200} animation="cinematic" />
            </ComponentBox>
          </div>
        </Section>

        {/* GRADIENT TRANSITIONS */}
        <Section title="Gradient Transitions">
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <RvnButton onClick={cycleValue}>CYCLE +25%</RvnButton>
              <RvnButton onClick={randomValue}>RANDOM</RvnButton>
              <span style={{ fontFamily: 'monospace', fontSize: '12px', alignSelf: 'center' }}>
                VALUE: {animatedValue}%
              </span>
            </div>

            {/* Preset Gradients */}
            <ComponentBox label="Traffic (green → yellow → red)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={250}
                animation="spring"
                gradient="traffic"
              />
            </ComponentBox>

            <ComponentBox label="Traffic Inverse (red → yellow → green)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={250}
                animation="spring"
                gradient="trafficInverse"
              />
            </ComponentBox>

            <ComponentBox label="Heat (blue → cyan → green → yellow → red)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={250}
                animation="spring"
                gradient="heat"
              />
            </ComponentBox>

            <ComponentBox label="System (CPU/Memory style)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={250}
                animation="spring"
                gradient="system"
              />
            </ComponentBox>

            <ComponentBox label="Alert (threshold-based)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={250}
                animation="spring"
                gradient="alert"
              />
            </ComponentBox>

            <ComponentBox label="Cyber (cyan → purple → pink)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={250}
                animation="elastic"
                gradient="cyber"
              />
            </ComponentBox>

            <ComponentBox label="Terminal (matrix green)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={250}
                animation="spring"
                gradient="terminal"
              />
            </ComponentBox>

            <ComponentBox label="Cool (blue tones)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={250}
                animation="spring"
                gradient="cool"
              />
            </ComponentBox>

            <ComponentBox label="Warm (orange → red → magenta)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={250}
                animation="spring"
                gradient="warm"
              />
            </ComponentBox>

            {/* Custom Gradient */}
            <ComponentBox label="Custom (blue → purple → pink)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={250}
                animation="springBouncy"
                gradient={[
                  { stop: 0, color: '#3b82f6' },
                  { stop: 50, color: '#8b5cf6' },
                  { stop: 100, color: '#ec4899' },
                ]}
              />
            </ComponentBox>

            {/* Critical Override Demo */}
            <ComponentBox label="Gradient + Critical (stripes below 30%)">
              <RvnTelemetryBar
                percentage={animatedValue}
                showLabel
                width={250}
                animation="spring"
                gradient="traffic"
                criticalThreshold={30}
              />
            </ComponentBox>
          </div>
        </Section>

        {/* LAYOUT */}
        <Section title="Layout">
          <ComponentBox label="Panel">
            <RvnPanel.Root style={{ width: '300px' }}>
              <RvnPanel.Header>
                <RvnPanel.Title>System Status</RvnPanel.Title>
                <RvnPanel.Subtitle>TRACKING: ON</RvnPanel.Subtitle>
              </RvnPanel.Header>
              <RvnPanel.Content>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  All systems operational.
                </p>
              </RvnPanel.Content>
              <RvnPanel.Footer>LAT 34.0522 N</RvnPanel.Footer>
            </RvnPanel.Root>
          </ComponentBox>
          <ComponentBox label="Card">
            <RvnCard style={{ width: '200px' }}>
              <div style={{ padding: '15px' }}>Card content</div>
            </RvnCard>
          </ComponentBox>
          <ComponentBox label="Modal Trigger">
            <RvnButton onClick={() => setModalOpen(true)}>OPEN MODAL</RvnButton>
          </ComponentBox>
        </Section>

        {/* NAVIGATION */}
        <Section title="Navigation">
          <ComponentBox label="Header">
            <RvnHeader style={{ width: '400px' }}>
              <div style={{ fontWeight: 900 }}>BRAND</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <RvnNavItem active>Home</RvnNavItem>
                <RvnNavItem>Fleet</RvnNavItem>
                <RvnNavItem>Intel</RvnNavItem>
              </div>
            </RvnHeader>
          </ComponentBox>
          <ComponentBox label="Tab Bar">
            <RvnTabBar>
              <RvnTabButton active={activeTab === 0} onClick={() => setActiveTab(0)}>
                All Units
              </RvnTabButton>
              <RvnTabButton active={activeTab === 1} onClick={() => setActiveTab(1)}>
                Critical
              </RvnTabButton>
              <RvnTabButton active={activeTab === 2} onClick={() => setActiveTab(2)}>
                Offline
              </RvnTabButton>
            </RvnTabBar>
          </ComponentBox>
          <ComponentBox label="Breadcrumb">
            <RvnBreadcrumb path="Fleet / Sector 09 / TX-99" />
          </ComponentBox>
          <ComponentBox label="Footer">
            <RvnFooter style={{ width: '400px' }}>
              <span>SYSTEM v2.4.1</span>
              <span>2026-01-30 14:32:00</span>
            </RvnFooter>
          </ComponentBox>
        </Section>

        {/* DATA */}
        <Section title="Data">
          <ComponentBox label="Table">
            <RvnTable style={{ width: '400px' }}>
              <RvnTable.Header>
                <RvnTable.HeaderCell>Op ID</RvnTable.HeaderCell>
                <RvnTable.HeaderCell>Status</RvnTable.HeaderCell>
                <RvnTable.HeaderCell>Result</RvnTable.HeaderCell>
              </RvnTable.Header>
              <RvnTable.Body>
                <RvnTable.Row>
                  <RvnTable.Cell>OP_GHOST</RvnTable.Cell>
                  <RvnTable.Cell>COMPLETE</RvnTable.Cell>
                  <RvnTable.Cell>SUCCESS</RvnTable.Cell>
                </RvnTable.Row>
                <RvnTable.Row>
                  <RvnTable.Cell>OP_SLEDGE</RvnTable.Cell>
                  <RvnTable.Cell>ACTIVE</RvnTable.Cell>
                  <RvnTable.Cell>PENDING</RvnTable.Cell>
                </RvnTable.Row>
              </RvnTable.Body>
            </RvnTable>
          </ComponentBox>
        </Section>

        {/* DATA GRID (AG-Grid with RVN Brutalist Variant) */}
        <Section title="Data Grid (AG-Grid)">
          <div style={{ width: '100%', maxWidth: '800px' }}>
            <div
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: '10px',
                textTransform: 'uppercase',
                color: '#666',
                marginBottom: '15px',
              }}
            >
              TmnlDataGrid with rvnBrutalist variant — Click to select (invert microinteraction)
            </div>
            <div style={{ height: '250px', border: '3px solid #000' }}>
              <TmnlDataGrid
                variant={rvnBrutalist}
                rowData={SAMPLE_UNIT_DATA}
                columnDefs={UNIT_COLUMN_DEFS}
                getRowId={(params) => params.data.id}
              />
            </div>
          </div>
        </Section>

        {/* CARDS */}
        <Section title="Cards">
          <ComponentBox label="Equipment Card">
            <RvnEquipmentCard
              category="PRIMARY WEAPON"
              model="Rail Cannon MK-IV"
              status="NOMINAL"
            />
          </ComponentBox>
          <ComponentBox label="Unit Card">
            <RvnUnitCard
              code="TX-99"
              status="NOMINAL"
              powerLevel={85}
            />
          </ComponentBox>
          <ComponentBox label="Unit Card Selected">
            <RvnUnitCard
              code="RX-47"
              status="ALERT"
              powerLevel={42}
              selected
            />
          </ComponentBox>
          <ComponentBox label="Objective Item">
            <RvnObjectiveItem
              label="Secure perimeter"
              status="COMPLETE"
            />
          </ComponentBox>
          <ComponentBox label="Threat Stat">
            <RvnThreatStat
              label="Hostiles"
              value="12"
            />
          </ComponentBox>
          <ComponentBox label="Log Entry">
            <RvnLogEntry
              timestamp="14:32:00"
              message="Connection established"
            />
          </ComponentBox>
          <ComponentBox label="Log Entry Alert">
            <RvnLogEntry
              timestamp="14:33:15"
              message="Anomaly detected"
              level="ALERT"
            />
          </ComponentBox>
          <ComponentBox label="Intel Card">
            <RvnIntelCard
              classification="SECRET"
              title="Movement Analysis"
              summary="Hostile assets detected in sector 7-G."
              source="SIGINT-4A"
              timestamp="14:32Z"
              priority="high"
            />
          </ComponentBox>
          <ComponentBox label="Threat Card">
            <RvnThreatCard
              threatId="THR-2847"
              threatType="Hostile Vehicle"
              level="high"
              description="Unidentified vehicle approaching perimeter."
              coordinates={{ lat: 34.0522, lng: -118.2437 }}
            />
          </ComponentBox>
        </Section>

        {/* COMPOUND COMPONENT */}
        <Section title="Compound Component (RvnCard)">
          <ComponentBox label="Composed Equipment">
            <RvnCard variant="equipment" style={{ width: '200px' }}>
              <RvnCard.Body>
                <RvnCard.Category>COMMS</RvnCard.Category>
                <RvnCard.Title>SATLINK-V2</RvnCard.Title>
                <RvnCard.Status status="nominal">ONLINE</RvnCard.Status>
              </RvnCard.Body>
            </RvnCard>
          </ComponentBox>
          <ComponentBox label="Composed Unit">
            <RvnCard variant="unit" shadow="lg" style={{ width: '240px' }}>
              <RvnCard.Header>
                <RvnCard.Title>RX-42</RvnCard.Title>
                <RvnCard.Status status="alert">ALERT</RvnCard.Status>
              </RvnCard.Header>
              <RvnCard.Body>
                <RvnCard.Telemetry value={67} label="Power Core" />
                <RvnCard.StatGroup>
                  <RvnCard.Stat label="Sector" value="S07" orientation="vertical" />
                  <RvnCard.Stat label="Mission" value="PATROL" orientation="vertical" />
                </RvnCard.StatGroup>
              </RvnCard.Body>
              <RvnCard.Actions>
                <RvnCard.Action>View Details</RvnCard.Action>
              </RvnCard.Actions>
            </RvnCard>
          </ComponentBox>
          <ComponentBox label="Composed Intel">
            <RvnCard variant="intel" style={{ width: '280px', borderLeft: '6px solid #000' }}>
              <RvnCard.Header classification>TOP SECRET</RvnCard.Header>
              <RvnCard.Body>
                <RvnCard.Title style={{ fontSize: '14px', textTransform: 'uppercase' }}>
                  Intercept Report
                </RvnCard.Title>
                <RvnCard.Subtitle>
                  Communications detected from unknown source.
                </RvnCard.Subtitle>
              </RvnCard.Body>
              <RvnCard.Footer>
                <span>ELINT-7B</span>
                <RvnCard.Divider />
                <span>09:15Z</span>
              </RvnCard.Footer>
            </RvnCard>
          </ComponentBox>
          <ComponentBox label="Composed Threat">
            <RvnCard variant="threat" style={{ width: '280px' }}>
              <RvnCard.Header>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}># THR-9921</span>
                <RvnCard.Meter level="critical" />
              </RvnCard.Header>
              <RvnCard.Body>
                <RvnCard.Stat label="Type" value="Air Defense" />
                <RvnCard.Subtitle>
                  SAM site active, tracking radar detected.
                </RvnCard.Subtitle>
              </RvnCard.Body>
              <RvnCard.Footer>
                <span>LAT 35.6892</span>
                <RvnCard.Divider />
                <span>LNG 139.6917</span>
              </RvnCard.Footer>
            </RvnCard>
          </ComponentBox>
        </Section>

        {/* MODAL */}
        <RvnModal.Root open={modalOpen} onOpenChange={setModalOpen}>
          <RvnModal.Portal>
            <RvnModal.Backdrop />
            <RvnModal.Content>
              <RvnModal.Header>
                <RvnModal.Title>Unit Details</RvnModal.Title>
              </RvnModal.Header>
              <RvnModal.Body>
                <p>This is modal content demonstrating the RVN modal component.</p>
                <p>Press Escape or click outside to close.</p>
              </RvnModal.Body>
              <RvnModal.Footer>
                <RvnButton variant="ghost" onClick={() => setModalOpen(false)}>
                  CANCEL
                </RvnButton>
                <RvnButton onClick={() => setModalOpen(false)}>CONFIRM</RvnButton>
              </RvnModal.Footer>
            </RvnModal.Content>
          </RvnModal.Portal>
        </RvnModal.Root>
      </div>
    </RvnProvider>
  )
}

// -----------------------------------------------------------------------------
// Exported Component with TestbedProvider
// -----------------------------------------------------------------------------

export function RvnTestbed() {
  return (
    <TestbedProvider>
      <DesignModeToolbar />
      <RvnTestbedContent />
    </TestbedProvider>
  )
}

export default RvnTestbed
