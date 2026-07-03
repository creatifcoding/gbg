import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const COLORS = {
  bg: "#080d11",
  panel: "rgba(12, 24, 31, 0.82)",
  panel2: "rgba(20, 34, 42, 0.72)",
  cream: "#f4ead2",
  muted: "#9fb2b8",
  amber: "#ffc56d",
  cyan: "#70e4ff",
  green: "#86efac",
  red: "#ff7a7a",
  wire: "#b5c4c9",
};

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const fade = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      background: COLORS.panel,
      border: `1px solid rgba(112, 228, 255, 0.24)`,
      boxShadow: "0 20px 80px rgba(0,0,0,0.42), inset 0 0 30px rgba(112,228,255,0.05)",
      borderRadius: 28,
      padding: 28,
      ...style,
    }}
  >
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode; tone?: "cyan" | "amber" | "green" | "red" }> = ({
  children,
  tone = "cyan",
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      alignSelf: "flex-start",
      height: 34,
      padding: "0 14px",
      borderRadius: 999,
      color: COLORS[tone],
      border: `1px solid ${COLORS[tone]}55`,
      background: `${COLORS[tone]}14`,
      fontSize: 16,
      fontWeight: 800,
      letterSpacing: 1.1,
      textTransform: "uppercase",
    }}
  >
    {children}
  </div>
);

const Wire: React.FC<{ x1: number; y1: number; x2: number; y2: number; color?: string; active?: number }> = ({
  x1,
  y1,
  x2,
  y2,
  color = COLORS.wire,
  active = 1,
}) => (
  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={5}
      strokeLinecap="round"
      opacity={0.18 + active * 0.62}
      strokeDasharray="12 14"
      strokeDashoffset={-active * 80}
    />
  </svg>
);

const SineWave: React.FC<{
  width: number;
  height: number;
  cycles: number;
  amplitude: number;
  color: string;
  strokeWidth?: number;
  phase?: number;
  opacity?: number;
}> = ({ width, height, cycles, amplitude, color, strokeWidth = 5, phase = 0, opacity = 1 }) => {
  const points: string[] = [];
  const mid = height / 2;
  for (let x = 0; x <= width; x += 5) {
    const t = (x / width) * cycles * Math.PI * 2 + phase;
    points.push(`${x},${mid + Math.sin(t) * amplitude}`);
  }
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    </svg>
  );
};

const DataOnMains: React.FC = () => {
  const frame = useCurrentFrame();
  const intro = fade(frame, 28, 54);
  const data = fade(frame, 76, 105);
  return (
    <AbsoluteFill style={{ padding: 74, color: COLORS.cream }}>
      <div style={{ opacity: fade(frame, 0, 20) }}>
        <Label tone="amber">physics</Label>
        <h1 style={{ fontSize: 60, margin: "22px 0 10px", lineHeight: 1.02 }}>One conductor. Two frequency worlds.</h1>
        <p style={{ fontSize: 24, margin: 0, color: COLORS.muted, maxWidth: 900 }}>
          Powerline networking rides a tiny MHz data signal on top of the big slow mains waveform.
        </p>
      </div>

      <Card style={{ marginTop: 52, height: 360, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 46, top: 38, fontSize: 20, color: COLORS.amber, fontWeight: 800 }}>
          50/60 Hz mains power
        </div>
        <div style={{ position: "absolute", right: 50, top: 38, fontSize: 20, color: COLORS.cyan, fontWeight: 800, opacity: data }}>
          MHz data carrier
        </div>
        <div style={{ position: "absolute", left: 54, top: 118, opacity: 0.92 }}>
          <SineWave width={1050} height={160} cycles={2.15} amplitude={58} color={COLORS.amber} strokeWidth={7} phase={frame * 0.055} />
        </div>
        <div style={{ position: "absolute", left: 54, top: 118, opacity: data }}>
          <SineWave width={1050} height={160} cycles={46} amplitude={10} color={COLORS.cyan} strokeWidth={3} phase={frame * 0.42} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 70,
            bottom: 38,
            opacity: intro,
            fontSize: 27,
            fontWeight: 800,
            color: COLORS.cream,
          }}
        >
          voltage(t) = power sine wave <span style={{ color: COLORS.cyan, opacity: data }}>+ tiny fast data wiggles</span>
        </div>
      </Card>
    </AbsoluteFill>
  );
};

const AdapterExploded: React.FC = () => {
  const frame = useCurrentFrame();
  const a = fade(frame, 0, 24);
  const p1 = fade(frame, 30, 52);
  const p2 = fade(frame, 58, 80);
  const p3 = fade(frame, 86, 108);
  const p4 = fade(frame, 114, 136);
  const blocks = [
    { title: "Ethernet bridge", body: "Frames in / frames out", color: COLORS.green, o: p1 },
    { title: "PLC modem", body: "OFDM modulation + encryption", color: COLORS.cyan, o: p2 },
    { title: "Analog front-end", body: "filters, gain, channel sensing", color: COLORS.amber, o: p3 },
    { title: "Mains coupling", body: "isolation + surge protection", color: COLORS.red, o: p4 },
  ];
  return (
    <AbsoluteFill style={{ padding: 70, color: COLORS.cream }}>
      <div style={{ opacity: a }}>
        <Label>why the adapter exists</Label>
        <h1 style={{ fontSize: 58, margin: "20px 0 8px" }}>It is not a plug. It is a modem.</h1>
        <p style={{ fontSize: 23, color: COLORS.muted, margin: 0 }}>Ethernet electrical signaling cannot survive direct contact with wall power. Rude, but fair.</p>
      </div>

      <div style={{ position: "relative", height: 430, marginTop: 54 }}>
        <Wire x1={185} y1={210} x2={1025} y2={210} color={COLORS.cyan} active={fade(frame, 36, 130)} />
        {blocks.map((b, i) => (
          <Card
            key={b.title}
            style={{
              position: "absolute",
              left: 30 + i * 292,
              top: 95,
              width: 240,
              height: 225,
              opacity: b.o,
              transform: `translateY(${interpolate(b.o, [0, 1], [28, 0])}px)`,
              borderColor: `${b.color}66`,
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 18, background: `${b.color}22`, border: `1px solid ${b.color}77`, marginBottom: 22 }} />
            <div style={{ fontSize: 25, fontWeight: 900, color: b.color, lineHeight: 1.06 }}>{b.title}</div>
            <div style={{ fontSize: 18, color: COLORS.muted, marginTop: 14, lineHeight: 1.35 }}>{b.body}</div>
          </Card>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Compare: React.FC = () => {
  const frame = useCurrentFrame();
  const left = fade(frame, 4, 28);
  const right = fade(frame, 44, 72);
  const bottom = fade(frame, 92, 120);
  return (
    <AbsoluteFill style={{ padding: 70, color: COLORS.cream }}>
      <Label tone="green">distinction</Label>
      <h1 style={{ fontSize: 58, margin: "20px 0 30px" }}>PoE and Powerline are mirror-image tricks.</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
        <Card style={{ opacity: left, minHeight: 275, borderColor: `${COLORS.green}55` }}>
          <div style={{ fontSize: 34, fontWeight: 950, color: COLORS.green }}>PoE</div>
          <div style={{ fontSize: 22, color: COLORS.cream, marginTop: 18 }}>Power over Ethernet cable</div>
          <div style={{ fontSize: 18, color: COLORS.muted, marginTop: 20, lineHeight: 1.5 }}>
            Low-voltage DC is injected onto network cabling to run cameras, access points, sensors, and controllers.
          </div>
        </Card>
        <Card style={{ opacity: right, minHeight: 275, borderColor: `${COLORS.cyan}55` }}>
          <div style={{ fontSize: 34, fontWeight: 950, color: COLORS.cyan }}>Powerline</div>
          <div style={{ fontSize: 22, color: COLORS.cream, marginTop: 18 }}>Network over power wiring</div>
          <div style={{ fontSize: 18, color: COLORS.muted, marginTop: 20, lineHeight: 1.5 }}>
            Data is modulated onto existing wall wiring, then demodulated elsewhere into Ethernet or Wi‑Fi.
          </div>
        </Card>
      </div>
      <Card style={{ marginTop: 28, opacity: bottom, borderColor: `${COLORS.amber}55` }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.amber }}>Shared principle</div>
        <div style={{ fontSize: 23, color: COLORS.cream, marginTop: 12 }}>
          Same copper can carry multiple signals when they occupy different frequency bands and are coupled safely.
        </div>
      </Card>
    </AbsoluteFill>
  );
};

const HouseTopology: React.FC = () => {
  const frame = useCurrentFrame();
  const t = fade(frame, 0, 20);
  const branches = fade(frame, 30, 75);
  const noise = fade(frame, 82, 118);
  const integrated = fade(frame, 132, 166);
  return (
    <AbsoluteFill style={{ padding: 70, color: COLORS.cream }}>
      <div style={{ opacity: t }}>
        <Label tone="red">the hard part</Label>
        <h1 style={{ fontSize: 56, margin: "20px 0 8px" }}>Your house wiring is a terrible radio channel.</h1>
      </div>
      <div style={{ position: "relative", height: 440, marginTop: 30 }}>
        <Wire x1={120} y1={220} x2={1090} y2={220} active={branches} />
        <Wire x1={370} y1={220} x2={370} y2={80} active={branches} color={COLORS.amber} />
        <Wire x1={620} y1={220} x2={620} y2={345} active={branches} color={COLORS.amber} />
        <Wire x1={860} y1={220} x2={980} y2={92} active={branches} color={COLORS.amber} />
        {[
          [80, 183, "router"],
          [330, 42, "LED driver"],
          [578, 350, "fridge motor"],
          [960, 44, "charger noise"],
          [1050, 183, "Wi‑Fi extender"],
        ].map(([x, y, label], i) => (
          <div
            key={String(label)}
            style={{
              position: "absolute",
              left: x as number,
              top: y as number,
              opacity: i === 0 || i === 4 ? branches : noise,
              width: 150,
              height: 74,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: 17,
              fontWeight: 850,
              color: i === 0 || i === 4 ? COLORS.cyan : COLORS.red,
              border: `1px solid ${(i === 0 || i === 4 ? COLORS.cyan : COLORS.red)}66`,
              background: COLORS.panel2,
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div style={{ opacity: integrated, fontSize: 28, lineHeight: 1.35, color: COLORS.cream }}>
        The “special box” could disappear into a router, smart plug, breaker panel, or access point — but the
        <span style={{ color: COLORS.cyan, fontWeight: 900 }}> transceiver and safe coupling circuit</span> still have to exist somewhere.
      </div>
    </AbsoluteFill>
  );
};

export const PowerlineExplainer = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bgShift = interpolate(frame, [0, 8 * fps], [0, 1], clamp);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${30 + bgShift * 25}% 20%, rgba(112,228,255,0.17), transparent 32%), radial-gradient(circle at 80% 80%, rgba(255,197,109,0.12), transparent 34%), ${COLORS.bg}`,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.16,
          backgroundImage:
            "linear-gradient(rgba(244,234,210,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(244,234,210,0.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <Sequence durationInFrames={150}>
        <DataOnMains />
      </Sequence>
      <Sequence from={150} durationInFrames={160}>
        <AdapterExploded />
      </Sequence>
      <Sequence from={310} durationInFrames={145}>
        <Compare />
      </Sequence>
      <Sequence from={455} durationInFrames={185}>
        <HouseTopology />
      </Sequence>
    </AbsoluteFill>
  );
};
